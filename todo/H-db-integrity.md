# H — Database integrity (bid log, derived columns, ordering)

**Source:** `../DB_AUDIT.md` — DB-1, DB-2, DB-3, DB-4, DB-5, DB-9, DB-17, DB-18, DB-20
**Wave:** 1 for H1–H4/H6 (no dependencies); **H5 must wait for B7** · **Complexity:** M
**Migration prefixes:** `2026091309MMSS` for H1–H4/H6 (sorts **before** every other workstream —
B2 and F1 reference the columns H2 adds); `2026091317MMSS` for H5 only (sorts after B).

## Goal

`bid_history` becomes genuinely append-only and survives user/item deletion. The columns on
`items` that *define* the auction result can only be written by the SQL functions that maintain
them. Bid order is deterministic. `place_bid` refuses absurd amounts.

## Files you own

- `supabase/migrations/2026091309MMSS_*.sql` (H1–H4, H6) and `2026091317MMSS_*.sql` (H5) — new, one concern each
- `supabase/functions/on-auction-closed/index.ts` — **only** the `bid_history` loser query
  (add `.is("cancelled_at", null)`). D owns the rest of the file; make this a one-line diff.

Read-only: `supabase/migrations/20260516223001_schema.sql`, `20260516223007_place_bid.sql`
(your template for H4), `todo/B-lifecycle-sql.md` (B2 consumes your H2/H3 design).

## Pre-flight (do this first, before any migration in any workstream)

- [x] `supabase db diff --linked` against the project. (Project `raxaicqhlbmyzngcubye` is paused on dashboard; skipped per coordinator directive; verified locally).

## Tasks

### H1 — `bid_history` FKs to RESTRICT (migration `…_bid_history_fk_restrict.sql`) — DB-1
- [x] `bid_history.user_id` → `on delete restrict`; `bid_history.item_id` → `on delete restrict`
      (drop + re-add `bid_history_user_id_fkey` / `bid_history_item_id_fkey`; wrap in
      `do $$ … $$` so it is idempotent).
- [x] Leave `previous_bidder_id` (`set null`) and `items.current_bidder_id` / `winner_user_id`
      (`set null`) as they are — unreachable once `user_id` is `restrict`; comment why.
- [x] `ADMIN_SETUP.md` gets one line: "Users with bids cannot be deleted; items with bids cannot
      be deleted — cancel instead." (Coordinated with G6 via `HANDOFF.md`).

### H2 — Soft-cancel columns; drop the admin DELETE policy (migration `…_bid_history_soft_cancel.sql`) — DB-2
- [x] `add column cancelled_at timestamptz, cancelled_by uuid references profiles(id) on delete
      set null, cancel_reason text` (all `if not exists`).
- [x] `check (cancelled_at is null or nullif(trim(cancel_reason), '') is not null)`.
- [x] `drop policy if exists bid_history_delete_admin on public.bid_history;`
- [x] `create index if not exists bid_history_item_live_idx on public.bid_history (item_id, id desc)
      where cancelled_at is null;`
- [x] Table comment updated: "Append-only. Cancellation sets cancelled_* via cancel_last_bid();
      rows are never deleted."
- [x] Definition to write into the migration comment so B2 / F1 / C2 use the same one:
      **live bid = `cancelled_at is null`; `items.bid_count` = count of live bids.**

### H3 — Deterministic ordering (migration `…_bid_history_ordering.sql`) — DB-4
- [x] `alter table public.bid_history alter column created_at set default clock_timestamp();`
      (transaction-start `now()` lets a bid that waited on the row lock carry an *earlier*
      timestamp than the bid it beat).
- [x] Replace `bid_history_item_id_idx (item_id, created_at desc)` with `(item_id, id desc)`.
- [x] Column comment on `id`: "Canonical accepted order. Always `order by id`, never by
      `created_at`, when the order matters."

### H4 — `place_bid` refinements (migration `…_place_bid_v2.sql`) — DB-4, DB-5, DB-17
`create or replace function public.place_bid(uuid, numeric)` — copy the existing body, then:
- [x] `v_now := clock_timestamp();` **after** the `for update` select (remove the `declare`
      initialiser). Window checks and anti-snipe use the post-lock time.
- [x] Ceiling: `if p_amount > greatest(v_min_bid * 10, v_min_bid + 10000) then raise exception
      'Bid exceeds the maximum allowed jump (%)', … using errcode = '22023'; end if;` — confirm
      the multiplier/offset with the owner (DB_AUDIT OQ-2); leave both as named constants at the
      top of the function.
- [ ] Optional, only if OQ-3 answers "no self-outbid": `if v_item.current_bidder_id = v_user_id
      then raise exception 'You are already the leading bidder' using errcode = '22023';`.
      Default: **leave allowed** (UI says "Raise your bid").
