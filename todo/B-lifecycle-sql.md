# B — Auction lifecycle & atomic admin overrides (SQL)

**AUDIT refs:** §2.4 (P0 #4), §2.5 (P0 #5), §2.8 (P1 #8), §2.9 SQL half (P1 #9), §2.13 (P1 #13),
§2.18 partial
**Wave:** 2 (after A) · **Complexity:** M · **Migration prefix:** `2026091311MMSS`

## Goal

Make every mutation of `items` state that isn't `place_bid` go through a locking `SECURITY DEFINER`
function, exactly like `place_bid` does. Add the missing `scheduled → open` transition and a real
`paused` status. Lock down `log_audit`.

## Files you own

- `supabase/migrations/2026091311MMSS_*.sql` (new, several — one concern each)
- `src/app/admin/(protected)/items/override-actions.ts` — full rewrite of bodies to thin RPC
  calls. **Keep** the `requireAdmin()` guard A added at the top of each function.
- `src/app/admin/(protected)/items/item-overrides.tsx` — add a "Resume" button; nothing else.
- `src/app/admin/(protected)/items/actions.ts` — **only** `deleteItem` (delete guard). Keep A's
  guard and audit.
- `src/lib/types.ts` — add `"paused"` to `ITEM_STATUSES`.

Read-only: `supabase/migrations/20260516223007_place_bid.sql` (your template),
`20260517023500_lifecycle.sql`, `20260516223004_log_audit.sql`, `src/lib/auth/require-admin.ts`.

## Tasks

### B1 — `paused` status + auto-open (migration `…_lifecycle_open_and_pause.sql`)
- `alter type public.item_status add value if not exists 'paused';` — **must be in its own
  migration file** (enum values can't be used in the same transaction they're added).
- Next file: `open_scheduled_auctions()` mirroring `close_expired_auctions`:
  `where status = 'scheduled' and start_time is not null and start_time <= now() and (end_time is
  null or end_time > now())`. Returns count.
- Extend `close_expired_auctions` to also close `paused` items past `end_time`? **No** — a paused
  item should stay paused; document that in the function comment. Instead, `open_scheduled_auctions`
  must never touch `paused`.
- Re-register the cron job to call both: `select cron.schedule('auction-lifecycle', '* * * * *',
  $$select public.open_scheduled_auctions(); select public.close_expired_auctions();$$)` and
  `cron.unschedule('close-expired-auctions')` (guard with `if exists`).

### B2 — Atomic override functions (migration `…_admin_override_functions.sql`)
All four: `security definer`, `set search_path = public`, first statement
`if not public.is_admin() then raise exception 'Forbidden' using errcode = '42501'; end if;`, then
`select * into v_item from public.items where id = p_item_id for update;`, `if not found` → P0002.
Each inserts its own `audit_log` row **inside the transaction** (direct insert, not via `log_audit`).

- `pause_item(p_item_id)` — `open → paused` only; else raise 22023.
- `resume_item(p_item_id)` — `paused → open` only; if `end_time <= now()` raise 'Cannot resume an
  expired item; extend the deadline first'.
- `extend_deadline(p_item_id, p_minutes int)` — `set end_time = coalesce(end_time, now()) +
  make_interval(mins => p_minutes)` where status in (`open`,`paused`); reject others. `p_minutes`
  must be 1..1440.
- `force_close_item(p_item_id)` — `set status='closed', winner_user_id=current_bidder_id,
  winning_bid=current_bid` where status in (`open`,`paused`); else raise.
- `cancel_last_bid(p_item_id, p_reason text)` — `p_reason` non-empty. Delete the newest
  `bid_history` row (`order by created_at desc, id desc limit 1`), `returning extended_end_time`.
  Then **recompute** from `bid_history`:
  `current_bid = (select amount … order by created_at desc, id desc limit 1)`,
  `current_bidder_id` likewise, `bid_count = (select count(*) …)`. If `extended_end_time` was not
  null: `end_time = end_time - interval '60 seconds'` but never below `now()` if status is `open`
  (use `greatest`). If `status = 'closed'`: also set `winner_user_id`/`winning_bid` to the
  recomputed values. Raise if there are no bids.
- `grant execute on function … to authenticated;` for all five. Return `jsonb` with the new state
  (mirror `place_bid`'s return shape).

### B3 — Lock down function privileges (same migration or `…_function_privileges.sql`)
```sql
revoke execute on all functions in schema public from public, anon;
grant execute on function public.server_time() to anon, authenticated;
grant execute on function public.place_bid(uuid, numeric) to authenticated;
-- log_audit: authenticated only (see B4)
```
Also `alter default privileges in schema public revoke execute on functions from public;` so future
functions don't inherit it.

### B4 — `log_audit` lockdown (migration `…_log_audit_lockdown.sql`)
`create or replace` it: reject when `auth.uid() is null`; reject `p_action` not matching
`^(auth|admin)\.[a-z_.]+$`; **never** read `actor_email` from `p_metadata` — resolve from
`profiles` only. Revoke from `anon`, grant to `authenticated`. Failed-login audit rows for
unauthenticated attempts: leave a `-- TODO(G)` comment; workstream G moves that server-side if it
still needs it. Add `select cron.schedule('audit-log-retention', '0 3 * * *', $$delete from
public.audit_log where created_at < now() - interval '90 days'$$)`.

### B5 — Constraints (migration `…_items_constraints.sql`)
```sql
alter table public.items add constraint items_bid_count_nonneg check (bid_count >= 0);
alter table public.items add constraint items_closed_has_consistent_winner
  check (status <> 'closed' or winner_user_id is not distinct from current_bidder_id);
```
Idempotent (`do $$ … if not exists`). If the second constraint would fail on existing rows, add a
one-time backfill `update … set winner_user_id = current_bidder_id, winning_bid = current_bid where
status = 'closed'` **before** it.

### B6 — Delete guard
`deleteItem` in `items/actions.ts`: before deleting, select `bid_count`; if `> 0` return
`{ ok: false, error: "Items with bids cannot be deleted — set status to cancelled instead." }`.

### B7 — Thin server actions
Rewrite each function in `override-actions.ts` as: `requireAdmin()` (already there) → `supabase.rpc(
"<fn>", {...})` → map error → `revalidatePath` → return. Delete the local `logAudit` helper (the
SQL functions audit themselves). Add `resumeItem`. Wire "Resume" into `item-overrides.tsx` next to
"Pause".

## Acceptance criteria

- [x] A `scheduled` item with `start_time` in the past becomes `open` within one cron tick; a
      `paused` one does not.
- [x] `pause` → `resume` round-trips; resume on an expired item is rejected with a clear message.
- [x] Two concurrent `extend_deadline(+15)` calls yield +30, not +15.
- [x] `cancel_last_bid` with a concurrent `place_bid`: afterwards `items.current_bid =
      max(bid_history.amount)` and `bid_count = count(*)`.
- [x] Cancelling a bid that carried `extended_end_time` moves `end_time` back 60 s.
- [x] `force_close_item` on a `scheduled` item is rejected.
- [x] `POST /rest/v1/rpc/close_expired_auctions` with the anon key → 42501.
- [x] `POST /rest/v1/rpc/log_audit` with the anon key → error; with a user JWT and
      `p_action = 'admin.user.promote'` and no admin role → still inserts (it's `authenticated`-
      gated, not admin-gated — that's fine because A blocks the *server actions*; document it).
- [x] `deleteItem` on an item with bids is refused.
- [x] `override-actions.ts` contains no `.from("items").update(` or `.from("bid_history").delete(`.

## Out of scope

Form-side lifecycle fields (F). Frontend status badge for `paused` — add `paused: "secondary"` to
the two `statusVariant` maps **only if** `tsc` fails without it; otherwise leave for F/E.

## Design changes from `DB_AUDIT.md` (read before starting B2 / B5)

These supersede the matching lines above; the rest of B is unchanged.

### B2 — `cancel_last_bid` must **soft-cancel**, never `DELETE` (DB_AUDIT R2, DB-2)
Workstream H adds `bid_history.cancelled_at / cancelled_by / cancel_reason` and drops the admin
DELETE policy (H2). Rewrite B2's `cancel_last_bid` accordingly:
- [x] Lock `items` (`for update`) **first**, then pick the newest **live** bid:
      `select * from bid_history where item_id = p_item_id and cancelled_at is null
       order by id desc limit 1 for update` — `order by id`, not `created_at` (DB-4).
- [x] `update bid_history set cancelled_at = clock_timestamp(), cancelled_by = auth.uid(),
       cancel_reason = p_reason where id = v_bid.id;` — no `delete`.
- [x] Recompute from **live** rows only: `current_bid / current_bidder_id` from
      `… where cancelled_at is null order by id desc limit 1`; `bid_count = count(*) … where
      cancelled_at is null`.
- [x] Anti-snipe rollback and the closed-item `winner_*` refresh as already specified.
- [x] Raise if there is no live bid to cancel.
- [x] `force_close_item` / `close_expired_auctions` are unaffected (they copy `current_*`).
- [x] Every `order by created_at` in B2's functions becomes `order by id`.

### B5 — two more constraints (DB_AUDIT R6, DB-6)
Add to the B5 migration, same idempotent pattern, **with the backfill before them**:
```sql
-- open items must have a deadline (otherwise nothing ever closes them)
alter table public.items add constraint items_open_requires_end_time
  check (status <> 'open' or end_time is not null);
-- only closed items carry a winner
alter table public.items add constraint items_winner_only_when_closed
  check (status = 'closed' or (winner_user_id is null and winning_bid is null));
```
Backfill: **first** `copy (select id, status, winner_user_id, winning_bid from public.items where
status <> 'closed' and (winner_user_id is not null or winning_bid is not null)) to stdout` and
paste the rows into your report (the next statement nulls them); then
`update items set winner_user_id = null, winning_bid = null where status <> 'closed';`.
For `open` rows with null `end_time` — **stop and ask**; do not invent a deadline.
Coupling: once `items_winner_only_when_closed` exists, any transition `closed → cancelled` (edit
form dropdown, or a future `cancel_item` function) must null `winner_user_id` / `winning_bid` in
the **same** statement or it will be rejected. Add that to whichever path B or F keeps.
`items_closed_has_consistent_winner` (already in B5) should also compare `winning_bid` to
`current_bid`. Note DB_AUDIT OQ-7: this constraint forbids "runner-up wins if winner declines";
keep it unless the owner says otherwise.

### Sequencing note
H5 (`revoke update` on `items.current_bid / current_bidder_id / bid_count / winner_user_id /
winning_bid` from `authenticated`) lands **after B7**. Until then the old override actions still
work; after it, only your SQL functions can write those columns — which is the point. B7's
`grep` acceptance criterion is what makes H5 safe.
