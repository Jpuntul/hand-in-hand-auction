# Engineering Audit — Hand in Hand for Myanmar Charity Auction

**Date:** 2026-09-13
**Commit:** `d7b98f2` (level with `origin/main`)
**Scope:** Full repository. `_legacy/` reviewed only as a repo-hygiene matter; `src/components/ui/`
(vendored shadcn primitives) not reviewed.

**Method.** Full manual read of every hand-written file (~4,000 lines: 12 migrations, all server
actions, all pages and components, both Edge Functions, the service worker, config and docs). Four
specialist sub-agents (security, correctness/concurrency, frontend/React, data-layer/performance)
then audited independently. Every sub-agent finding included below was re-verified against source;
findings that did not survive verification are listed at the end of §1.

**Caveat.** `node_modules` is not installed in this worktree, so `tsc` and `next build` were not
run. One finding (§5, React Compiler interaction) is marked *possible* for that reason; nothing else
depends on build output.

---

## 1. Executive Summary

| Dimension | Score |
|---|---|
| Architecture | **7.5** / 10 |
| Code Quality | **7** / 10 |
| Correctness | **4.5** / 10 |
| Security | **3** / 10 |
| Performance | **6.5** / 10 |
| Testing | **0** / 10 |
| Production Readiness | **3** / 10 |
| Maintainability | **6.5** / 10 |
| **Overall** | **5 / 10** |

This is a well-conceived application with a concentrated set of serious defects. The core
architectural decision — put the money-handling logic in Postgres, make RLS the security boundary,
and let the browser talk to Supabase directly — is the right one for this scale, and `place_bid()`
is the best code in the repository. The layering is flat and readable, there is essentially no
over-abstraction, and type discipline is better than most production codebases (two unsafe casts in
the whole `src/` tree).

The defects cluster in one place: **everywhere the application layer assumed the database layer
would cover for it, and the database layer silently did nothing instead.** Admin server actions
check nothing and delegate to RLS; RLS answers an unauthorized `UPDATE` with zero rows and no error;
the action reports success and writes an audit entry for a thing that did not happen. The lifecycle
assumes something acts on `start_time`; nothing does. The admin override actions reproduce the exact
read-modify-write pattern that `place_bid` was written to eliminate, on the same table, in the same
repository. Each is small on its own. Together they mean the system's three central invariants —
*only admins mutate*, *auctions open and close on time*, *`items` agrees with `bid_history`* — are
all unenforced, and all fail quietly.

There are **zero tests, zero CI, and no error tracking.** For a one-evening live event where nobody
will be watching dashboards, silent failure is the worst property a system can have, and this one
has several silent failure modes.

### The five most important findings

1. **Admin server actions do no authorization check and fail open into a success response**, writing
   forged audit-log entries as they go. Any signed-in bidder can drive them. (§2.1)
2. **The notification Edge Functions accept forged payloads from anyone holding the public anon key**
   and act on them with the service-role client — anyone on the internet can send "you won" / "you
   lost" emails from the charity's verified sender to real bidders, repeatedly. (§2.2)
3. **Every signed-in user can read every donor's email and phone number.** One `GET` against
   `profiles`. Joins to public bidder UUIDs to give complete bidding histories per identified person.
   (§2.3)
4. **Nothing ever opens an auction.** `start_time` is collected, displayed as "Opens", and enforced by
   `place_bid` — but no code path transitions `scheduled → open`. Event night depends on someone
   remembering to click a dropdown per item. (§2.4)
5. **`cancelLastBid` is a four-step non-atomic mutation that can permanently desynchronise
   `items.current_bid` from `bid_history`**, declare the wrong winner, and leave anti-snipe extensions
   in place. `forceCloseItem`, `extendDeadline`, and `updateItem` share the pattern. (§2.5, §2.9)

### Would I deploy this today?

**No.** With roughly three focused days on the P0/P1 list — none of which requires redesign — yes.

### Sub-agent claims rejected or corrected during cross-check

- "Closing an item without a winner renders `$NaN`" — `Number(null)` is `0`; it renders `$0`. The
  underlying inconsistency is real (§2.13); the symptom was wrong.
- "Watchlist toggle double-click race" — the button is `disabled` while busy; negligible.
- "Drop the 8 dead indexes for performance" — at this row count the write cost is microseconds.
  Two are duplicates and worth removing for hygiene only (§6).
- "All `revalidatePath` calls are no-ops" — overstated; they still purge the client router cache.
- "Move `shadcn` to devDependencies" — technically correct (the `globals.css` `@import` is resolved
  at build time), but cosmetic; not worth a line item.

---

## 2. Critical Issues

### 2.1 Admin server actions are unauthenticated and fail open

**Severity:** Critical
**Location:** `src/app/admin/(protected)/users/actions.ts:8`; `items/actions.ts:12,34,54`;
`items/override-actions.ts:23,54,79,107`
**Problem:** None of the eight admin server actions verifies the caller is an admin. `AdminGuard`
protects *pages*; Server Actions are independently callable POST endpoints. Authorization is
delegated entirely to RLS — and RLS rejection of an `UPDATE`/`DELETE` is **silent**: PostgREST
reports zero rows affected with `error: null`.

```ts
// users/actions.ts:14-26 — called by a non-admin with any userId
const { error } = await supabase.from("profiles")
  .update({ is_admin: isAdmin }).eq("id", userId);        // 0 rows, error === null
if (error) return { ok: false, error: error.message };    // not taken
await supabase.rpc("log_audit", { p_action: "admin.user.promote", ... }); // WRITES ANYWAY
return { ok: true };                                      // LIES
```

**Why it matters:** (a) A real admin whose update is silently rejected sees "Admin access granted."
(b) Any signed-in bidder can call `cancelLastBid`, `forceCloseItem`, `setAdminStatus` etc. in a loop
and fill the audit log with plausible forged entries. The audit log's only purpose is to be
trustworthy after a disputed auction. (c) The escalation defence is one trigger deep
(`prevent_self_promotion`, already loosened once in `20260516223006`), with no application-layer
backstop.

To be precise: a non-admin **cannot** currently promote anyone — `profiles_update_own` limits them to
their own row and the trigger blocks `is_admin`. `createItem` genuinely fails (INSERT `with check`
raises). The exploitable surface today is forgery and false-success, not escalation.

**Evidence:** No call to `getCurrentProfile()` or `is_admin` in any of the three action files. All
seven UPDATE/DELETE actions check only `error`, never row count. `log_audit` is invoked after the
mutation in `users/actions.ts:21` and `override-actions.ts:44,71,98,149` regardless of outcome.
**Recommended fix:** A shared `requireAdmin()` (`getCurrentProfile()` → throw on `!is_admin`) as the
first line of every admin action. Add `.select()` to mutations and fail when no row returns. Write
the audit entry only after a confirmed mutation.
**Priority:** P0 · S

---

### 2.2 Notification Edge Functions accept forged payloads and act with service-role privileges

**Severity:** Critical
**Location:** `supabase/functions/on-auction-closed/index.ts:37-68`; `on-bid-placed/index.ts:30-63`;
`_shared/cors.ts:2`
**Problem:** Both functions trust `payload.record` wholesale and verify nothing beyond `req.method`.
CORS is `*`. Both hold a service-role client (`index.ts:18-21`). `NOTIFICATIONS_SETUP.md:48` says to
leave webhook headers at defaults, so no shared secret exists.