- [ ] Optional, only if time allows (N2): `alter table profiles add column can_bid boolean not
      null default true;` + `if not (select can_bid from profiles where id = v_user_id) then
      raise exception 'Bidding is disabled for this account' using errcode = '42501'; end if;`
      **In the same migration:** `revoke update (can_bid) on public.profiles from authenticated;`
      — `profiles_update_own` has no column restriction and A5's revoke list does not cover this
      column, so without it a blocked bidder un-blocks themselves via `PATCH /rest/v1/profiles`.
      (Rule for the future: every new flag on `profiles` needs a column revoke or a trigger;
      `is_admin` is only safe because of `prevent_self_promotion`.)
      Admin toggle belongs to F (users page) — write a `HANDOFF.md` entry; don't build the UI here.
- [x] Keep the `grant execute … to authenticated` line (B3 revokes from PUBLIC; the grant must
      survive).

### H5 — Column privileges on derived `items` columns (migration `…_items_column_privileges.sql`) — DB-3
**Blocked until B7 is merged** (today's `override-actions.ts` writes these columns directly and
would start failing at runtime).
- [x] **Pattern (learned in A5): a column-level REVOKE is a no-op while a table-level UPDATE
      grant exists.** So: `revoke update on public.items from authenticated;` then
      `grant update (item_no, name, description, sponsor, retail_value, starting_bid,
      bid_increment, start_time, end_time, status, image_urls, categories, notified_at)
      on public.items to authenticated;` — i.e. everything EXCEPT `current_bid,
      current_bidder_id, bid_count, winner_user_id, winning_bid, id, created_at, updated_at`.
      Check `\d public.items` first for any column added by other workstreams (e.g. D's
      `notified_at` — Edge Functions use the service role, so it need not be granted; include it
      only if an admin page writes it). RLS `items_update_admin` still gates *who*.
- [x] Verify by reading: `createItem` / `updateItem` send only `itemSchema` keys (they do not
      include these five) — unaffected. `SECURITY DEFINER` functions run as owner — unaffected.
- [x] `grep -rn 'current_bid\|winner_user_id\|bid_count' src/app/admin/**/actions.ts
      src/app/admin/**/override-actions.ts` → must be zero writes.

### H6 — Small cleanups (fold into the last of the `…09…` files, not into H5) — DB-18, DB-20
- [x] `drop policy if exists notification_prefs_select_admin on public.notification_prefs;`
      (no admin page reads the table; it exposes per-device push keys).
- [x] `drop index if exists items_item_no_idx;` `drop index if exists watchlist_user_id_idx;`
- [x] `alter publication supabase_realtime drop table public.bid_history;` (nothing subscribes).

### H7 — Edge Function loser query — DB-2
- [x] `on-auction-closed/index.ts`: `.from("bid_history").select("user_id, amount").eq("item_id",
      …)` → add `.is("cancelled_at", null)`. One line. Tell D via `HANDOFF.md`.

## Acceptance criteria

- [x] Deleting an `auth.users` row for a user with bids fails with a FK violation; deleting one
      with no bids succeeds and cascades `profiles` / `watchlist` / `notification_prefs`.
- [x] Deleting an item with bids fails at the DB even with the service role.
- [x] `DELETE /rest/v1/bid_history?id=eq.<n>` with an admin JWT → 0 rows affected.
- [x] After `cancel_last_bid` (B2) the row still exists with `cancelled_at`, `cancelled_by`,
      `cancel_reason` set, and `items.current_bid = max(amount) where cancelled_at is null`.
- [ ] If `can_bid` was added: `PATCH /rest/v1/profiles?id=eq.<self>` body `{"can_bid": true}`
      with a bidder JWT → 42501.
- [x] Ordering inversion reproduces on the old schema and is gone on the new one. Shape (the
      *waiting* transaction must `BEGIN` **first** so its `now()` is fixed early):
      session B: `begin;` (do nothing else yet) → session A: `begin; select place_bid(item, 100);
      commit;` → session B: `select place_bid(item, 200); commit;`.
      With today's `now()` default: `A.id < B.id` **but** `A.created_at > B.created_at` — the bug.
      After H3 (`clock_timestamp()`): `A.id < B.id` and `A.created_at < B.created_at`.
      (If B begins *after* A, both defaults look monotonic and the test proves nothing.)
- [x] `place_bid` with `p_amount = v_min_bid * 11` is rejected; `v_min_bid * 9` is accepted.
- [x] After H5, `PATCH /rest/v1/items?id=eq.<id>` body `{"current_bid": 1}` with an admin JWT →
      42501; body `{"name": "x"}` → 200.
- [x] `select tablename from pg_publication_tables where pubname = 'supabase_realtime'` no
      longer lists `bid_history`.

## Out of scope

`cancel_last_bid` / `force_close_item` themselves (B2 — but they must follow H2/H3's contract).
`profiles.email` sync trigger (DB-9 → `Z-deferred.md`, needed only if D4 switches to
`profiles.email`). `winning_bid_id` FK (DB-19 → Z). CHECK constraints on `items` (B5, extended
per `DB_AUDIT.md` R6).
