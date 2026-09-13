# Database Schema Audit — Hand in Hand Charity Auction

**Date:** 2026-09-13
**Commit:** `d7b98f2` (level with `origin/main`)
**Scope:** The Postgres schema under `supabase/migrations/` and every code path that reads or
writes it (`src/`, `supabase/functions/`). Companion to `AUDIT.md` (the engineering audit of the
same commit). This document covers **only** the data model, constraints, concurrency and
database-level security; where `AUDIT.md` already owns a finding it is cross-referenced, not
repeated.

**Method.** Full read of all 12 migration files in order; every `.from()` / `.rpc()` call site in
the app and Edge Functions traced back to the table it touches (query map in §1.3); the
`bidder → item → place_bid → bid_history → close → winner` flow walked end-to-end; Postgres
semantics (`now()`, `FOR UPDATE`, READ COMMITTED re-check, cascade chains) reasoned from the SQL.

**Caveats.**
1. The audit is based on the **migration files**, not a dump of the live database. Drift between
   the two has already happened once (`20260517023358_add_categories.sql` was captured
   retroactively after a dashboard edit, and `20260517023500_lifecycle.sql` re-declares the same
   index). Run `supabase db diff --linked` before acting on anything here (§14).
2. No local Supabase was started; nothing was executed. Concurrency claims are from Postgres
   semantics, and G1 (`todo/G-tests-ci-ops.md`) should turn them into pgTAP tests.
3. There is no `supabase/seed.sql` (config references one) — no seed data to audit.

**Tag legend.** Every finding is tagged **[NEW]** (first raised here) or **[AUDIT §x / WS-Y]**
(already in `AUDIT.md` section x and owned by `todo/` workstream Y). Finding IDs are `DB-n`.

---

## Overall Database Health: **High Risk**

Three findings meet the Phase 10 definition of *Critical* (DB-1, DB-2, DB-3), and one of them
(DB-2) is reached through a **normal operational button** — "Cancel last bid" — not an exotic
path: every routine cancellation at the live event destroys a row of the historical record. That
is why the headline is High Risk rather than Needs Work, even though nothing is corrupt *today*.
`AUDIT.md`'s "would I deploy this today? No." stands from the database side as well.

The core is right: money is `numeric(12,2)`, every timestamp is `timestamptz`, bids are written
only by a `SECURITY DEFINER` function that takes a row lock, and the cron-close / `place_bid`
interleaving is correct under READ COMMITTED. The problems are at the edges of that core:

- the "append-only" bid log is **deletable** (by cascade from `auth.users` and `items`, and by any
  admin JWT directly), so a disputed result may not be reconstructible;
- the columns that *define* the auction result (`current_bid`, `winner_user_id`, …) are
  **writable by any admin JWT** with no requirement that they agree with `bid_history`;
- bid **ordering is not deterministic** under concurrency because `created_at` is transaction
  start time and nothing tie-breaks on `id`;
- the status model cannot express "paused", and no constraint stops `open` with no `end_time` or
  `closed` with an inconsistent winner (already in `AUDIT.md`, restated here at the schema level).

None of this requires a redesign. It is ~6 focused migrations plus adjustments to the already
planned workstream B.

---

## 1. Phase 1 — How the database is actually used

### 1.1 Objects that exist

| Kind | Name | Defined in |
|---|---|---|
| table | `profiles` | `…223001_schema.sql` |
| table | `items` | `…223001_schema.sql` (+ `categories` column `…023358`) |
| table | `bid_history` | `…223001_schema.sql` |
| table | `notification_prefs` | `…223001_schema.sql` |
| table | `audit_log` | `…223001_schema.sql` |
| table | `watchlist` | `…040002_watchlist.sql` |
| enum | `item_status` = scheduled, open, closed, cancelled | `…223001` |
| enum | `categories` = sport, hotel, food | `…023358` |
| fn (RLS) | `is_admin()` | `…223002_rls.sql` |
| fn (RPC) | `log_audit(...)` — anon + authenticated | `…223004` |
| fn (RPC) | `place_bid(uuid, numeric)` — authenticated | `…223007` |
| fn (RPC) | `server_time()` — anon + authenticated | `…023500` |
| fn (cron) | `close_expired_auctions()` — every minute | `…023500` |
| trigger | `touch_updated_at` on profiles/items/notification_prefs | `…223003` |
| trigger | `handle_new_user` on `auth.users` insert | `…223003`, `…223005` |
| trigger | `prevent_self_promotion` on `profiles` update | `…223003`, `…223006` |
| publication | `supabase_realtime` += items, bid_history | `…223008` |
| storage | bucket `item-images` (public read, admin write) | `…040001` |
| external | Database Webhooks → Edge Functions `on-bid-placed`, `on-auction-closed` | **dashboard only** (AUDIT §2.17 / WS-D) |

There is **no** `events`/`auctions` table, **no** `orders`/`payments` table, and **no** separate
`bidders` table. See §5 and §6 for whether that is a problem (short answer: no, with one
clarification).

### 1.2 The bid flow, end to end

```
Bidder (browser, anon key + user JWT)
  └─ BidDialog → supabase.rpc("place_bid", { p_item_id, p_amount })         [bid-dialog.tsx:67]
       └─ place_bid()  SECURITY DEFINER, one PostgREST transaction
            ├─ auth.uid() required
            ├─ SELECT items … FOR UPDATE            ← serialises all bids on this item
            ├─ status = 'open', start_time ≤ now() < end_time
            ├─ p_amount ≥ coalesce(current_bid + increment, starting_bid)
            ├─ anti-snipe: end_time − now() < 60s → end_time = now() + 60s
            ├─ UPDATE items SET current_bid, current_bidder_id, bid_count+1, end_time
            └─ INSERT bid_history (item, user, amount, previous_*, extended_end_time)
                 └─ Database Webhook (dashboard) → on-bid-placed → outbid email/push

pg_cron every minute
  └─ close_expired_auctions(): UPDATE items SET status='closed',
        winner_user_id = current_bidder_id, winning_bid = current_bid
     WHERE status='open' AND end_time ≤ now()
       └─ Database Webhook → on-auction-closed → won/lost email/push

Admin (browser, user JWT with profiles.is_admin)
  ├─ items form → INSERT/UPDATE items (all columns incl. status/start/end)   [items/actions.ts]
  ├─ overrides → direct UPDATE items (status, end_time, winner_*)           [override-actions.ts]
  │             direct DELETE bid_history + UPDATE items (cancelLastBid)
  └─ users → UPDATE profiles.is_admin                                       [users/actions.ts]
```

Everything a bidder can do to auction state goes through `place_bid`. Everything an admin can do
goes through **direct table writes under RLS** — that asymmetry is the root of most findings below.

### 1.3 Query map (every call site → table → index used)

