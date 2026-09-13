# D — Edge Functions & notifications

**AUDIT refs:** §2.2 (P0 #2), §2.6 (P0 #6), §2.11 (P1 #11), §2.17 (P1 #17), §2.21
**Wave:** 1 · **Complexity:** M · **Migration prefix:** `2026091313MMSS`

## Goal

Nobody but the database can invoke the notification functions. Closing an item notifies each
person exactly once, fast enough to survive a mass close. The webhooks live in version control.
The service-role key leaves the Next.js deployment surface.

## Files you own

- `supabase/functions/on-bid-placed/index.ts`
- `supabase/functions/on-auction-closed/index.ts`
- `supabase/functions/_shared/*.ts`
- `supabase/functions/_shared/auth.ts` (new)
- `supabase/migrations/2026091313MMSS_*.sql` (new)
- `.env.example`, `DEPLOY.md`, `NOTIFICATIONS_SETUP.md`
- `src/app/account/notifications/actions.ts` — **only** endpoint validation in
  `savePushSubscription`.

Read-only: `supabase/migrations/20260516223001_schema.sql`, `supabase/config.toml`.

## Tasks

### D1 — Shared-secret gate (`_shared/auth.ts`)
```ts
export function requireWebhookSecret(req: Request): Response | null
```
Compares `req.headers.get("x-webhook-secret")` to `Deno.env.get("WEBHOOK_SECRET")` with a
constant-time comparison (`crypto.subtle.timingSafeEqual` on encoded bytes, or a manual loop).
Missing env var → always 500 (fail closed). Call it as the **first** statement in both handlers,
after the OPTIONS check. Remove `Access-Control-Allow-Origin: *` from `_shared/cors.ts` — these are
server-to-server; return no CORS headers at all and delete the OPTIONS branch.

### D2 — Trust the DB, not the payload
Both functions: after validating `payload.type`/`table`, use only `payload.record.id` (and
`old_record.status` for the transition check). Re-read the row from the database with the
service-role client before acting. Never use `record.name`, `record.winner_user_id`,
`record.winning_bid` from the payload.

### D3 — Idempotency (migration `…_items_notified_at.sql`)
`alter table public.items add column if not exists notified_at timestamptz;`
In `on-auction-closed`, first write: `update items set notified_at = now() where id = $1 and
notified_at is null` with `.select("id")`; if zero rows → return 200 "already notified". Do this
**before** any send.

### D4 — Batched fan-out
`on-auction-closed`: replace the per-user `getUserById` + prefs select with
- one `profiles.select("id, email").in("id", allUserIds)` (service role bypasses RLS — fine),
- one `notification_prefs.select("user_id, email_optin, push_optin, push_subscriptions").in(...)`.
Then send with bounded concurrency (a simple pool of 5) using `Promise.allSettled`. Winner first.
Keep the "highest bid per loser" logic. Log a summary line `{ item_id, won: 1, lost: N, email_ok,
email_fail, push_ok, push_fail }`. Same batching pattern in `on-bid-placed` is unnecessary (one
recipient) — leave it, just apply D1/D2.

### D5 — Handle `cancelled`
`on-auction-closed`: treat `open|paused → cancelled` as a notifiable transition: one email/push to
every distinct bidder, "This auction was cancelled by the organisers." Add `cancelledEmail` to
`_shared/email.ts`. Same `notified_at` guard.

### D6 — Webhooks as migration (`…_notification_webhooks.sql`)
Use the `supabase_functions.http_request` trigger form (this is what the dashboard creates):
```sql
create extension if not exists pg_net;
-- bid placed
create or replace trigger on_bid_placed_webhook
  after insert on public.bid_history for each row
  execute function supabase_functions.http_request(
    'https://<project-ref>.supabase.co/functions/v1/on-bid-placed',
    'POST',
    '{"Content-Type":"application/json","x-webhook-secret":"<vault>"}',
    '{}', '5000');
```
The secret must not be a literal in the migration. Read it from Vault:
`(select decrypted_secret from vault.decrypted_secrets where name = 'webhook_secret')` — build the
headers JSON with `format()` inside a `do $$` block that creates the trigger dynamically. Document
the one-time `select vault.create_secret('<value>', 'webhook_secret')` in `NOTIFICATIONS_SETUP.md`.
The `items` trigger must fire **only** on status change: `after update of status on public.items
for each row when (old.status is distinct from new.status)`.
If `supabase_functions.http_request` is unavailable locally, fall back to `pg_net.http_post` with
the same condition, and say so in your report.

### D7 — Push endpoint validation
`savePushSubscription`: accept `endpoint` only if its host ends with one of
`push.apple.com`, `fcm.googleapis.com`, `updates.push.services.mozilla.com`,
`notify.windows.com`, `push.services.mozilla.com`, `web.push.apple.com` (and `wns2-*.notify.windows.com`).
Reject otherwise with `{ ok:false, error:"Unsupported push service" }`.

### D8 — Docs & secrets
- `DEPLOY.md` §3: delete the `SUPABASE_SERVICE_ROLE_KEY` row; add a note: "Never add the service
  role key to Vercel — nothing in the Next.js app uses it. If it was ever added, rotate it."
- `.env.example`: remove `SUPABASE_SERVICE_ROLE_KEY`; add `WEBHOOK_SECRET` under the Edge Function
  secrets section with `openssl rand -hex 32` as the generation hint.
- `NOTIFICATIONS_SETUP.md`: replace the manual dashboard webhook steps with the migration +
  Vault secret steps; mention `supabase secrets set WEBHOOK_SECRET=…`.

## Acceptance criteria

- [x] `curl -X POST …/functions/v1/on-auction-closed -H "Authorization: Bearer <anon>"` with a forged
      body → 401, no emails.
- [x] Same with the correct `x-webhook-secret` but a fake `record.id` → 200 "not found", no emails.
- [x] Closing an item twice sends one set of notifications.
- [x] A 40-bidder item closes and notifies within the Edge Function time limit (reason from the
      code: ≤ 2 DB queries + N/5 sequential send batches).
- [x] `supabase db reset` (if Docker available) results in both triggers existing:
      `select tgname from pg_trigger where tgname like '%webhook%'`.
- [x] `grep -rn SERVICE_ROLE DEPLOY.md .env.example` → no matches.
- [x] `savePushSubscription` rejects `https://attacker.example/x`.


## Out of scope

Reminder emails. The `push_subscriptions` JSONB race (§2.21) — leave a `// TODO(P2)` comment.

## Additions from `DB_AUDIT.md`

### D4 — do **not** switch email lookup to `profiles.email` (DB-9)
`profiles.email` is an unsynced copy of `auth.users.email` (no trigger on email change). Keep
`auth.admin` as the source of truth for addresses — batch with one `auth.admin.listUsers()` page
filtered by the id set, or keep `getUserById` inside the concurrency pool. Switch to
`profiles.email` only after the sync trigger in `Z-deferred.md` (N1) exists.

### Loser query must ignore cancelled bids (DB-2)
H7 adds `.is("cancelled_at", null)` to the `bid_history` select in `on-auction-closed`. If you
rewrite that query in D4 before H lands, include the filter yourself and tell H via `HANDOFF.md`.