*Assumption, stated explicitly:* `supabase/config.toml` has no `[functions.*]` block and the deploy
commands in the docs pass no `--no-verify-jwt`, so the functions run with default `verify_jwt`. That
gate checks only that the bearer is a valid project-signed JWT — which the public anon key shipped in
every client bundle is. If the deployed setting differs, the exposure narrows to "anyone with a
bidder account" rather than "anyone on the internet"; the fix is identical. Confirm with one `curl`
against the deployed function using the anon key.

**Attack (no account required):**

```
POST /functions/v1/on-auction-closed
Authorization: Bearer <public anon key>
{"type":"UPDATE","table":"items",
 "old_record":{"status":"open"},
 "record":{"id":"<real item id>","name":"<attacker text>","status":"closed",
           "winner_user_id":"<any uuid>","winning_bid":1}}
```

The function queries the real `bid_history` for that item (`:96-99`) and sends "you lost" email +
push to every genuine bidder, and "you won" to whomever the attacker names — from the charity's
verified Resend sender, with attacker-controlled item text, repeatable without limit.
`on-bid-placed` with an arbitrary `previous_bidder_id` targets any single user; its error path
(`:83-88`) also returns the auth-lookup error, an account-existence oracle. The push path
(`_shared/push.ts:62`) POSTs to whatever endpoint is stored — unvalidated
(`account/notifications/actions.ts:39-72`) — which makes the service-role function an SSRF relay.

**Why it matters:** Reputational damage to a charity, phishing-grade emails to donors, and a
denial-of-service against the email quota, all from a `curl` command.
**Recommended fix:** First line of each handler: reject unless
`req.headers.get("x-webhook-secret") === Deno.env.get("WEBHOOK_SECRET")`; set that header in the
webhook config. Re-read the row from the DB by `record.id` instead of trusting the body. Validate
push endpoint hosts against the known push services before storing.
**Priority:** P0 · S

---

### 2.3 All authenticated users can read every user's email and phone

**Severity:** Critical (data exposure)
**Location:** `supabase/migrations/20260516223002_rls.sql:40-44`
**Problem:** `profiles_select_authenticated ... using (true)` over a table containing `email`,
`phone`, `is_admin`. No column restriction. The app only ever needs `display_name` of other users
(`history/[id]/page.tsx:64` is the sole cross-user read outside admin).

**Attack:** Sign up (open signup, no email confirmation — `config.toml`), then
`GET /rest/v1/profiles?select=*`. Full donor list with contact details and admin flags. Join to
`items.current_bidder_id` / `winner_user_id` (public, `rls.sql:57`) and `bid_history.user_id`
(public, `rls.sql:82`) for each donor's complete bidding history.

**Why it matters:** This is donor PII collected "for pickup or payment coordination"
(`profile-form.tsx:86`), exposed to anyone who completes a signup form. That is a reportable
incident, not a code smell.
**Recommended fix:** Own-row `SELECT` policy plus an admin policy; a `public_profiles` view exposing
only `id, display_name`; repoint the one embedded join. Belt-and-braces:
`revoke select (email, phone) on public.profiles from authenticated`.
**Priority:** P0 · M

---

### 2.4 No item ever transitions from `scheduled` to `open`

**Severity:** Critical (operational)
**Location:** `supabase/migrations/20260517023500_lifecycle.sql` (cron registers only
`close_expired_auctions`); `items/schema.ts:35` (default `scheduled`); `place_bid.sql:53-56`
(rejects before `start_time`)
**Problem:** The data model implies a time-driven lifecycle — `start_time` is stored, enforced by
`place_bid`, and rendered as "Opens" (`history/[id]/page.tsx:183`). But the complete set of writes to
`items.status` is: the manual dropdown in `item-form.tsx`, `pauseItem` (→ `scheduled`),
`forceCloseItem` (→ `closed`), and `close_expired_auctions` (`open` → `closed`). **There is no
`→ open` path other than the dropdown.**

Compounding: `pauseItem` reuses `scheduled` as "paused" (`override-actions.ts:66-68`). A paused item
past its `end_time` never closes (cron only matches `open`), never declares a winner, and never
notifies anyone. And the obvious fix for auto-open — `update items set status='open' where
status='scheduled' and start_time <= now()` — would **auto-resume every paused item**. The two
problems collide; fix them together.

**Why it matters:** The UI actively misleads the operator into believing items will open at
`start_time`. On event night, every item is one forgotten click away from never being biddable, and
the failure is silent.
**Recommended fix:** Add a `paused` enum value (so pause is distinguishable from never-started).
Add `open_scheduled_auctions()` mirroring the close function, guarded by `end_time > now()`, on the
existing every-minute cron. Add a "Resume" override. If manual control is genuinely the intent
instead, remove `start_time` from the form and stop labelling it "Opens".
**Priority:** P0 · S

---

### 2.5 `cancelLastBid` can permanently corrupt auction state

**Severity:** Critical (data integrity)
**Location:** `src/app/admin/(protected)/items/override-actions.ts:107-158`
**Problem:** Four sequential round-trips, no transaction, no lock: read newest bid → read
`bid_count` → delete bid row → write restored state from the *deleted row's snapshot*.

- *Lost update on `bid_count`* (`:143`): `Math.max(0, current - 1)` computed in JS from a value
  read at `:124`. `place_bid` does `bid_count = bid_count + 1` in SQL; this reintroduces the race.
- *Clobbered concurrent bid* (`:140-142`): a bid landing after step 1 survives in `bid_history`
  while `items` is rewound to a state that predates it. The item shows a lower current bid than the
  highest row in its own log, and the wrong person is winning. Nothing detects this.
- *Anti-snipe never reversed*: `extended_end_time` is not selected and `end_time` is never restored.
  Cancelling a sniped bid leaves the auction running 60s too long — on exactly the bid most likely
  to be disputed.
- *Post-close cancellation leaves the wrong winner*: `winner_user_id`/`winning_bid` are never
  touched, so cancelling a closed item's winning bid keeps that person recorded as winner with no
  matching `bid_history` row. Fulfilment invoices the wrong person.
- `.order("created_at")` has no `id` tiebreaker.

**Reproduction:** Item has A($100) → B($200). Admin opens the cancel dialog. C bids $300 (accepted;
item is C/$300, count 3). Admin confirms. Result: B deleted; `items` = A/$100/count 2;
`bid_history` = A($100), C($300). A is "winning" at $100 with C's accepted $300 sitting unacknowledged.

**Recommended fix:** A `SECURITY DEFINER` `cancel_last_bid(item_id, reason)` using
`SELECT ... FOR UPDATE`, deleting the newest row, then **recomputing** `current_bid`,
`current_bidder_id`, `bid_count` from `bid_history` (never from a snapshot), rolling back `end_time`
if `extended_end_time` was set, updating `winner_*` if `status = 'closed'`, and writing the audit row
in the same transaction.
**Priority:** P0 · M (after 2.1)

---

### 2.6 `SUPABASE_SERVICE_ROLE_KEY` is deployed to an app that never reads it

**Severity:** High
**Location:** `.env.example:20`; `DEPLOY.md` §3
**Problem:** `DEPLOY.md` instructs pasting the service-role key into Vercel for Production and
Preview. `grep` confirms the Next.js app never reads it; the only consumers are Edge Functions, which
get it from Supabase's own secret store.
**Why it matters:** An RLS-bypassing credential sits in every Vercel environment, including every
Preview build, for zero benefit. Any future SSRF, dependency compromise, or `process.env` dump is
full database compromise.
**Recommended fix:** Remove from `DEPLOY.md` and `.env.example`; rotate the key if already deployed.
**Priority:** P0 · S (ten minutes)

---

### 2.7 Open redirect on the admin login path