| Call site | Statement | Index |
|---|---|---|
| `bidding/page.tsx:24` | `items` where status in (open, scheduled) order by end_time | `items_status_idx` then sort |
| `bidding/page.tsx:29` | `watchlist` where user_id | PK prefix |
| `history/[id]/page.tsx:60` | `items` by id | PK |
| `history/[id]/page.tsx:62` | `bid_history` where item_id order by created_at desc, embed `profiles` | `bid_history_item_id_idx` ✔ |
| `bid-dialog.tsx:67` | `rpc place_bid` | PK (FOR UPDATE) |
| `use-server-time.ts:23` | `rpc server_time` | — |
| `watchlist/actions.ts` | `watchlist` select/insert/delete by (user_id, item_id) | PK |
| `watchlist/page.tsx:27` | `watchlist` where user_id embed `items` | PK prefix + items PK |
| `profile/actions.ts:20` | `profiles` update by id | PK |
| `notifications/actions.ts` | `notification_prefs` select/upsert/update by user_id (read-modify-write ×3) | PK |
| `admin/page.tsx:44-65` | `items` count by status; `bid_history` count by created_at ≥ 24h; `items` current_bid where open; `items` where open and end_time window; top 5 by bid_count; `profiles` count | `items_status_idx`; **no index on `bid_history(created_at)`**; `items_end_time_idx`; sort |
| `admin/items/page.tsx:14` | `items` all, order created_at desc | seq scan (fine) |
| `admin/items/actions.ts` | `items` insert / update all columns / delete by id | PK |
| `override-actions.ts` | `items` select+update by id (×3); `bid_history` newest by item_id (created_at only) + delete by id | PK; `bid_history_item_id_idx` |
| `users/page.tsx:21-29` | `profiles` all; `bid_history` where user_id in (…) | `bid_history_user_id_idx` |
| `users/actions.ts:15` | `profiles` update is_admin by id | PK |
| `audit-log/page.tsx:34` | `audit_log` order created_at desc limit 200 | `audit_log_created_at_idx` |
| `auth/actions.ts`, `override-actions.ts`, `users/actions.ts` | `rpc log_audit` | — |
| `queries.ts:24`, `auth/actions.ts:151` | `profiles` by id (own row) | PK |
| Edge `on-bid-placed` (service role) | `notification_prefs` by user_id; `items` by id | PK |
| Edge `on-auction-closed` (service role) | `bid_history` where item_id (user_id, amount); `notification_prefs` by user_id per recipient | `bid_history_item_id_idx` |
| Edge `_shared/push.ts` (service role) | `notification_prefs` select+update by user_id (read-modify-write) | PK |
| cron | `items` where status='open' and end_time ≤ now() | `items_status_idx` / `items_end_time_idx` |

---

## 2. Phase 2 — Table-by-table audit

### 2.1 `profiles`