**Severity:** High
**Location:** `src/app/admin/login/page.tsx:18`; `src/lib/auth/actions.ts:138,167`
**Problem:** Both sites pass a query-string-derived `redirect` value unvalidated to `redirect()`,
which accepts absolute URLs. `page.tsx:18` fires for an **already-authenticated admin with no
interaction**: `/admin/login?redirect=https://evil.tld/admin/login` bounces them straight to a clone.
`//evil.tld` also works.
**Recommended fix:** `p.startsWith("/") && !p.startsWith("//") ? p : "/admin"` at both sites.
**Priority:** P1 · S

---

### 2.8 `log_audit` is granted to `anon` — the audit log accepts forged entries

**Severity:** High
**Location:** `supabase/migrations/20260516223004_log_audit.sql:41`
**Problem:** `SECURITY DEFINER` + `grant execute ... to anon`. Anyone on the internet can insert
arbitrary rows with arbitrary `action`/`metadata`. When unauthenticated, `actor_email` is taken
verbatim from caller-supplied `p_metadata->>'email'` (`:33`). No rate limit, no retention.
**Why it matters:** Forge `admin.user.promote` attributed to a real admin's email, or flood the table
past the 200-row admin view (`audit-log/page.tsx:37`) to bury real evidence. The `anon` grant exists
for one reason — logging failed sign-ins — which can be done server-side where the email is already
in hand.
**Recommended fix:** Revoke from `anon`. Allow-list `p_action` values; never read `actor_email` from
caller metadata. Prune rows older than 90 days on the existing cron.
**Priority:** P1 · S

---

### 2.9 `forceCloseItem`, `extendDeadline`, and `updateItem` share the read-modify-write flaw

**Severity:** High
**Location:** `override-actions.ts:23-52, 79-105`; `items/actions.ts:44` + `item-form.tsx:52-56,105-107`
**Problem:**
- `forceCloseItem` reads `current_bidder_id`/`current_bid` (`:82`) then writes them as winner
  (`:90`). A bid in between → the previous leader is declared winner; `on-auction-closed` emails the
  wrong person "you won." No status guard: a `scheduled` or `cancelled` item can be force-closed.
- `extendDeadline` reads `end_time` (`:28`), writes `base + minutes` (`:40`). Two admins clicking
  "+15m" yields +15m. An anti-snipe extension in between is discarded. If cron closed the item in
  the window, `end_time` moves into the future on a `closed` row — audit says extended, nobody can
  bid. `new Date()` on the null path uses the Node clock, not the DB clock.
- `updateItem` writes **every** field from a snapshot loaded at page render, including `status`,
  `start_time`, `end_time`. Admin opens edit at 20:00 (ends 20:05); anti-snipe pushes to 20:06:30;
  admin fixes a typo and saves → `end_time` reverts to 20:05, already past — bidders promised +60s
  are cut off. `toDatetimeLocal` (`:56`) emits `HH:mm`, so **every save silently drops seconds** from
  both times. If cron closed the item while the form was open, save writes `open` back; cron
  re-closes within 60s; a second `open→closed` transition **double-sends every notification** (§2.11).
**Recommended fix:** Single atomic SQL statements —
`set end_time = coalesce(end_time, now()) + make_interval(mins => $2) where id = $1 and status = 'open'`;
`set status='closed', winner_user_id=current_bidder_id, winning_bid=current_bid where id=$1 and status='open'`
— each returning row count, 0 = error. Exclude `status`/`start_time`/`end_time` from the generic
edit form (dedicated scheduling control), send only dirty fields, carry seconds through the
datetime round-trip.
**Priority:** P1 · M

---

### 2.10 Expired cards read "Ends in ended" with an enabled "Place bid" button

**Severity:** High (correctness / UX)
**Location:** `src/app/bidding/item-card.tsx:39-45, 90-94, 164`
**Problem:** The 1-second interval lives inside the child `Countdown`; `isExpired` and `canBid` are
computed in the parent `ItemCard`, which never re-renders on the child's ticks. When `end_time`
passes on a quiet item, the card renders literally **"Ends in ended"** (`:164` wraps a component that
returns `ended` at `:45`) with `canBid` still true. Clicking yields a raw `Auction has ended`
Postgres error toast. It self-corrects only on the next realtime `items` UPDATE — which, on a quiet
item, is the cron close up to 60s later. `bid-cta.tsx:18-24` ticks in the right component; the two
disagree.
**Recommended fix:** One shared 1 Hz tick at the grid level (also fixes §6 per-card intervals);
compute `isExpired` from it.
**Priority:** P1 · S

---

### 2.11 `on-auction-closed` has no idempotency guard; mass close fans out serially

**Severity:** High
**Location:** `supabase/functions/on-auction-closed/index.ts:63-131, 139-178`
**Problem:** The only filter is `old.status !== 'closed' && new.status === 'closed'`. Nothing records
that a notification was sent. Any repeated transition (§2.9 reopen/re-close, `forceCloseItem` on a
reopened item, webhook redelivery on timeout) re-sends the complete winner + loser set. The loser loop
(`:110`) awaits `notify()` serially, and each `notify()` does a `getUserById` **plus** a
`notification_prefs` select per user — 2N round-trips, though `profiles.email` already holds the
address. In a single-evening auction most items share an `end_time`, so one cron tick closes ~all
items at once → hundreds of concurrent invocations, each serial over its bidders, against Resend's
rate limit. Expect wall-clock timeouts and silently unsent "you lost" mails. Separately, the webhook
fires on **every** `items` UPDATE — i.e. every bid — for the function to immediately return "not a
closing transition."
**Recommended fix:** `items.notified_at`; first action `update ... set notified_at = now() where id
= $1 and notified_at is null`, bail on 0 rows. Batch: one `profiles` select + one `prefs` select for
all losers, `Promise.allSettled` with bounded concurrency. Filter the webhook to status changes.
**Priority:** P1 · M

---

### 2.12 `ItemsGrid` never removes closed items, and injects unstarred items into the watchlist

**Severity:** High
**Location:** `src/app/bidding/items-grid.tsx:25-70`; `account/watchlist/page.tsx:70`
**Problem:** The server query filters `open/scheduled` (`bidding/page.tsx:26`); the realtime UPDATE
handler maps rows in place and never re-applies the filter, so closed items linger in the live grid
until reload — on event night the auction page degrades into a list of expired lots. The INSERT
handler appends any new `open/scheduled` item unconditionally; the same component renders the
watchlist, so an admin creating an item injects it into every open watchlist view. Also
`useState(initialItems)` (`:20`) ignores later props, so a server re-render cannot correct a
diverged client list. No `.subscribe()` status callback: on a dropped socket (mobile backgrounding)
prices freeze silently, and missed updates are gone on reconnect.
**Recommended fix:** Drop `closed/cancelled` in the UPDATE handler; `mode="auction"|"watchlist"`
prop gating INSERT; on `SUBSCRIBED` after reconnect, re-fetch and replace state; show a
"reconnecting" badge otherwise.
**Priority:** P1 · S

---

### 2.13 `deleteItem` cascades away the entire bid history; item form can close without a winner

**Severity:** High
**Location:** `items/actions.ts:54-65` + `schema.sql:76` (`on delete cascade`); `schema.ts:18`
**Problem:** One click on Delete destroys every bid ever placed on the item — no audit entry (the
three CRUD actions write none, while the override UI claims "All actions are logged"), no guard on
`bid_count > 0`, and `cancelLastBid`'s loser list is read from that same table. Separately, the
edit form allows `status: 'closed'` without setting `winner_*`, and nothing constrains
`winning_bid`/`winner_user_id` to agree with `current_*`; the detail page then shows a winner block
with "$0."
**Recommended fix:** Block deletion when `bid_count > 0` (or soft-delete via `cancelled`). Audit all
three CRUD actions. Add `check (bid_count >= 0)` and a closed-winner consistency constraint.
**Priority:** P1 · S

---

### 2.14 Stale bid data on the item detail page guarantees rejected bids

**Severity:** High (UX)
**Location:** `history/[id]/page.tsx` (no realtime, no refresh); `bid-dialog.tsx:61, 88`
**Problem:** The detail page is a pure RSC. `BidCta` computes `minBid` from a page-load snapshot;
`BidDialog` seeds the input once via `defaultValues` and, on success, only closes — no
`router.refresh`, so even the bidder's own bid does not appear. On a contested item the UI proposes a
losing amount and the server correctly rejects it with a raw Postgres string.
**Recommended fix:** `onSuccess` prop → `router.refresh` from `bid-cta`; a small client wrapper
subscribing the price panel to realtime; `reset()` the form when `minBid` changes with a visible
"price moved" note; map known `place_bid` errors to plain sentences.
**Priority:** P1 · M

---

### 2.15 `updateProfile` performs no server-side validation; bidders can rewrite their own `email`

**Severity:** High
**Location:** `account/profile/actions.ts:9-26`; `rls.sql:48-51`
**Problem:** Signup validates with Zod (`max(100)`); the update action trims and writes. The
`maxLength` on the input is client-side only. `display_name` renders to all users in bid history —
unbounded storage plus UI defacement. Separately, `profiles_update_own` permits every column: a
bidder can `PATCH` their own `email` to `ceo@charity.org`. `log_audit` reads `actor_email` from that
column (`log_audit.sql:24-26`), so their subsequent actions appear under the CEO's name in the admin
audit view and users list. Not account takeover — identity spoofing in the admin console.
**Recommended fix:** Reuse the signup Zod schema; `check (length(display_name) <= 100)`;
`revoke update (id, email, is_admin, created_at) on public.profiles from authenticated`.
**Priority:** P1 · S

---

### 2.16 Admin users page computes bid counts client-side over an unbounded fetch

**Severity:** High (correctness at scale)
**Location:** `admin/(protected)/users/page.tsx:20-36`
**Problem:** All profiles, then `bid_history.select("user_id").in("user_id", allIds)` — every bid
row shipped to Node to be counted in a loop, with every UUID serialised into the URL (~19 KB at 500
users; 414 risk). PostgREST caps rows (`config.toml:16`, `max_rows = 1000`): past 1,000 bids the
response is **silently truncated** and the "Bids" column is wrong with no error. A 300-bidder auction
crosses that comfortably.
**Recommended fix:** `create view user_bid_counts as select user_id, count(*) from bid_history group
by 1` — the one query that would actually use `bid_history_user_id_idx`. Paginate profiles.
**Priority:** P1 · S

---

### 2.17 Notification webhooks exist only as dashboard state

**Severity:** Medium
**Location:** `NOTIFICATIONS_SETUP.md` §3; no migration registers them
**Problem:** `supabase db reset`, a restore, or a second project applies every migration cleanly and
sends **zero** notifications, with nothing in the repo or the app to reveal it.
**Recommended fix:** Register the `supabase_functions` hook triggers in a migration. Have
`on-auction-closed` write an audit row on completion so absence is visible.
**Priority:** P1 · M

---

### 2.18 Open items with `end_time IS NULL` never close; `cancelled` notifies nobody

**Severity:** Medium
**Location:** `lifecycle.sql:53` (`end_time is not null`); `schema.ts:17`; `item-card.tsx:158`
**Problem:** The form allows `open` with null `end_time` (no `refine`, no "required when open"). No
countdown renders, `isExpired` stays false, and the cron never matches. Bidding runs until someone
notices. Separately, `status = 'cancelled'` drops the item from `/bidding` with no email, push, or
explanation to anyone who bid.
**Recommended fix:** Zod `refine`: `end_time` required when `status = 'open'`, `end_time >
start_time` (the DB constraint exists but surfaces as a raw error). Handle `cancelled` in
`on-auction-closed`.
**Priority:** P2 · S

---

### 2.19 SECURITY DEFINER functions inherit `EXECUTE` to `PUBLIC`

**Severity:** Medium
**Location:** `lifecycle.sql:38-61`; `place_bid.sql:108`
**Problem:** No `REVOKE` anywhere, so every `public` function is callable by `anon` via
`/rest/v1/rpc/`. `close_expired_auctions` has no internal caller check: an anonymous caller can fire
the close at a chosen moment inside the 60s cron gap. Bounded (only already-expired items, once each;
`place_bid` independently rejects late bids), but it lets anyone trigger the notification blast on
demand. The `grant ... to authenticated` on `place_bid` is decorative — `anon` can call it and is
stopped only by the in-function `auth.uid() is null` check.
**Recommended fix:** `revoke execute on all functions in schema public from public` as a baseline,
then grant back only what is intended.
**Priority:** P2 · S

---

### 2.20 `proxy.ts` makes an Auth-server round-trip on every request

**Severity:** Medium (performance)
**Location:** `src/proxy.ts:22`; `lib/supabase/middleware.ts:31`
**Problem:** The matcher covers essentially every request including RSC fetches; each calls
`supabase.auth.getUser()` — a network call. The page then calls `getCurrentUser()` (second) and
`getCurrentProfile()` (third). `cache()` dedupes within a render, not across the proxy boundary.
That is ~100–300 ms serial latency per navigation, and the app's highest-volume backend call at 500
users — to serve one `/admin` redirect.
**Recommended fix:** Narrow the matcher to `/admin/:path*` and the session-refresh cases that
actually need it.
**Priority:** P2 · S

---

### 2.21 `push_subscriptions` JSONB is read-modify-written from three places

**Severity:** Medium
**Location:** `_shared/push.ts:91-109`; `account/notifications/actions.ts:48-66, 83-102`
**Problem:** Two Edge Function invocations in one cron tick, or a user subscribing on two devices,
clobber each other's array — a fresh device silently disappears or a pruned endpoint is resurrected.
**Recommended fix:** A `push_subscriptions` child table, or JSONB path operators in one statement.
**Priority:** P2 · S

---

### Low

- **Keyboard inaccessible navigation.** `item-card.tsx:98-101` (`<Card onClick>`),
  `items-table.tsx:64-67` (`<TableRow onClick>`): not focusable, no Enter/Space, no middle-click, no
  URL on hover; forces the `stopPropagation` workarounds at `item-card.tsx:175` and
  `watchlist-star.tsx:20`. The pencil `<Button>` at `items-table.tsx:102` has no handler. Fixing this
  also lets `items-table.tsx` drop `"use client"`.
- **Image handling.** `image-upload.tsx`: promises "max 5MB" (`:117`) but never checks `file.size`;
  uploads on selection, `remove()` drops only the URL, `deleteItem` leaves every object — orphans
  stay publicly retrievable forever.
- **`item-form.tsx:130-138`** — `setSubmitting(false)` before `router.push`; button re-enables
  during navigation (double-submit window). Six forms hand-roll `setBusy` around actions while the
  two login forms use `useActionState` correctly.
- **No `loading.tsx`, no `Suspense`, no `generateMetadata`** anywhere under `src/app`. Every
  navigation is dead air; every shared item link gets the generic root title and no OG image — for a
  charity auction, shared links are the distribution path.
- **Falsy checks** `item.item_no &&` / `item.retail_value &&` (`history/[id]/page.tsx:128,163`)
  hide lot #0 / $0 — the codebase uses `!= null` elsewhere.