| | |
|---|---|
| Purpose | Public-facing extension of `auth.users`; also carries the `is_admin` role flag. Single responsibility — OK. |
| PK | `uuid` = `auth.users.id`, `on delete cascade`. Correct choice (identity is the auth user). |
| FKs | Referenced by `items.current_bidder_id`, `items.winner_user_id`, `bid_history.user_id`, `bid_history.previous_bidder_id`, `notification_prefs`, `watchlist`, `audit_log.actor_id`. The **on-delete behaviour of those references is the problem** — see DB-1. |
| Constraints | None on `display_name` / `phone` length (WS-A5 adds them). `email` is a **copy** of `auth.users.email` with nothing syncing it — DB-9. |
| Indexes | `profiles_is_admin_idx` partial — unused (`is_admin()` is a PK lookup). Harmless. |
| Types | fine. |
| Status | `is_admin boolean` — a two-role model, adequate (§6). |
| RLS | `select` to all authenticated (**AUDIT §2.3 / WS-C**: exposes every donor's email + phone); `update own` (with no column restriction — WS-A5); `update admin`. No client insert/delete. |

### 2.2 `items`

| | |
|---|---|
| Purpose | Both the *lot* (name, sponsor, value, images, item_no) and the *auction* for that lot (window, status, increment, denormalised current/winning state). Two responsibilities in one table. **Acceptable** for a single-event platform where every lot is auctioned exactly once — see §5 — but note it is what makes "reuse this item next year" impossible without a split. |
| PK | `uuid` default `gen_random_uuid()`. Fine. `item_no integer unique` is the human lot number; nullable (multiple NULLs allowed) and **globally** unique, not per-event. |
| FKs | `current_bidder_id` / `winner_user_id` → `profiles` `on delete set null`. With DB-1 fixed this never fires for anyone who bid; leave as is. |
| Constraints | ✔ `starting_bid > 0`, `bid_increment > 0`, `end_time > start_time` (when both set). ✘ Missing: `bid_count >= 0`; `retail_value >= 0`; `status = 'open' ⇒ end_time is not null`; `status = 'closed' ⇒ winner_user_id/winning_bid agree with current_*`; `status <> 'closed' ⇒ winner_* is null`; `current_bid >= starting_bid`. DB-3, DB-6. |
| Indexes | `status`, `end_time`, `current_bid desc` (unused), `item_no` (**duplicate** of the unique constraint's index), `categories` (declared twice; filtering is client-side so unused). Hygiene only. |
| Types | `numeric(12,2)` for all money ✔. `image_urls text[]` ✔ (fine at this scale). `categories` is an **enum** with three values — DB-13. |
| Status | `scheduled/open/closed/cancelled`; "paused" is expressed by writing `scheduled` (**AUDIT §2.4 / WS-B1**). Contradictory states the schema currently allows: `open` + `end_time null` (never closes); `closed` + `winner_user_id null` + `current_bidder_id set` (form dropdown); `closed` + `end_time` in the future (force close — legitimate, but the UI then shows "Closes <future>"); `cancelled` + `winner_*` set. |
| Denormalised columns | `current_bid`, `current_bidder_id`, `bid_count`, `winner_user_id`, `winning_bid` are **derived from `bid_history`** but are ordinary columns that any admin JWT can `PATCH` via PostgREST, with no audit row and no requirement that a matching bid exists — DB-3. |
| RLS | public `select` (anon too — intended, the auction is public); insert/update/delete for `is_admin()`. |

### 2.3 `bid_history`

| | |
|---|---|
| Purpose | Append-only log of every accepted bid. The comment says "written by place_bid() only" and that is true for **inserts**. It is not true for deletes — DB-2. |
| PK | `bigint identity`. ✔ This is the only monotonic "accepted order" the table has — DB-4. |
| FKs | `item_id → items on delete cascade` (**deleting an item deletes its entire bid log** — AUDIT §2.13 adds an app-level guard; the DB-level fix is `restrict`, DB-1). `user_id → profiles on delete cascade` (**deleting a user deletes every bid they placed, including winning bids** — DB-1). `previous_bidder_id → profiles on delete set null` — fine once `user_id` is `restrict`. |
| Constraints | ✔ `amount > 0`. ✘ nothing ties `amount` to the item's rules — acceptable, `place_bid` is the only insert path and it checks the increment; keep it there. No uniqueness needed (two equal amounts on one item can only arise after a cancellation, which is legitimate). |
| Indexes | `(item_id, created_at desc)` ✔ used by the detail page, cancel, edge fn. `(user_id, created_at desc)` ✔ users page. **No `id` tiebreaker** in the index or in any `order by` — DB-4. |
| Types | `amount numeric(12,2)` ✔; `created_at timestamptz default now()` — server-set, client cannot supply it ✔ (no insert policy) — but `now()` is **transaction start**, DB-4. |
| Snapshot columns | `previous_bidder_id`, `previous_bid`, `extended_end_time` are point-in-time snapshots used by the outbid notification and by cancellation rollback. Fine as snapshots; they become stale after any cancellation, which is why the recompute in WS-B2 must read live rows, not these. |
| RLS | public `select` (anon too) — exposes `user_id` UUIDs and `previous_bidder_id`; fine once WS-C hides `profiles` PII (bidder UUIDs alone reveal nothing). **`delete` for admins** — this is the policy that breaks append-only, DB-2. No insert/update policy ✔. |
| Realtime | in `supabase_realtime` — every bid row is broadcast to every connected client (Z-deferred: nothing subscribes to it; remove). |

### 2.4 `notification_prefs`

| | |
|---|---|
| Purpose | Opt-in flags + Web Push subscription objects. Two concerns (prefs + device registry) in one row. |
| PK | `user_id` (1:1 with profiles), cascade ✔. |
| Constraints | none needed. |
| Types | `push_subscriptions jsonb` array of `{endpoint, keys{p256dh, auth}}`. Read-modify-written from three places (**AUDIT §2.21**); a child table `push_subscriptions(endpoint pk, user_id, keys, created_at)` would make add/remove single-statement and let the Edge Function prune by `delete where endpoint in (...)`. Nice-to-have, DB-14. |
| RLS | own select/insert/update ✔. `notification_prefs_select_admin` — **no admin page reads this table** (grep: zero hits under `src/app/admin`); it exposes per-device push encryption keys (`p256dh`/`auth`) to admins for no purpose. Remove — DB-18 (Low). |

### 2.5 `audit_log`

| | |
|---|---|
| Purpose | Admin actions + auth events. OK. |
| PK | `bigint identity` ✔. |
| FKs | `actor_id → profiles set null` ✔ (audit rows must outlive the actor). `target_id text` polymorphic — fine for a log. |
| Indexes | four; only `created_at desc` is used by the one reader. Harmless. |
| Writes | only via `log_audit` (SECURITY DEFINER, **granted to anon** — AUDIT §2.8 / WS-B4) and, after WS-B2, directly from the override functions. |
| Gap | The three item CRUD actions and `deleteItem` write nothing (AUDIT §2.13 / WS-A2). Bid *inserts* are not audited here (they are in `bid_history`, correct); bid *deletes* are audited only by the app after the fact — with soft-cancel (DB-2) the cancellation record lives on the bid row itself. |

### 2.6 `watchlist`

| | |
|---|---|
| Purpose | Per-user starred items. Clean. |
| PK | composite `(user_id, item_id)` ✔ prevents duplicates. |
| FKs | cascade both sides ✔ (a watch has no historical value). |
| Indexes | `watchlist_user_id_idx` is a redundant prefix of the PK; `watchlist_item_id_idx` is useful for the item-side cascade. |
| RLS | own select/insert/delete ✔. `toggleWatchlist` does select-then-insert; a double-tap races into a PK violation surfaced as a raw error string — the button is disabled while busy (AUDIT rejected this as negligible; agreed). |

### 2.7 Functions, triggers, privileges

- `place_bid` — reviewed in §3. Correct core; three refinements (DB-4, DB-5, DB-16).
- `close_expired_auctions` — single atomic `UPDATE … WHERE status='open' AND end_time <= now()`.
  Under READ COMMITTED, if `place_bid` holds the row lock and extends `end_time`, the cron's
  `UPDATE` re-evaluates its `WHERE` against the new row version after the lock is released and
  skips it. If the cron commits first, `place_bid`'s `SELECT … FOR UPDATE` returns the closed
  version and rejects. **Correct** (AUDIT §6 "provably correct" — confirmed).
- `is_admin()` — `stable security definer`, PK lookup. Used bare in policies; wrapping as
  `(select public.is_admin())` lets the planner run it once per statement instead of per row.
  Low, cosmetic at this row count.
- `log_audit` — AUDIT §2.8 / WS-B4.
- `handle_new_user` — `security definer`, inserts `profiles` + `notification_prefs`. If a future
  `profiles` CHECK (WS-A5 lengths) rejects the metadata, **signup fails** with an opaque error;
  A5 should `left(…, 100)` in the trigger rather than let the constraint fire. Noted for WS-A.
- `prevent_self_promotion` — skipped when `auth.uid() is null` so SQL-editor bootstrap works.
  Reasonable; the trade-off (service-role callers bypass it) is documented in the migration.
- Default `EXECUTE` to `PUBLIC` on every function — AUDIT §2.19 / WS-B3.

---

## 3. Phase 3 — Bidding & concurrency audit

Scenario-by-scenario, with a verdict. "Protected at" says which layer actually enforces it today.

| # | Scenario | Verdict | Protected at | Notes |
|---|---|---|---|---|
| 3.1 | Two users bid on the same item at the same instant | **Safe** | DB (`FOR UPDATE` in `place_bid`) | Second txn blocks, re-reads the updated row, is validated against the *new* `current_bid`. Exactly one wins; the loser gets "Bid must be at least X". |
| 3.2 | How is the current highest bid determined? | **Safe, one source** | `items.current_bid` under the lock | Never recomputed from `bid_history` in the hot path — correct. But it is also **admin-writable without a bid** (DB-3). |
| 3.3 | Can two bids both become "the winner"? | **Structurally impossible** | schema | Winner is a single column pair on `items`. Nothing to add. |
| 3.4 | Can a lower bid overwrite a higher one? | **Not via `place_bid`**; **yes via admin** | DB for bidders; nothing for admins | `p_amount ≥ current + increment` inside the lock. `forceCloseItem` / `cancelLastBid` / the edit form can write any value (AUDIT §2.5, §2.9 / WS-B). DB-3 closes the direct-write path. |
| 3.5 | Is bid ordering deterministic? | **No** | — | `bid_history.created_at` defaults to `now()` = **transaction start**. A `place_bid` call that waits on the row lock keeps its pre-wait timestamp, so the bid accepted *second* can carry the *earlier* `created_at`. Every reader orders by `created_at desc` only (`history/[id]/page.tsx:66`, `override-actions.ts:118`), and the index is `(item_id, created_at desc)`. `id` (identity, assigned at `INSERT` time i.e. *after* the lock) is the only monotonic accepted-order. **DB-4.** |
| 3.6 | Is server/database time used? | **Yes** | DB | `now()` in `place_bid`; `server_time()` RPC for client countdowns; the client clock is only used for display. But `v_now` is transaction start, so a bid that waited on the lock is judged against the window/anti-snipe using a time that is slightly *earlier* than when it was actually processed (favours the bidder by the lock wait, typically ms). `clock_timestamp()` after the lock removes the question — DB-4. |
| 3.7 | Can the client manipulate timestamps? | **No** | DB | No insert policy on `bid_history`; `created_at` is a default the client cannot reach. |
| 3.8 | Duplicate request → duplicate bid? | **No (by construction)**, with a UX caveat | DB | A retried `place_bid` with the same amount sees `current_bid = amount` and is rejected by the increment rule. No duplicate row is possible. The user, however, sees an error for a bid that succeeded; WS-E6's error mapping + refresh handles the UX. No idempotency key needed. |
| 3.9 | Idempotency strategy | none, none needed | — | See 3.8. Add one only if a future "max bid / proxy bidding" feature makes equal-amount retries valid. |
| 3.10 | Bid after the auction closes | **Blocked** | DB | `status <> 'open'` and `now() >= end_time` checked inside the lock; direct `INSERT` blocked by RLS (no policy). Between `end_time` and the cron tick the item is `open` but `place_bid` still rejects by time. ✔ |
| 3.11 | Bid on an inactive / nonexistent item | **Blocked** | DB | `P0002` not found; status check. ✔ |
| 3.12 | Bid on an item the user is not allowed to bid on | **No such concept** | — | Any authenticated user may bid on any open item; there is no allow-list, no verified-contact requirement, and **no way to block an abusive bidder** short of deleting their auth user — which today cascades away their bids (DB-1). DB-17 recommends a `profiles.can_bid` flag checked in `place_bid`. |
| 3.13 | Bidder outbids themselves | **Allowed, deliberately** | — | UI labels it "Raise your bid"; `on-bid-placed` skips the notification when `previous_bidder_id = user_id`. It raises the price with no competitor. Open question OQ-3; if disallowed it is one `if` in `place_bid` (DB-16). |
| 3.14 | Absurd amount (typo: $100000 instead of $1000) | **Accepted** | — | No ceiling. Only remedy is admin cancel, which today is broken (AUDIT §2.5) and destructive (DB-2). DB-5. |
| 3.15 | Anti-snipe race with cron close | **Safe** | DB | See §2.7. |
| 3.16 | `bid_count` lost update | **Safe in `place_bid`** (`bid_count + 1` in SQL under lock); **unsafe in `cancelLastBid`** (JS arithmetic) | AUDIT §2.5 / WS-B2 | After DB-2 (soft cancel), define `bid_count` = count of non-cancelled bids and recompute inside the function. |
| 3.17 | Deadlock between `place_bid`, cancel, cron | **No** | — | All three lock the `items` row first, then touch `bid_history`. Consistent lock order. WS-B2's functions must keep that order (lock `items` before reading/updating `bid_history`). |

**Where each protection belongs** (current → recommended):

| Rule | Today | Recommended |
|---|---|---|
| min increment, window, status | `place_bid` ✔ | keep |
| ordering / tiebreak | nowhere | `order by id` contract + index (DB-4) |
| ceiling | nowhere | `place_bid` (DB-5) |
| derived columns agree with bid log | nowhere | column privileges + CHECKs + SQL functions (DB-3, WS-B2, WS-B5) |
| bid log immutability | RLS (no insert/update) but admin delete allowed | drop delete policy; soft-cancel via function (DB-2) |
| history survives user/item deletion | cascade (destroys it) | `on delete restrict` (DB-1) |
| admin overrides atomic | app, 3–4 round trips | SQL functions with `FOR UPDATE` (WS-B2) |

---

## 4. Phase 4 — Historical integrity

> If the event is over and someone disputes the result, can we reconstruct exactly what happened?

What is preserved per bid: bidder (`user_id`), amount, server time (`created_at`), item, the
bidder they displaced and at what price, whether the bid triggered an extension. Good.

What is **not** preserved:

1. **Cancelled bids are physically deleted** (`bid_history_delete_admin` + `cancelLastBid`;
   WS-B2 as written keeps the delete). The only trace is an `audit_log` row written by the app
   *after* the delete, containing `cancelled_bid_id` and `cancelled_amount` — not the bidder, not
   the timestamp. A dispute of the form "I was the high bidder and my bid disappeared" cannot be
   answered from the database. **DB-2.**
2. **Deleting a user deletes their bids** (cascade chain `auth.users → profiles → bid_history`).
   The item keeps `current_bid = $500`, `bid_count = 7`, `current_bidder_id = null` — a price
   with no bidder and a count that no longer matches the log. **DB-1.**
3. **Deleting an item deletes its bids** (cascade). AUDIT §2.13 / WS-B6 adds an app-side guard;
   the DB should refuse regardless. **DB-1.**
4. **Ordering cannot be trusted under concurrency** — the "who bid first at this amount" question
   (which matters exactly when an admin cancels the top bid) has no reliable answer today. **DB-4.**
5. **Winner is not tied to a bid row.** `winner_user_id` + `winning_bid` are copied from
   `current_*` at close; there is no `winning_bid_id → bid_history.id`. With DB-1/DB-2/DB-3 in
   place the copy is trustworthy; a nullable `winning_bid_id` FK would make the link explicit and
   is cheap. Nice-to-have (DB-19).
6. **The event itself is not recorded** — there is no row that says "the 2026 gala ran from
   19:00 to 22:00 in Bangkok". Fine for one event; see §5.

Recommendation is explicit: **do not overwrite or delete historical bids to maintain the current
highest bid.** `items.current_*` is the cache; `bid_history` (with `cancelled_at`) is the truth.

---

## 5. Phase 5 — Event / Item modelling

The model is **single-event-implicit**: there is no `events` table; every `items` row is one lot
auctioned once, with its own `start_time`/`end_time`. This is the right simplification for one
charity evening and should **not** be changed now. The audit records the consequences so the
decision is deliberate:

| Question | Current answer | Consequence |
|---|---|---|
| Can an item belong to multiple events? | No — lot and auction are one row. | Reusing the platform next year means either a fresh database or last year's closed lots stay in `/admin/items` and in bidder histories forever. |
| Is item numbering scoped to an event? | No — `item_no` is **globally unique** (and nullable). | Next year's "Lot 1" collides with this year's. First real trigger for an `events` table. |
| Can an item be withdrawn? | `status = 'cancelled'` — exists, notifies nobody (AUDIT §2.18 / WS-D5). | OK. |
| Can the event be cancelled? | No event → no. Per-item cancel only (300 clicks). | Open question OQ-1. |
| Bidding windows | per-item `start_time` / `end_time`, `timestamptz`, `end > start` CHECK. | Correct. Nothing opens them (AUDIT §2.4 / WS-B1). `open` with `end_time NULL` is allowed (AUDIT §2.18) — add a CHECK (DB-6). |
| Time zones | all `timestamptz`; form uses `datetime-local` → `toISOString()` in the admin's browser zone. | Correct storage. Entry ambiguity if an admin edits from a different zone than the venue — document the venue zone on the form (Low, WS-F). |
| Different rules per item | per-item `bid_increment`, `starting_bid`. Anti-snipe window is a constant (60 s) in `place_bid`. | Adequate. If organisers want a per-item or global setting, add `items.anti_snipe_seconds` later — not now. |
| Currency | none stored; DB default `bid_increment = 500` (the legacy Firestore data was in THB with ฿500 steps) vs form default `10` vs UI hard-coded `USD`. | Open question OQ-2. Align the DB default with the form default once the currency is confirmed. |
| Categories | enum `categories('sport','hotel','food')` on a column also named `categories`. | The legacy sample lots (teak bowl, painting, silk scarf, coffee basket) fit none of these. Changing an enum is a migration + type regen; `text` + a `check (categories in (...))` or a tiny lookup table is easier to extend. Low, DB-13, OQ-4. |

**Recommendation:** keep the model. Document the "one database per event" assumption in
`README.md` (WS-G6), and add the `events` table only when a second event is actually planned.

---

## 6. Phase 6 — User / bidder modelling

One table (`profiles`) and one boolean (`is_admin`) cover: **user** (any auth account),
**bidder** (any user who calls `place_bid`), **admin** (`is_admin`), **winner**
(`items.winner_user_id`). No separate tables are warranted — a bidder *is* a user, and "event
participant" has no meaning without an events table.

Gaps that are about the *model*, not the tables:

- **Roles are safe enough.** `is_admin` cannot be self-set (trigger); admins can promote others;
  the trigger is bypassed when `auth.uid()` is null (bootstrap) — acceptable and documented. No
  "super-admin" vs "volunteer" split; fine for a handful of organisers.
- **Winner contactability is not guaranteed.** `profiles.phone` is nullable, `email` is a copy,
  and email confirmation is off in `config.toml`. The legacy app required email + phone on every
  bid. Whether a bidder must have a verified email / a phone before `place_bid` accepts them is a
  business decision — OQ-5. If yes: enforce in `place_bid` (one `select` on `profiles`), not in
  the form.
- **No way to block a bidder** (DB-17). At a live event, "someone is placing joke bids" needs a
  one-click answer that is not "delete the account and lose their bids".
- **`profiles.email` drifts from `auth.users.email`** (DB-9). Edge Functions read the authoritative
  one via `auth.admin.getUserById`; the admin users page reads the copy. WS-D4 proposes switching
  the Edge Functions to `profiles.email` for batching — that would codify the stale copy unless a
  sync trigger lands first.

---

## 7. Phase 7 — Security (RLS + privileges)

Effective access matrix **today** (from the policies as written):

| Object | anon | bidder (authenticated) | admin (`is_admin`) | Notes |
|---|---|---|---|---|
| `profiles` | — | **SELECT all rows** (email, phone, is_admin); UPDATE own row, any column except `is_admin` | SELECT all; UPDATE any | AUDIT §2.3 / WS-C, §2.15 / WS-A5 |
| `items` | SELECT | SELECT | INSERT/UPDATE/DELETE **any column** incl. `current_bid`, `bid_count`, `winner_*` | **DB-3**: derived columns need column-level `REVOKE UPDATE` |
| `bid_history` | SELECT | SELECT | SELECT; **DELETE** | **DB-2**: drop the delete policy |
| `notification_prefs` | — | own row | own row + SELECT all (unused, leaks push keys) | DB-18 |
| `audit_log` | — | — | SELECT | ✔ |
| `watchlist` | — | own rows | own rows | ✔ |
| `place_bid` | callable (rejected by `auth.uid() is null`) | ✔ | ✔ | AUDIT §2.19 / WS-B3 |
| `log_audit` | **callable, forgeable** | ✔ | ✔ | AUDIT §2.8 / WS-B4 |
| `close_expired_auctions` | **callable** (default PUBLIC execute) | callable | callable | AUDIT §2.19 / WS-B3 |
| `server_time`, `is_admin` | callable | callable | callable | harmless |
| storage `item-images` | read | read | write | ✔ |
| Realtime `items`, `bid_history` | full rows | full rows | full rows | mirrors SELECT; fine |

Answers to the Phase 7 checklist:

- **Who can create bids** — only `place_bid` (SECURITY DEFINER); no insert policy. ✔
- **Who can modify bids** — nobody can UPDATE ✔; admins can DELETE via PostgREST with no audit
  row ✘ (DB-2).
- **Who can close events** — admins by direct UPDATE (no transition guard) ✘; cron ✔; **anyone**
  can *invoke* the cron function early (AUDIT §2.19).
- **Who can modify winning status** — any admin JWT, any value, no bid required ✘ (DB-3).
- **Can users modify another user's records** — profiles: no (own-row `USING`); prefs/watchlist:
  no ✔. Reading is the problem (WS-C).
- **Sensitive exposure** — donor email/phone (WS-C); push keys to admins (DB-18); bidder UUIDs are
  public but meaningless once WS-C lands.
- **Direct table access** — the browser holds the anon key + user JWT; PostgREST is the API. All
  of the above applies to `curl`, not just the UI. "Hiding the button" protects nothing here, and
  the admin override actions are exactly buttons in front of unrestricted table writes.

Column-level privileges (DB-3, WS-A5) and function grants (WS-B3) are the two missing tools.
Both are one-line Postgres statements; neither needs a schema change.

---

## 8. Phase 8 — Performance

Assumed scale (from `AUDIT.md`): ~300 items, ~3,000 bids, 50–500 concurrent clients, one evening.
At this scale nothing here is a bottleneck; the notes are for correctness of the index contracts.

| Hot query | Supported? | Note |
|---|---|---|
| current highest bid | `items` PK read ✔ | denormalised; correct |
| bids for an item, newest first | `bid_history_item_id_idx (item_id, created_at desc)` ✔ | change to `(item_id, id desc)` or append `id desc` when DB-4 lands; the planner uses either |
| active items | `items_status_idx` ✔ | a partial index `(end_time) where status = 'open'` would serve both the cron and the closing-soon query; unnecessary below ~10k items |
| a user's bids | `bid_history_user_id_idx` ✔ | |
| leaderboard / top by bid_count | sort over ≤ 300 rows | fine |
| determine winners (cron) | `status` + `end_time` ✔ | |
| bids in last 24h (dashboard) | **no index on `created_at`** | seq scan over 3k rows — ignore until 100k |
| users page bid counts | AUDIT §2.16 / WS-F1 (view) | correctness, not perf |
| `is_admin()` in every admin policy | PK lookup per row | wrap as `(select is_admin())` if admin list pages ever slow down |

Unused / duplicate indexes: `items_item_no_idx` (dup of unique), `watchlist_user_id_idx` (PK
prefix), `items_current_bid_idx`, `items_categories_idx` ×2 declaration, `profiles_is_admin_idx`,
three of four `audit_log` indexes. Drop the two duplicates for hygiene when a migration is next
written; leave the rest (Z-deferred P3 already lists this).

Realtime fan-out (`bid_history` in the publication with no subscriber) is the one thing that
scales badly; remove it from the publication (Z-deferred).

---

## 9. Phase 9 — Normalisation vs practicality

| Thing | Verdict |
|---|---|
| `items.current_*` / `bid_count` / `winner_*` denormalised from `bid_history` | **Keep.** Deliberate read-path cache maintained under a row lock. Just make it *unwritable* except by the functions that maintain it (DB-3). |
| `bid_history.previous_*` snapshots | **Keep.** Needed by the outbid notification without a second query. Never use for rollback (WS-B2 recomputes). |
| `profiles.email` copy of `auth.users.email` | **Sync or drop.** DB-9. |
| `image_urls text[]` | **Keep.** Ordered list, ≤ 3 URLs, never queried by element. |
| `notification_prefs.push_subscriptions jsonb[]` | **Child table** would be cleaner (atomic add/remove, prune by endpoint). Nice-to-have (DB-14). |
| `audit_log.metadata jsonb` | **Keep.** Free-form by nature. |
| `categories` enum | **`text` + CHECK** or lookup table would be easier to extend (DB-13). Low. |
| lot + auction in one `items` row | **Keep** until a second event exists (§5). |
| `watchlist` | correct as a junction table. |

No excessive joins; the only embed is `bid_history → profiles` on the detail page (moves to a
view in WS-C).

---

## 10. Phase 10 — Table matrix

| Table | Purpose | Problems | Severity | Recommendation |
|---|---|---|---|---|
| `bid_history` | Append-only accepted-bid log; the historical truth | Deletable by cascade from `profiles`/`items` and by admin DELETE policy (DB-1, DB-2); `created_at` = txn start, no `id` tiebreak in index or queries (DB-4); in realtime publication with no subscriber | **Critical** | `on delete restrict` on `user_id` and `item_id`; drop `bid_history_delete_admin`; add `cancelled_at / cancelled_by / cancel_reason`; canonical order = `id`; index `(item_id, id desc)` + partial on `cancelled_at is null` if needed; remove from publication |
| `items` | Lot + its auction; denormalised current/winning state | Derived columns writable by any admin JWT with no matching bid (DB-3); no CHECKs for `open ⇒ end_time`, `closed ⇒ winner consistent`, `bid_count ≥ 0` (DB-6 / WS-B5); "paused" overloads `scheduled` (WS-B1); `end_time` clobbered by generic edit form (WS-F4); duplicate/unused indexes; currency + defaults unclear (OQ-2); enum categories (DB-13) | **Critical** (DB-3) / High (constraints) | `REVOKE UPDATE (current_bid, current_bidder_id, bid_count, winner_user_id, winning_bid) ON items FROM authenticated` after WS-B moves overrides into SQL functions; CHECK constraints; `paused` enum value; optional `winning_bid_id` FK |
| `profiles` | Auth extension + role flag | All authenticated can read email/phone (WS-C); `email` unsynced copy (DB-9); own-row update allows `email` (WS-A5); no `can_bid` flag (DB-17); cascade from `auth.users` propagates into `bid_history` (DB-1) | High (WS-C) / Medium | own-row + admin select, `public_profiles` view (WS-C); sync trigger from `auth.users`; `can_bid boolean default true` checked in `place_bid` |
| `notification_prefs` | Opt-ins + push device registry | JSONB read-modify-write from 3 places (AUDIT §2.21); unused admin SELECT policy exposes push keys (DB-18) | Medium / Low | drop admin policy now; child `push_subscriptions` table later |
| `audit_log` | Admin + auth events | `log_audit` granted to anon and trusts caller email (WS-B4); CRUD/delete of items unaudited (WS-A2); no retention | High (WS-B4) | owned by B4/A2; nothing schema-level to add |
| `watchlist` | Starred items | redundant `user_id` index | Low | drop index at next migration |
| *(missing)* `events` | — | none needed for one event; `item_no` global uniqueness is the first thing that breaks with a second event | Low / OQ-1 | document; add only when a second event is planned |
| *(missing)* `orders` / `payments` | — | out of scope (legacy README: "no payment integration"); fulfilment is offline | — / OQ-6 | if organisers need "paid / collected" tracking, add two nullable columns on `items` (`paid_at`, `collected_at`) rather than a table |

---

## 11. Phase 11 — Relationship diagram

### Current

```text
auth.users (Supabase)
 └── profiles  (id = auth.users.id, ON DELETE CASCADE)
      ├── items.current_bidder_id      (SET NULL)
      ├── items.winner_user_id         (SET NULL)
      ├── bid_history.user_id          (CASCADE)   ← destroys bid history
      ├── bid_history.previous_bidder_id (SET NULL)
      ├── notification_prefs.user_id   (CASCADE, 1:1)
      ├── watchlist.user_id            (CASCADE)
      └── audit_log.actor_id           (SET NULL)

items  (lot + auction, one row; no parent event)
 ├── bid_history.item_id   (CASCADE)   ← destroys bid history
 ├── watchlist.item_id     (CASCADE)
 └── [denormalised] current_bid, current_bidder_id, bid_count,
                    winner_user_id, winning_bid   ← no FK to the winning bid row

bid_history  (id bigint identity; created_at = txn start)
 ├── user_id → profiles
 ├── item_id → items
 └── previous_bidder_id → profiles
```

### Recommended (delta only — no new tables required now)

```text
auth.users
 └── profiles  (+ can_bid boolean; email kept in sync by trigger)
      ├── bid_history.user_id          RESTRICT   ← a user with bids cannot be deleted
      ├── items.current_bidder_id      SET NULL   (unreachable once user_id is RESTRICT)
      ├── items.winner_user_id         SET NULL   (same)
      └── … unchanged

items
 ├── bid_history.item_id   RESTRICT   ← an item with bids cannot be deleted; cancel it instead
 ├── status: scheduled | open | paused | closed | cancelled
 ├── CHECK  status='open'  ⇒ end_time IS NOT NULL
 ├── CHECK  status='closed' ⇒ winner_user_id IS NOT DISTINCT FROM current_bidder_id
 │                          AND winning_bid IS NOT DISTINCT FROM current_bid
 ├── CHECK  status<>'closed' ⇒ winner_user_id IS NULL AND winning_bid IS NULL   (see OQ-7)
 ├── CHECK  bid_count >= 0
 ├── [derived columns] UPDATE revoked from `authenticated`; written only by
 │     place_bid / cancel_bid / force_close_item / close_expired_auctions
 └── (optional) winning_bid_id → bid_history.id

bid_history  (append-only, for real)
 ├── + cancelled_at timestamptz, cancelled_by uuid → profiles, cancel_reason text
 ├── no DELETE policy; no UPDATE policy; cancellation only via SQL function
 ├── canonical order: id  (index (item_id, id desc))
 └── "live" bids = WHERE cancelled_at IS NULL
```

---

## 12. Phase 12 — Current vs recommended schema

### Current schema (summary)

Six tables, two enums, four functions, three triggers, one cron job. Bidders write only through
`place_bid`; admins write tables directly under RLS. `bid_history` is the intended source of
truth but is deletable; `items` carries a derived cache that is freely writable. See §1–§2.

### Problems (concrete, from the codebase)

| ID | Finding | Tag | Severity |
|---|---|---|---|
| DB-1 | `bid_history.user_id` and `.item_id` are `ON DELETE CASCADE`; deleting an auth user or an item silently erases the bid log and leaves `items.current_*` orphaned | **[NEW]** | Critical |
| DB-2 | `bid_history` is not append-only: `bid_history_delete_admin` policy + `cancelLastBid` physically delete rows; WS-B2's planned `cancel_last_bid` keeps the delete | **[NEW]** (extends AUDIT §2.5) | Critical |
| DB-3 | `items.current_bid / current_bidder_id / bid_count / winner_user_id / winning_bid` are writable by any admin JWT via PostgREST with no bid and no audit | **[NEW]** (DB-level half of AUDIT §2.9/§2.13) | Critical |
| DB-4 | Bid ordering non-deterministic: `created_at` = transaction start; no `id` tiebreaker anywhere; `v_now` in `place_bid` predates the lock | **[NEW]** (AUDIT §2.5 mentions the tiebreaker in passing) | High |
| DB-5 | No bid ceiling in `place_bid`, and the only remedy (cancel) is both broken and destructive | **[Z-deferred P2 → elevated]** | High |
| DB-6 | No CHECK for `open ⇒ end_time`, `closed ⇒ consistent winner`, `not closed ⇒ no winner`, `bid_count ≥ 0`; `paused` overloads `scheduled` | **[AUDIT §2.4, §2.13, §2.18 / WS-B1, B5]** | High |
| DB-7 | All authenticated users read every profile's email/phone | **[AUDIT §2.3 / WS-C]** | High |
| DB-8 | Function EXECUTE defaults to PUBLIC; `log_audit` granted to anon | **[AUDIT §2.8, §2.19 / WS-B3, B4]** | High |
| DB-9 | `profiles.email` is an unsynced copy of `auth.users.email`; WS-D4 would start relying on it | **[NEW]** | Medium |
| DB-10 | Migration files are not known to match the live schema (drift confirmed once); duplicate `items_categories_idx` declaration | **[NEW]** | Medium |
| DB-11 | `notification_prefs.push_subscriptions` JSONB read-modify-write | **[AUDIT §2.21]** | Medium |
| DB-12 | Currency undefined; `bid_increment` DB default 500 vs form default 10 | **[NEW]** | Medium (clarify) |
| DB-13 | `categories` enum: three values, doesn't fit legacy lots, hard to extend | **[NEW]** | Low (clarify) |
| DB-14 | `push_subscriptions` should be a child table | **[AUDIT §2.21]** | Low |
| DB-15 | `bid_count` has no reconciliation path; definition changes with soft-cancel | **[NEW]** | Medium |
| DB-16 | Self-outbid allowed | **[NEW]** | clarify |
| DB-17 | No way to block a bidder without deleting their account | **[NEW]** | Medium |
| DB-18 | `notification_prefs_select_admin` unused; exposes push keys | **[NEW]** | Low |
| DB-19 | No `winning_bid_id` link from item to the winning bid row | **[NEW]** | Low |
| DB-20 | Duplicate / unused indexes; `bid_history` in realtime publication | **[Z-deferred P3]** | Low |

### Recommended changes

Each entry: **why · what it solves · code affected · migration risk · now or later**.

#### Must fix before production

**R1 — `bid_history` FKs to `ON DELETE RESTRICT`** (DB-1)
```sql
alter table public.bid_history
  drop constraint bid_history_user_id_fkey,
  add constraint bid_history_user_id_fkey
    foreign key (user_id) references public.profiles(id) on delete restrict,
  drop constraint bid_history_item_id_fkey,
  add constraint bid_history_item_id_fkey
    foreign key (item_id) references public.items(id) on delete restrict;
```
- Why: the bid log must outlive users and items. · Solves: silent history loss + orphaned
  `items.current_*`. · Code affected: `deleteItem` now gets a FK error for items with bids
  (WS-B6's app guard gives the friendly message first); deleting a user with bids from the
  Supabase dashboard fails — that is the desired behaviour; document "cancel, don't delete".
  **This removes the only account-deletion path for anyone who ever bid.** If the charity needs
  an erasure path (OQ-9), the replacement is *anonymisation*, not deletion: a
  `SECURITY DEFINER anonymise_profile(user_id)` that sets `display_name = 'Deleted bidder'`,
  `email = null`, `phone = null`, `can_bid = false`, deletes `notification_prefs` / `watchlist`,
  and leaves `profiles` + `bid_history` intact; the `auth.users` row can then be deleted only
  if `profiles.id` stops referencing it (i.e. drop that cascade and make `profiles` standalone)
  — **do not build this until OQ-9 is answered**.
  · Risk: **low** (no data change; only new rows/actions are refused). · **Now.**

**R2 — Soft-cancel bids; drop the admin DELETE policy** (DB-2, DB-15)
```sql
alter table public.bid_history
  add column cancelled_at  timestamptz,
  add column cancelled_by  uuid references public.profiles(id) on delete set null,
  add column cancel_reason text,
  add constraint bid_history_cancel_reason_required
    check (cancelled_at is null or nullif(trim(cancel_reason), '') is not null);
drop policy if exists bid_history_delete_admin on public.bid_history;
create index bid_history_item_live_idx
  on public.bid_history (item_id, id desc) where cancelled_at is null;
```
`cancel_last_bid` (WS-B2) becomes: lock `items` → pick newest **live** bid by `id desc` → set
`cancelled_*` → recompute `current_bid / current_bidder_id / bid_count` from live rows → roll back
`end_time` if `extended_end_time` was set → if closed, refresh `winner_*` → audit row. Never
`DELETE`.
- Why: Phase 4 — a dispute must be answerable from the database. · Solves: DB-2, and the
  `audit_log`-only trace. · Code affected: WS-B2 design (must change **before** B runs);
  `history/[id]/page.tsx` shows cancelled rows struck-through or filters `cancelled_at is null`
  (WS-C/E touch this file — coordinate); `on-auction-closed` loser query must filter live bids;
  users page counts. · Risk: **low** (additive columns). · **Now — and before WS-B.**

**R3 — Column-level privileges on derived `items` columns** (DB-3)
```sql
-- A column-level REVOKE is ineffective while the table-level UPDATE grant (Supabase default)
-- exists, so revoke the table grant and grant back only the editable columns:
revoke update on public.items from authenticated;
grant update (item_no, name, description, sponsor, retail_value, starting_bid, bid_increment,
              start_time, end_time, status, image_urls, categories)
  on public.items to authenticated;
```
- Why: the auction result must only change through a function that also writes a bid row / audit
  row under the lock. · Solves: DB-3 entirely; makes WS-B2 the *only* path. · Code affected:
  **breaks `override-actions.ts` as it exists today** (`forceCloseItem`, `cancelLastBid` write
  these columns directly) — must land **after** WS-B7 rewrites them to RPCs. `createItem` /
  `updateItem` are unaffected (`itemSchema` never includes these keys; PostgREST only sets the
  keys sent). `SECURITY DEFINER` functions run as owner and are unaffected. · Risk: **medium**
  purely from ordering. · **Now, sequenced after B.**

**R4 — Deterministic ordering** (DB-4)
```sql
-- place_bid: after `for update`, use the wall clock, not transaction start
v_now := clock_timestamp();
-- bid_history.created_at: same semantics so the column is monotonic per item
alter table public.bid_history alter column created_at set default clock_timestamp();
-- index contract
drop index if exists bid_history_item_id_idx;
create index bid_history_item_id_idx on public.bid_history (item_id, id desc);
```
And every reader orders `by id desc` (`history/[id]/page.tsx:66`, WS-B2 functions, WS-F views).
`created_at` stays the display timestamp.
- Why: the accepted order must be reconstructible; cancel-last-bid must pick the right row.
  · Code affected: one `order()` call in the detail page (WS-C/E own the file; one-line change),
  B2 SQL, F1 views. · Risk: **low**; `clock_timestamp()` is non-transactional but every use here is
  inside a row lock. · **Now.**

**R5 — Bid ceiling in `place_bid`** (DB-5)
```sql
-- sanity cap, not a business rule: 10× the minimum or +10,000 above it, whichever is larger
if p_amount > greatest(v_min_bid * 10, v_min_bid + 10000) then
  raise exception 'Bid exceeds the maximum allowed jump (%)', greatest(...) using errcode = '22023';
end if;
```
Pick the multiplier with the organisers (OQ-2 currency matters here). · Code affected:
`bid-dialog.tsx` error mapping (WS-E6). · Risk: **low**. · **Now** (one `if`).

**R6 — `items` CHECK constraints + `paused`** (DB-6) — owned by **WS-B1 / B5**; this audit adds
two constraints to B5's list and one open question:
```sql
alter table public.items
  add constraint items_open_requires_end_time
    check (status <> 'open' or end_time is not null),
  add constraint items_winner_only_when_closed
    check (status = 'closed' or (winner_user_id is null and winning_bid is null)),
  add constraint items_closed_winner_consistent
    check (status <> 'closed'
           or (winner_user_id is not distinct from current_bidder_id
               and winning_bid is not distinct from current_bid));
```
The third constraint permanently forbids "winner declined, runner-up wins" (OQ-7). If that
scenario is real, drop `items_closed_winner_consistent` and instead expose it through a
`reassign_winner(item_id, bid_id)` function that writes an audit row — do **not** leave the
columns free-form. Backfill closed rows before adding — and **`copy (select * from items where winner_user_id is
not null and status <> 'closed') to …` / dump those rows first**: the backfill nulls data.
Coupling for WS-B2: with `items_winner_only_when_closed`, moving a `closed` item to `cancelled`
must null `winner_user_id` / `winning_bid` **in the same statement**, so `cancel_item` (or the
edit form's status change) has to do that explicitly. · Risk: **medium** (existing rows may
violate; backfill first). · **Now (B5).**

**R7 — Drop `profiles`→`bid_history` PII path, function grants, `log_audit`** — **WS-C, B3, B4**;
nothing to add at the schema level.

**R8 — Drift gate** (DB-10)
`supabase db diff --linked` must be empty before the first new migration is applied; the diff
output (if any) becomes a "captured from dashboard" migration first. Add the same check to CI
(WS-G3) so it cannot recur. · Risk: none. · **Now, first.**

#### Nice to have

**N1 — `profiles.email` sync trigger** (DB-9)
```sql
create or replace function public.sync_profile_email() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end $$;
create trigger on_auth_user_email_updated after update of email on auth.users
  for each row execute function public.sync_profile_email();
```
Required **before** WS-D4 switches the Edge Functions to `profiles.email`; otherwise D4 should
keep `auth.admin.getUserById` (or `auth.admin.listUsers` batched). · Risk: low. · Soon.

**N2 — `profiles.can_bid boolean not null default true`** checked in `place_bid`; admin toggle
next to the `is_admin` switch; audit row on change (DB-17). Gives organisers a non-destructive
answer to an abusive bidder. **Must ship with `revoke update (can_bid) on public.profiles from
authenticated` in the same migration** — `profiles_update_own` has no column restriction and
WS-A5's revoke list does not include it, so without the revoke a blocked bidder re-enables
themselves with one `PATCH /rest/v1/profiles`. The same trap applies to *any* future flag on
`profiles`: `is_admin` is safe only because of the `prevent_self_promotion` trigger. · Risk: low.
· Before the event if there is time.

**N3 — `items.winning_bid_id bigint references bid_history(id)`** set by
`close_expired_auctions` / `force_close_item` / recomputed by `cancel_last_bid` (DB-19). Makes the
winner ↔ bid link explicit for disputes. · Risk: low. · Later.

**N4 — Drop `notification_prefs_select_admin`** (DB-18). One line. · Now-ish, zero risk.

**N5 — `push_subscriptions` child table** (DB-14) — with WS-D or after. · Medium effort.

**N6 — Index hygiene + remove `bid_history` from realtime publication** (DB-20). Z-deferred P3.

**N7 — `categories` → `text` + CHECK, rename column to `category`** (DB-13). Needs type regen;
bundle with whatever migration next touches the enum. · Later, pending OQ-4.

**N8 — Contact requirement in `place_bid`** (OQ-5) — only if the organisers say so.

**N9 — Wrap `is_admin()` as `(select public.is_admin())` in policies.** Cosmetic.

---

## 13. Open questions (need the organisers / owner, not code)

| # | Question | Why it matters | Default assumed by this audit |
|---|---|---|---|
| OQ-1 | Will this database be reused for a second event? | Decides whether `events` + per-event `item_no` uniqueness are needed. | No — one database per event; document it. |
| OQ-2 | What currency, and what are realistic bid sizes? (DB default increment 500, form default 10, UI "USD", legacy data looked like THB) | Sets the DB defaults, the ceiling multiplier (R5), and whether cents ever appear. | USD, whole dollars. |
| OQ-3 | May a bidder raise their own leading bid? | Currently allowed and labelled "Raise your bid"; raises the price with no competitor. | Keep allowed (it is deliberate UI). |
| OQ-4 | Are `sport / hotel / food` really the only categories? | Enum changes are migrations. | Expand to `text` + CHECK when the real list is known. |
| OQ-5 | Must a bidder have a verified email and/or a phone number before bidding? | Winner contactability; `phone` is nullable and confirmations are off locally. | Verified email required (WS-G5 turns confirmations on); phone optional. |
| OQ-6 | Is any "paid / collected" tracking needed after the event? | Two nullable columns vs nothing. | Nothing — offline fulfilment. |
| OQ-7 | If a winner declines, does the runner-up win? | Decides whether `items_closed_winner_consistent` is a hard constraint or needs a `reassign_winner` function. | Hard constraint now; add the function only if asked. |
| OQ-8 | Should a paused item that passes its `end_time` auto-close? | WS-B1 decided "no"; confirm with organisers. | No (stays paused; admin must resume+extend or force-close). |
| OQ-9 | Does the charity need a "delete my account" / erasure path for donors? | R1 makes deletion impossible for anyone who bid; the alternative is anonymisation (R1 notes). | No erasure path for this event; anonymisation function if ever needed. |

---

## 14. Migration considerations & dependencies

**Order of operations** (each bullet is one idempotent migration file unless noted):

```text
0. supabase db diff --linked  → empty, or capture drift first                (R8, WS-H pre-flight)
1. R1     bid_history FKs → restrict                              (WS-H1, prefix …09…, no dependency)
2. R2     bid_history soft-cancel columns + drop delete policy + live index   (WS-H2)
3. R4     bid_history.created_at default clock_timestamp(); index (item_id, id desc)   (WS-H3)
4. R5+R4  create or replace place_bid (clock_timestamp, ceiling, [can_bid], [self-outbid])   (WS-H4)
5. WS-B1  paused enum value            (own file; enum values can't be used in the same txn)
6. WS-B2  cancel_last_bid / force_close_item / extend_deadline / pause / resume
          — written against R2's soft-cancel and R4's `order by id`
7. WS-B5 + R6  items CHECK constraints (backfill closed rows first)
8. WS-B7  override-actions.ts → thin RPCs
9. R3     revoke update on derived items columns   (WS-H5, prefix …17…)  ← only after step 8
10. N1, N2, N4 as time allows; then WS-C, D, F as planned
11. Regenerate database.types.ts once (integration)
```

Migration file prefixes make this order deterministic at `supabase db reset`: H1–H4 use
`2026091309…` (before every other workstream), B uses `…11…`, F `…14…`, H5 `…17…`.

**Dependencies between workstreams introduced by this audit**

- **B2 must adopt R2 and R4** (soft-cancel, `order by id`) before it is implemented — a design
  change, not extra work.
- **R3 depends on B7** (otherwise the current override actions break at runtime, not compile time).
- **D4 depends on N1** if it switches to `profiles.email`; otherwise D4 keeps `auth.admin`.
- **C2 / E5** touch `history/[id]/page.tsx`; R4's `order by id` and R2's cancelled-row display are
  one-line changes in the same select — fold into C2.
- **F1's `user_bid_counts` view** must filter `cancelled_at is null` (R2).
- **G1 tests** to add: FK restrict (delete user with bids → error), soft-cancel leaves the row,
  ordering by `id` under two concurrent sessions, ceiling rejection, CHECK constraints.

**Data-migration risk**: only R6 (CHECKs) can fail on existing rows — backfill
`winner_* = current_*` for closed rows and null them for non-closed rows first, in the same
migration, and run it against a fresh `pg_dump`. Everything else is additive or refuses new
actions only.

**Rollback**: every change here is a `drop constraint` / `drop column` / `create policy` away;
none rewrites data except the R6 backfill (which is itself derivable from `bid_history`).

---

## 15. What is right and should stay

For completeness, because the phases ask and silence would imply doubt:

- `numeric(12,2)` for every monetary column; no floats anywhere.
- `timestamptz` everywhere; `server_time()` for client countdowns.
- `bid_history.created_at` is server-defaulted; there is no client insert path at all.
- `place_bid`: `SECURITY DEFINER` + `set search_path` + `SELECT … FOR UPDATE` + validation inside
  the lock + item update and log insert in one transaction. This is the correct shape.
- `close_expired_auctions` is one atomic statement and interleaves correctly with `place_bid`.
- `bid_count = bid_count + 1` in SQL (not read-modify-write) in `place_bid`.
- UUID PKs for user-facing rows, `bigint identity` for log rows.
- `watchlist` composite PK; `profiles.id = auth.users.id`.
- `prevent_self_promotion` and the no-insert / no-update policies on `bid_history` and `audit_log`.
- Single-event, single-`items`-table model for a one-evening charity auction.