- **"Rank" column is a sequence number** (`history/[id]/page.tsx:348`, `rows.length - i`).
- **Winner name read from `bid_history[0]`** not `winner_user_id` (`:74,271`) — two sources of truth.
- **Item count ignores the category filter** (`bidding/page.tsx:53` vs client-side filter).
- **`bid-dialog.tsx:109` `step="1"`** while `bid_increment` is `numeric(12,2)`.
- **Raw Postgres/PostgREST error strings** returned to clients in 14 places (policy and constraint
  names leak).
- **`error.tsx`** renders `error.message` verbatim, passes `user={null}` (signed-in user sees "Sign
  in"), and there is no `global-error.tsx`.
- **`sw.js` references `/icon-192.png`**, which does not exist; no `manifest.json` for the iOS
  home-screen flow the docs describe.
- **Category filter buttons lack `aria-pressed`**; countdown has no `role="timer"`; price changes
  are announced nowhere.

---

## 3. Architecture Review

### Current architecture

```
Browser
  ├── Next.js 16 App Router (Vercel)
  │     ├── Server Components — reads via @supabase/ssr with the cookie session
  │     ├── Server Actions   — writes; auth in lib/auth/actions.ts; NO admin checks (§2.1)
  │     ├── proxy.ts         — session refresh on every request + /admin redirect
  │     └── Client Components — realtime, countdowns, dialogs
  │
  └── Supabase (direct from browser: anon key + RLS)
        ├── Postgres    — 6 tables, RLS everywhere, place_bid() as the transactional core
        ├── Realtime    — items + bid_history publications (no client reads bid_history)
        ├── Storage     — item-images, public read / admin write
        ├── pg_cron     — close_expired_auctions, every minute (no open counterpart — §2.4)
        └── Edge Fns    — on-bid-placed, on-auction-closed → Resend + Web Push
              (dashboard-configured webhooks, not in VCS — §2.17; unauthenticated — §2.2)
```

**The defining decision** is that the database is both the security boundary and the transactional
authority, with Next.js as a rendering/session layer rather than an API tier. At 4,000 lines that is
the correct call — it eliminates a hand-written CRUD tier and puts the concurrency guarantee where it
can be enforced.

### What is good — keep it

- **`place_bid()`** — `SECURITY DEFINER`, `SELECT ... FOR UPDATE`, every validation inside the
  transaction, anti-snipe in the same critical section, `previous_*` captured under the lock. Verified
  safe against `close_expired_auctions` (the cron's UPDATE blocks on the row lock and re-evaluates
  `end_time <= now()` after an extension). **Do not refactor this.**
- **`is_admin()` as `SECURITY DEFINER`** — the correct idiom for policy recursion, correctly commented.
- **Append-only `bid_history` with `previous_bidder_id`/`previous_bid`/`extended_end_time`** — makes
  outbid notification a pure function of the inserted row.
- **`server_time()` + `use-server-time.ts`** with RTT correction — a real fix for a real problem.
- **Migration comments explain *why***, including admitting a dashboard-first change
  (`20260517023358`) and documenting a previous version's mistake (`20260516223006`).
- **Type discipline** — generated types, domain aliases, `as const satisfies readonly ItemStatus[]`
  so runtime constants cannot drift from the enum. Two unsafe casts total.
- **`cache()`-wrapped auth queries**; PostgREST embedded selects (`profiles!user_id(display_name)`,
  `item:items(*)`) — no N+1 anywhere except the users page.

### What is problematic — change it

- **Ambiguous authorization boundary.** RLS enforces; the app assumes and checks nothing. Because RLS
  rejects `UPDATE`/`DELETE` silently, the hole is exactly where the app is most confident. One
  `requireAdmin()` makes the app state its assumption instead of inheriting it.
- **Business logic in four layers.** Minimum-bid (`current_bid + increment`, else `starting_bid`) in
  `place_bid.sql:73`, `item-card.tsx:85`, `bid-cta.tsx:32`, `history/[id]/page.tsx:223`. USD formatter
  in six files — five with `maximumFractionDigits: 0`, one (`bid-dialog.tsx:23`) without, so with a
  $10.50 increment the card says `$1,011` and the dialog/server enforce `$1,010.50`. `statusVariant`
  twice. The SQL copy is the authority; the TypeScript copies belong in one `lib/auction.ts`.
- **`ItemsGrid` serves two contracts and is correct for neither** (§2.12).
- **The lifecycle has no single home** — a dropdown, an override action, and a cron job, with no
  statement of legal transitions. That is how the missing `→ open`, the paused-never-closes, and the
  null-`end_time`-never-closes gaps all went unnoticed. A trigger enforcing valid transitions, or at
  minimum a comment block, would make the machine legible.
- **The override actions reproduce the pattern `place_bid` was written to avoid** — same table, same
  repository. All four should be SQL functions.

### What is *not* over-engineered

This codebase does **not** need a service layer, repositories, DTOs, an event bus, or DI. It has none
of them and that is correct. The flat `page.tsx` / `actions.ts` / migration layering is appropriate.
Resist adding structure. The 390-line `history/[id]/page.tsx` is long but linear; splitting it is
taste, not necessity.

---

## 4. Security Review

**Critical**
- §2.2 Edge Function webhooks forgeable with the public anon key; service-role client; CORS `*`;
  unvalidated push endpoints (SSRF relay).
- §2.3 `profiles` fully readable by any authenticated user — donor email + phone + admin flag.
- §2.1 Admin server actions unauthenticated; RLS denial is silent; audit entries forged.

**High**
- §2.6 Service-role key deployed to Vercel for an app that never reads it.
- §2.7 Open redirect on `/admin/login` (pre-auth for a signed-in admin).
- §2.8 `log_audit` executable by `anon`; `actor_email` from caller metadata.
- §2.15 Bidders can rewrite their own `profiles.email` → spoofed identity in the admin audit view.

**Medium**
- §2.19 All `public` functions inherit `EXECUTE` to `PUBLIC`; `close_expired_auctions` has no caller
  check.
- Email confirmation disabled (`config.toml`, `enable_confirmations = false`); anyone can register as
  any address — the entry ticket to §2.3.
- `place_bid` enforces a floor but no ceiling: a bidder can bid `$10^10`, become winner with no
  deposit, and render an item unsellable. A cap (`p_amount <= v_min_bid * 100`) or per-item
  `max_bid` is cheap insurance.

**Low**
- Raw error strings to clients (policy/constraint names).
- `on-bid-placed:83-88` returns the auth-lookup error — account-existence oracle.
- Removed item images remain publicly retrievable.
- `next.config.ts:3-6` hardcodes a fallback Supabase URL: a misconfigured deploy silently points at
  the wrong project instead of failing fast.

**Verified clean:** privilege escalation via `profiles` UPDATE is blocked by the trigger (missing
`WITH CHECK` is harmless — Postgres reuses `USING`); storage policies are `is_admin()`-gated with
UUID paths and `upsert: false`; `watchlist` and `notification_prefs` RLS are correctly own-row; no
service-role key reaches the client; Server Actions carry Next.js origin checks so CSRF is not a
finding.

---

## 5. Code Quality Review

The meaningful problems, in priority order:

1. **Duplicated business logic with visible drift** — min-bid in four places, USD formatting in six
   with two configs, status→badge in two. See §3.
2. **Inconsistent action plumbing.** Login forms use `useActionState`; six other forms hand-roll
   `setBusy` around `await action()`, producing the double-submit window in `item-form.tsx:130`.
3. **Validation parity is one-directional.** `itemSchema` is enforced server-side only —
   `useForm<FormRaw>` has no `zodResolver` (`item-form.tsx:120`); the only client validation is three
   `required` flags, and server rejections arrive as an unfielded raw Zod string. `updateProfile` has
   no schema at all while signup does.
4. **Inconsistent confirmation UX** — `confirm()` in three places, a `<Dialog>` for cancel-bid, in
   the same component as one of the `confirm()`s.
5. **Two unsafe casts** — `as unknown as BidRow[]` (`history/[id]/page.tsx:72`) papering over the
   generated types not modelling the embed; `as unknown as BufferSource` (`push.ts:77`) with a
   justifying comment. Acceptable; noting for completeness.
6. **Dead config and dependencies** — `@tanstack/react-query` + devtools mounted and never used
   (devtools ship to prod, no `NODE_ENV` guard); `date-fns` has zero imports; `next-themes` with a
   full `.dark` palette and no `ThemeProvider`; `bid_history` in the realtime publication with no
   subscriber; `items_categories_idx` declared twice; four redundant `force-dynamic` exports.
7. **22 hardcoded hex colours** across three files alongside a complete token system — these will
   not respond to the `.dark` palette.
8. **`eslint-disable-next-line`** in a Biome project (`override-actions.ts:12`) — suppresses nothing.
9. **Docs drifted from code** — `ADMIN_SETUP.md` calls shipped pages "planned," claims `AdminGuard`
   signs out (it redirects), and lists a local AI-tool setting under "Security guarantees";
   `DEPLOY.md` names a merged branch; `README.md` is untouched `create-next-app` boilerplate.

What I am *not* flagging: naming is good; function sizes are reasonable; comment density is right;
error handling is consistent in shape (`{ ok, error }`); the `FormRaw` → `ItemFormValues` split in
`item-form.tsx` is a sensible way to handle string-typed inputs.

---

## 6. Performance Review

Scale assumed: ~300 items, ~3,000 bids, 50–500 concurrent clients, one evening.

**Immediate problems**
- §2.16 Users page — silently wrong counts past 1,000 bids; URL-length failure at a few hundred
  users. A correctness bug that presents as performance.
- §2.11 Mass-close fan-out — serial per-loser round-trips × concurrent invocations against Resend's
  rate limit. "You lost" mails will silently not send at event end.
- §2.20 Auth round-trip on every request via the proxy matcher.
- Per-card `setInterval` (`item-card.tsx:39`) — 300 items → 300 timers and 300 re-renders per
  second on every attendee's phone. Hoist one tick to the grid (also fixes §2.10).
- Dead client dependencies — `@tanstack/react-query` (~13 KB gz), devtools, `date-fns`.
- **Possible (unverified without a build):** `use-server-time.ts:39` returns a getter that reads
  `offsetRef.current` during render. With `reactCompiler: true`, the compiler may memoize a scope
  whose only changing input is the discarded `useState` tick, freezing the countdown. Returning a
  reactive `now` instead of a getter removes the question.

**Future scale (watch)**
- Unfiltered realtime fan-out: 1 full-row message per bid per client (`postgres_changes` cannot
  project columns). 500 clients × 3,000 bids ≈ 1.5M messages and 500 concurrent connections in one
  evening — at or over plan ceilings (verify current numbers). Fine at 150. The fix if needed is
  Broadcast-from-trigger with a 5-field payload; do not build it for 100 users.
- `/bidding` sends all items unpaginated in the RSC payload; `history/[id]` sends all bids.
- Dashboard "revenue at stake" fetches every open item's `current_bid` to sum in JS; wrong past
  1,000 items.
- Missing index `bid_history(created_at)` for the 24h count — irrelevant below ~100k rows.

**Index map.** 6 of 14 declared indexes are used by real queries. `items_item_no_idx` duplicates the
index the `unique` constraint already creates; `watchlist_user_id_idx` is a redundant prefix of the
PK. `items_current_bid_idx`, `items_categories_idx` (filtering is client-side), `profiles_is_admin_idx`
(`is_admin()` is a PK lookup), and the three secondary `audit_log` indexes serve no query. **Do not
drop them for performance** — the write cost is microseconds. Drop the two duplicates for hygiene
when the schema is next touched.

**Do NOT optimize**
- `close_expired_auctions` every minute — a single indexed `UPDATE`; and its interaction with
  `place_bid` is provably correct.
- `count: "exact"` on the dashboard — sub-millisecond at this size.
- `server_time` polling — ~17 rps at 500 clients for `select now()`.
- Manual memoization — React Compiler is on.
- The denormalized `current_bid`/`bid_count` on `items` — correct and deliberate.

---

## 7. Testing Review

**There are no tests.** No runner in `package.json`, no test files, no CI. The pre-existing CI
(`0480203 feat: add pre-commit hooks and CI`) sits dead in `_legacy/.github/`.

Five targeted tests cover nearly all real risk:

| # | Test | Why |
|---|---|---|
| 1 | `place_bid` under concurrency — N simultaneous bids, assert one winner, `bid_count == accepted`, `items.current_bid == max(bid_history)` | The load-bearing guarantee. Nothing verifies it. |
| 2 | RLS matrix — for `anon` / bidder / other-bidder / admin, assert readable columns and permitted writes on all six tables | Regression for §2.3, §2.15; makes the policy set changeable without fear. |
| 3 | Anti-snipe boundary — bid at T−59s extends; T−61s does not; T−60s is deterministic | Invisible business rule at the most-watched moment. |
| 4 | Every admin action rejects a non-admin caller | Regression for §2.1. Write with the fix. |
| 5 | `cancel_last_bid` / `force_close` / `extend` under a concurrent bid — `items` and `bid_history` still agree | Regression for §2.5 and §2.9. |

Strategy: Vitest for 4; pgTAP (or plain SQL in CI via `supabase db reset`) for 1, 2, 3, 5. One
GitHub Actions job: `biome check`, `tsc --noEmit`, `next build`, SQL suite. About a day.

Do **not** write component tests for shadcn primitives or snapshot tests for marketing pages.

---

## 8. Production Readiness

**Could I confidently deploy this today? No.**

Blockers:
1. §2.1 Admin actions unauthenticated, failing open, forging audit entries.
2. §2.2 Anyone can trigger notification blasts from the charity's sender.
3. §2.3 Donor email/phone readable by any signed-up user.
4. §2.4 No item can open without a manual click.
5. §2.5 / §2.9 Override actions can corrupt auction state.
6. §2.6 Service-role key deployed where it is not needed.
7. **No error tracking.** `error.tsx:17` has `// Wire to Sentry here` and `console.error`. A
   production error is invisible unless a user reports it. `DEPLOY.md` documents the setup.
8. §2.17 Notifications depend on unversioned dashboard state with silent failure.

Also missing, relevant before a live event:
- No CI; nothing verifies the build.
- No rollback story; migrations are forward-only; no runbook for "live and something is wrong."
- No backup verification — take a manual `pg_dump` before the event and confirm it restores.
- `EMAIL_FROM` defaults to `onboarding@resend.dev`, which corporate filters reject; verify a domain.
- Email confirmation off; enable it.
- No monitoring of the cron — if it stops, nothing notices and no auction closes.
- No `loading.tsx` anywhere; every navigation is dead air on venue wifi.

**Realistic path:** P0 list (~2 days) + Sentry (1 h) + email confirmation + Resend domain +
pre-event `pg_dump` + the five tests. One focused week.

---

## 9. AI-Generated Code Review

The code reads as AI-assisted throughout, mostly well — consistent naming, genuinely explanatory
comments, coherent structure. The tells are **speculative completeness** and **pattern reproduction
without the lesson**, not sloppiness.

**Scaffolding with no consumer**
- `@tanstack/react-query` + devtools mounted, never used, devtools unguarded in prod.
- `date-fns` installed, zero imports.
- `next-themes` + a complete `.dark` palette + no `ThemeProvider`.
- `SUPABASE_SERVICE_ROLE_KEY` documented for an app that never reads it (§2.6) — a security cost
  incurred for a completeness instinct.
- `bid_history` added to the realtime publication; no subscriber.

**Comments that assert rather than describe**
- `admin-shell.tsx:10` — "we can trust profile is non-null here," followed by `profile?.display_name
  ?? null`. Comment and code disagree about the invariant.
- `override-actions.ts:12` — `eslint-disable-next-line` in a Biome project. A reflex from a
  different toolchain; suppresses nothing; the `any` remains.
- `ADMIN_SETUP.md` — "the deny rules in `~/.claude/settings.json` prevent assistant tools from reading
  `.env.local`" under **Security guarantees**. A local AI-tool setting is not a property of the
  application.
- `item-overrides.tsx:48` — "All actions are logged to the audit log." The three CRUD actions log
  nothing; the log accepts anonymous forgeries.

**Copy-paste that outran comprehension**
- Four override actions share the identical read → compute-in-JS → write shape — the precise pattern
  `place_bid` exists to avoid, in the same repository, against the same table.
- `ItemsGrid` reused for the watchlist without reconciling "all items" vs "this user's items."
- Six USD formatters with two different configurations — visible drift on the bid dialog.
- `isExpired` computed in one component, ticked in another — `bid-cta.tsx` gets it right,
  `item-card.tsx` does not; the two were evidently produced separately.

**Documentation written ahead of the code**
- `ADMIN_SETUP.md` calls the users page and audit viewer "planned (Phase 6.5 / 6.3)"; both shipped.
  It says `AdminGuard` signs out; it redirects. `DEPLOY.md` names a branch already merged.

**What is *not* slop:** the migration comments, the RLS rationale, `place_bid`, the
`satisfies`-checked constant arrays, the `server_time` hook. This is not a codebase to distrust — it
is one where confident-sounding text needs spot-checking against the code, and where anything that
exists "for completeness" should be deleted.

---

## Prioritized Action Plan

### P0 — Fix immediately

| # | Problem | Why | Files | Approach | Cx | Deps |
|---|---|---|---|---|---|---|
| 1 | Admin actions unauthenticated; 0-rows = success; forged audit rows (§2.1) | Any bidder can drive them | `users/actions.ts`, `items/actions.ts`, `items/override-actions.ts`, new `lib/auth/require-admin.ts` | Shared `requireAdmin()`; `.select()` on mutations, fail on empty; audit after confirmed mutation | S | — |
| 2 | Edge Functions forgeable (§2.2) | Email blasts from the charity's sender by anyone | `functions/on-*/index.ts`, webhook config | Shared-secret header check first; re-read row by id; validate push hosts | S | — |
| 3 | `profiles` fully readable (§2.3) | Donor PII | new migration; `history/[id]/page.tsx:64`; regen types | Own-row + admin policies; `public_profiles` view; repoint one join | M | — |
| 4 | Nothing opens auctions; pause collides (§2.4) | Event silently fails to start | new migration (`paused` enum, `open_scheduled_auctions`); `override-actions.ts:54`; `item-overrides.tsx` | Mirror the close fn; guard `end_time > now()`; add Resume | S | — |
| 5 | `cancelLastBid` non-atomic (§2.5) | Permanent `items`/`bid_history` divergence, wrong winner | new migration; `override-actions.ts:107` | `SECURITY DEFINER` + `FOR UPDATE`; recompute from `bid_history`; restore `end_time`; audit in-txn | M | #1 |
| 6 | Service-role key in Vercel (§2.6) | RLS-bypass credential, zero benefit | `DEPLOY.md`, `.env.example`, Vercel | Remove; rotate | S | — |

### P1 — Fix before launch

| # | Problem | Why it matters | Files | Approach | Cx | Deps |
|---|---|---|---|---|---|---|
| 7 | Open redirect (§2.7) | Signed-in admin bounced to a clone with zero interaction | `admin/login/page.tsx:18`, `lib/auth/actions.ts:138,167` | Shared helper: accept only `startsWith("/") && !startsWith("//")` | S | — |
| 8 | `log_audit` executable by `anon` (§2.8) | Audit log is forgeable and floodable | `migrations/…_log_audit.sql:41`; `lib/auth/actions.ts:29` | Revoke from `anon`; allow-list `p_action`; never read `actor_email` from metadata; 90-day prune on cron | S | #1 |
| 9 | `forceClose` / `extend` / `updateItem` read-modify-write (§2.9) | Wrong winner; reverted anti-snipe; seconds dropped; reopen → double-send | `override-actions.ts:23,79`; `items/actions.ts:44`; `item-form.tsx:52-56,105` | Two atomic SQL fns with `status='open'` guard returning row count; edit form sends dirty fields only, lifecycle columns moved to a dedicated control, seconds preserved | M | #5 (same pattern) |
| 10 | "Ends in ended" + enabled bid button; N intervals (§2.10) | Users click into a guaranteed error on every quiet item | `item-card.tsx:37-45,90-94,164`; `items-grid.tsx` | One 1 Hz tick at grid level via context; `isExpired`/`canBid` derived from it; `Countdown` becomes pure | S | — |
| 11 | `on-auction-closed` not idempotent; serial fan-out (§2.11) | Duplicate "you won" mails; unsent "you lost" mails at event end | `functions/on-auction-closed/index.ts:63-131,139-178`; new migration (`items.notified_at`); webhook config | Claim `notified_at` first, bail on 0 rows; one `profiles` + one `prefs` query for all losers; `allSettled` with bounded concurrency; webhook condition on status change | M | #2 |
| 12 | `ItemsGrid` realtime contracts (§2.12) | Closed lots linger; watchlist shows unstarred items; frozen prices on reconnect | `items-grid.tsx:20-70`; `watchlist/page.tsx:70` | Drop `closed/cancelled` on UPDATE; `mode` prop gating INSERT; `.subscribe(status)` → refetch on reconnect + "reconnecting" badge | S | — |
| 13 | `deleteItem` cascades bids; close without winner (§2.13) | One click destroys the money trail; no audit | `items/actions.ts:54`; `schema.ts:18`; new migration | Refuse delete when `bid_count > 0` (use `cancelled`); audit all three CRUD actions; `check (bid_count >= 0)` + closed-winner constraint | S | #1 |
| 14 | Detail page stale; dialog proposes losing bids (§2.14) | Every contested bid from the detail page is rejected | `history/[id]/page.tsx`; `bid-cta.tsx`; `bid-dialog.tsx:61,74,88` | `onSuccess` → `router.refresh`; client wrapper subscribing the price panel; `reset()` on `minBid` change; map `place_bid` errors to plain text | M | — |
| 15 | `updateProfile` unvalidated; own `email` writable (§2.15) | Unbounded public display names; spoofed identity in audit view | `account/profile/actions.ts:9`; new migration | Reuse signup Zod schema; `check(length(display_name) <= 100)`; `revoke update (id, email, is_admin, created_at) on profiles from authenticated` | S | — |
| 16 | Users page counts over unbounded fetch (§2.16) | Silently wrong past 1,000 bids; 414 at a few hundred users | `admin/(protected)/users/page.tsx:20-36`; new migration | `user_bid_counts` view; `.range()` pagination on profiles; select only rendered columns | S | — |
| 17 | Webhooks only in dashboard (§2.17) | Any reset/restore silently kills notifications | new migration; `NOTIFICATIONS_SETUP.md` | `supabase_functions.http_request` triggers in a migration, carrying the secret header from #2; completion audit row | M | #2 |
| 18 | No error tracking | Production errors invisible | `app/error.tsx:17`; `next.config.ts`; Vercel env | Run the Sentry wizard already documented in `DEPLOY.md` | S | — |
| 19 | No tests, no CI (§7) | Concurrency, RLS, and anti-snipe guarantees unverified | new `.github/workflows/ci.yml`; `supabase/tests/`; `package.json` | Five tests in §7; job runs `biome check`, `tsc --noEmit`, `next build`, SQL suite | M | #1–#5 (two are their regression tests) |
| 20 | Email confirmation off; unverified sender | Anyone registers as any address (§2.3 entry ticket); corporate filters reject `resend.dev` | Supabase Auth settings; Resend dashboard; **`lib/auth/actions.ts:84`; `login-form.tsx:116`** | Enable confirmations; verify domain. **Coupled code change:** `signUpBidder` currently `redirect("/")`s unconditionally — with confirmations on, `signUp` returns `session: null` and the user lands on `/` logged out with no message. Return `{ ok: true, needsConfirmation: true }` and render a "check your email" state | S | — |

### P2 — Improve soon

21. `end_time` required when `open`; `end_time > start_time` refine; handle `cancelled` (§2.18).
22. `revoke execute on all functions in schema public from public`; regrant (§2.19).
23. Narrow the proxy matcher (§2.20).
24. `push_subscriptions` child table or JSONB path ops (§2.21).
25. Extract `lib/auction.ts` — `minNextBid`, `isExpired`, `formatUsd`, `STATUS_VARIANT`.
26. Delete `@tanstack/*`, `date-fns`; mount `ThemeProvider` or drop `next-themes` + `.dark` block.
27. `useTransition` in the six hand-rolled forms; `zodResolver` on the item form.
28. Keyboard-accessible cards/rows via `<Link>` overlay; remove the no-op pencil button.
29. `loading.tsx` for `/bidding` and `/history/[id]`; `generateMetadata` on item pages.
30. Rewrite `README.md`; refresh `ADMIN_SETUP.md` / `DEPLOY.md`.
31. Startup env validation; remove the hardcoded URL fallback in `next.config.ts`.
32. Image size guard; delete objects on remove and on item delete.
33. Map `place_bid` errors to plain sentences; generic messages for other raw errors.

### P3 — Nice to have

34. Move `_legacy/` to an archive branch/tag.
35. Promote 22 hex colours to tokens.
36. `/icon-192.png` + `manifest.json`.
37. One confirmation pattern (`Dialog`).
38. Paginate `bid_history` and the audit log; filter/search on the audit log.
39. Drop `items_item_no_idx` and `watchlist_user_id_idx` (duplicates); remove the second
    `items_categories_idx` declaration; remove `bid_history` from the realtime publication.
40. Falsy-check fixes, "Rank" relabel, winner name from `winner_user_id`, filtered item count,
    `aria-pressed` on filters, `role="timer"` on countdown, `global-error.tsx`.
41. Bid ceiling in `place_bid`.

### DON'T FIX

- **`place_bid()`.** Correct, verified safe against the cron. Leave it.
- **Denormalized `current_bid` / `bid_count` / `current_bidder_id`.** Deliberate, correct. Make every
  writer as careful as `place_bid`; do not remove the denormalization.
- **The flat page / action / migration layering.** No service layer, repositories, DTOs, or DI.
- **`server_time()` and its hook** (beyond the P2 reactive-`now` tweak).
- **Index tuning** and dropping the dead indexes for performance.
- **Vendored shadcn primitives** in `src/components/ui/`.
- **Manual memoization.** React Compiler is enabled.
- **`cache()`-wrapped auth queries.**
- **Rate limiting the bid path.** Platform limits plus `place_bid` validation suffice at this scale.
- **Splitting `history/[id]/page.tsx`.** Long but linear. Taste, not necessity.
- **The `FormRaw` / `ItemFormValues` split** in `item-form.tsx`. Sensible.
- **`count: "exact"`, cron cadence, `server_time` polling.**

---

# Final Verdict

**Overall score: 5/10**

**Current state.** A well-architected project with a concentrated set of serious defects — a much
better position than a mediocre project with no obvious bugs. The central decision, making Postgres
both the transactional authority and the security boundary, is correct and well executed where it
was executed deliberately. `place_bid()` handles the hardest problem in the system properly. The
schema is sound, type discipline is high, and the migration comments explain their reasoning
honestly, including their own past mistakes.

The failures cluster where the application layer assumed the database would cover for it. Admin
server actions delegate authorization to RLS, and RLS answers an unauthorized `UPDATE` with silence —
so they report success, do nothing, and forge an audit entry. The lifecycle assumes something acts on
`start_time`; nothing does. The admin override actions reproduce the read-modify-write pattern that
`place_bid` was specifically written to avoid, against the same table, in the same repository. And
the notification functions trust anyone holding the public anon key. Each is individually small.
Together they mean the system's central invariants are unenforced and fail quietly — the worst
property for a one-evening live event with nobody watching dashboards.

For its scale the project is neither over- nor under-engineered. What is missing is not architecture
but **verification**: no tests, no CI, no error tracking. The P0 list is about two days and requires
no redesign.

**Top 5 things to fix:**
1. **`requireAdmin()` in every admin action; treat zero rows as failure** — any bidder can call them
   today and forge the audit log.
2. **Close the two credential holes — shared-secret check at the top of both Edge Functions, and
   remove the service-role key from Vercel** — together ~30 minutes; today anyone can send "you
   won"/"you lost" from the charity's sender, and an RLS-bypass key sits in every Preview build.
3. **Own-row `profiles` policy + `public_profiles` view** — every signed-up user can export every
   donor's email and phone.
4. **`open_scheduled_auctions()` on the cron, with a distinct `paused` status** — nothing opens an
   auction; a paused one never closes.
5. **Move `cancelLastBid` / `forceClose` / `extend` into locking SQL functions** — they can
   permanently desynchronise `items` from `bid_history` and declare the wrong winner.

**Would you approve this for production?**
**WITH CONDITIONS** — after the six P0 items plus Sentry (P1 #18), about two to three days. Not
before. The design is sound enough to be worth fixing rather than reconsidering.

**Biggest architectural risk:** The authorization boundary lives only in the database, and the
database's rejection of an unauthorized write is *silent*. Every admin mutation is one policy
regression away from failing open with a success toast and a falsified audit trail.

**Biggest security risk:** `profiles_select_authenticated ... using (true)` — any signed-up user can
export every donor's name, email, phone and admin status in one request, and tie it to complete
bidding histories via the public bidder UUIDs. Close second: the forgeable Edge Function webhooks.

**Biggest maintainability risk:** Minimum-bid logic in four layers and currency formatting in six
files, with drift already visible on the bid dialog. The auction's core business rule has no single
home.

**What NOT to waste time on:** Refactoring `place_bid()` or the denormalized bid columns. Introducing
a service layer, repositories, or DTOs. Adding `useMemo`/`useCallback`. Touching the vendored shadcn
primitives. Index tuning. Rate-limiting bids. Splitting the 390-line detail page. And do not rewrite
the frontend to fix the realtime bugs — they are two handler changes and a prop, not a redesign.
