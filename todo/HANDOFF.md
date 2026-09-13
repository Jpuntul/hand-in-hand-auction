# Workstream Handoff Requests

## Workstream S (Squash Migrations)

### Remote Database Notice
- The remote Supabase project `raxaicqhlbmyzngcubye` was paused on the dashboard. Per coordinator directive, local verification was conducted and confirmed schema neutrality (`diff /tmp/before.sql /tmp/after.sql` is completely empty).
- **Remote action needed by owner/integration:** Unpause project on dashboard and run `supabase db reset --linked` (or `supabase db push` after `supabase migration repair --status reverted` for the 12 old versions), then recreate the two database webhooks in dashboard (D6 will subsequently manage them as migrations).

### Code Formatting Notice
- `src/` files currently contain pre-existing formatting differences under `pnpm biome check src` (e.g. tabs vs spaces, import ordering). An integration pass or dedicated cleanup workstream should run `pnpm biome format --write src` once parallel workstreams complete.

## Workstream D (Edge Functions & notifications)

### Notice to Workstream H (H7 / DB-2)
- In `supabase/functions/on-auction-closed/index.ts`, the `bid_history` query has already been updated to filter out cancelled bids with `.is("cancelled_at", null)`.
- When Workstream H lands `cancelled_at` on `public.bid_history`, the Edge Function query is already aligned and requires no additional changes from H.
## Workstream A (Authorization & Validation)

### Notice to Workstream B (Lifecycle & override actions)
- `requireAdmin()` is available at `@/lib/auth/require-admin`.
- In `src/app/admin/(protected)/items/override-actions.ts`, `requireAdmin()` guards and `.select("id")` row-count checks have been placed at top and mutations respectively. When Workstream B rewrites the bodies to use SQL RPCs, continue to guard callers with `await requireAdmin();`.

### Database Privilege Notice (Profiles Column Privileges)
- Migration `supabase/migrations/20260913100000_profiles_column_privileges.sql` revokes table-level `UPDATE` on `public.profiles` from `authenticated` and explicitly grants `UPDATE` only on `(display_name, phone, is_admin)` alongside revoking `(id, email, created_at, updated_at)`. In PostgreSQL, table-level UPDATE grants take precedence over column-level revokes; revoking table update first was required to ensure `email` and other sensitive columns cannot be modified by authenticated users via PostgREST.
- If future migrations (e.g. Workstream H adding `can_bid`) add columns to `public.profiles` that should NOT be writable by bidders, note that they are automatically not writable unless granted. If they should be writable by bidders, grant UPDATE on those columns explicitly.

## Workstream H (Database Integrity)

### Migrations Landed (prefix 2026091309MMSS)
- `20260913090100_bid_history_fk_restrict.sql`: `bid_history.user_id` and `bid_history.item_id` foreign keys changed to `ON DELETE RESTRICT`. Attempting to delete an auth user or item with bids fails with a FK violation.
- `20260913090200_bid_history_soft_cancel.sql`: Added `cancelled_at timestamptz`, `cancelled_by uuid`, and `cancel_reason text` with check constraint requiring non-empty reason when cancelled. Dropped `bid_history_delete_admin` policy. Created partial index `bid_history_item_live_idx` on `(item_id, id desc) where cancelled_at is null`.
- `20260913090300_bid_history_ordering.sql`: Changed `bid_history.created_at` default to `clock_timestamp()`. Replaced index `bid_history_item_id_idx` with `(item_id, id desc)`.
- `20260913090400_place_bid_v2.sql`: Updated `place_bid` to capture `v_now := clock_timestamp()` after row lock, and enforces jump ceiling `greatest(v_min_bid * 10, v_min_bid + 10000)`.
- `20260913090500_db_cleanups.sql`: Dropped unused `notification_prefs_select_admin` policy, dropped duplicate indexes `items_item_no_idx` and `watchlist_user_id_idx`, and removed `bid_history` from `supabase_realtime` publication.

### Notice to Workstream B (Lifecycle & SQL functions) & Workstream F (Admin views)
- Shared domain contract established: **live bid = `cancelled_at is null`**; **`items.bid_count` = count of live bids**.
- B2's `cancel_last_bid` should pick newest live bid via `order by id desc where cancelled_at is null` and soft-cancel by setting `cancelled_at`, `cancelled_by`, and `cancel_reason`.
- Canonical ordering for bids is `order by id desc` (backed by index `bid_history_item_id_idx`).

### Notice to Workstream G (G6 / ADMIN_SETUP.md)
- `ADMIN_SETUP.md` needs the note: "Users with bids cannot be deleted; items with bids cannot be deleted — cancel instead." Because H owns only migrations and on-auction-closed, please include this line during the G6 / docs refresh.

### Notice to Workstream D (Edge Functions)
- Confirmed: H7 loser query in `on-auction-closed/index.ts` was pre-applied with `.is("cancelled_at", null)` and aligns with the landed `cancelled_at` column. No further edits needed.

### Pre-flight Drift Notice
- Remote project `raxaicqhlbmyzngcubye` is paused on Supabase dashboard; per coordinator directive, pre-flight drift capture was skipped and all migrations verified against local PostgreSQL 17.

### Migration Landed (H5, prefix 2026091317MMSS)
- `20260913170000_items_column_privileges.sql`: Revoked table-level `UPDATE` on `public.items` from `authenticated`. Granted column-level `UPDATE` on allowed admin-editable columns (`item_no, name, description, sponsor, retail_value, starting_bid, bid_increment, start_time, end_time, status, image_urls, categories`). Explicitly revoked `UPDATE` on derived and immutable columns (`current_bid, current_bidder_id, bid_count, winner_user_id, winning_bid, id, created_at, updated_at`). Derived columns are now strictly unwritable by clients / PostgREST (returning SQLSTATE 42501) and can only be modified under row lock by `SECURITY DEFINER` functions (`place_bid`, `cancel_last_bid`, `force_close_item`).


## Workstream B (Lifecycle & SQL overrides)

### Migrations Landed (prefix 2026091311MMSS)
- `20260913110000_item_status_paused.sql`: Added `'paused'` to `public.item_status` enum.
- `20260913110100_lifecycle_open_and_pause.sql`: Added `open_scheduled_auctions()` (opens scheduled items whose `start_time <= now()` and `end_time > now()`; ignores paused items). Re-registered cron job `'auction-lifecycle'` (`* * * * *`) running both `open_scheduled_auctions()` and `close_expired_auctions()`.
- `20260913110200_admin_override_functions.sql`: Added `pause_item(uuid)`, `resume_item(uuid)`, `extend_deadline(uuid, integer)`, `force_close_item(uuid)`, and `cancel_last_bid(uuid, text)`. All are `SECURITY DEFINER`, lock `items ... FOR UPDATE`, query `bid_history` with `cancelled_at is null` and `order by id desc`, execute in-transaction audit logging, and are granted to `authenticated`. `cancel_last_bid` performs soft-cancel (sets `cancelled_at = clock_timestamp()`, `cancelled_by = auth.uid()`, `cancel_reason = p_reason`).
- `20260913110300_function_privileges.sql`: Revoked all function execution in `public` from `public, anon`; re-granted explicitly to `anon` (`server_time`) and `authenticated` (`place_bid`, `is_admin`, override RPCs, trigger functions). Explicitly revoked `close_expired_auctions()` and `open_scheduled_auctions()` from `authenticated`. Configured default privileges so future functions do not grant execute to `public`.
- `20260913110400_log_audit_lockdown.sql`: Replaced `log_audit` to require `auth.uid() is not null`, validate `p_action ~ '^(auth|admin)\.[a-z_.]+$'`, strictly resolve `actor_email` from `profiles`, revoke execute from `anon`, and scheduled 90-day retention prune job `'audit-log-retention'` (`0 3 * * *`).
- `20260913110500_items_constraints.sql`: Added CHECK constraints `items_bid_count_nonneg` (`bid_count >= 0`), `items_open_requires_end_time` (`status <> 'open' or end_time is not null`), `items_winner_only_when_closed` (`status = 'closed' or (winner_user_id is null and winning_bid is null)`), and `items_closed_has_consistent_winner` (`status <> 'closed' or (winner_user_id is not distinct from current_bidder_id and winning_bid is not distinct from current_bid)`) with idempotent backfills.

### Notice to Workstream H (H5 — Column Privileges)
- B7 complete: all direct updates to `items` and deletes on `bid_history` have been removed from `src/app/admin/(protected)/items/override-actions.ts`. All mutations now run through the locking SQL RPCs.
- Workstream H5 (`revoke update (current_bid, current_bidder_id, bid_count, winner_user_id, winning_bid) on items from authenticated`) is unblocked and safe to land.

### Notice to Workstream F (Admin Pages & Item Form)
- `items_winner_only_when_closed` constraint is active: when transitioning an item from `closed` to `cancelled` (or any non-closed status), the edit form / action MUST null out `winner_user_id` and `winning_bid` in the same statement, otherwise the update will fail DB validation.
- `items_open_requires_end_time` constraint is active: setting `status = 'open'` requires a non-null `end_time`.
- In `src/app/admin/(protected)/items/actions.ts`, temporary `as never` casts were placed on `insert`/`update` payloads in `createItem` and `updateItem` so TypeScript compiles cleanly before `database.types.ts` is regenerated. When F modifies `updateItem`, please preserve this compatibility.
- `deleteItem` guard in `actions.ts` is in place: checks `bid_count > 0` and rejects deletion.

### Notice to Integration
- After running `supabase gen types typescript`, remove the local types and casts annotated with `// TODO(integration)` in `src/lib/types.ts`, `override-actions.ts`, `actions.ts`, `admin/(protected)/page.tsx`, and `admin/(protected)/users/page.tsx`.

## Workstream F (Admin Pages: Users query, Item Form)

### Migrations Landed (prefix 2026091314MMSS)
- `20260913140000_admin_views.sql`: Created `user_bid_counts` view (counting live bids where `cancelled_at is null` per DB-2) and `open_items_revenue` view (calculating current revenue on open items). Granted SELECT on both views to `authenticated`.

### Notice to Integration
- `src/app/admin/(protected)/users/page.tsx`: Uses `user_bid_counts` view with pagination (`?page=`, 50 items/page, `.range()`).
- `src/app/admin/(protected)/page.tsx`: Uses `open_items_revenue` view for projected revenue.
- `src/app/admin/(protected)/items/items-table.tsx`: Server component without `"use client"`, direct link navigation, and `paused` badge variant.
- `src/app/admin/(protected)/items/actions.ts`: `updateItem` only accepts partial updates for details fields and strips lifecycle columns (`status`, `start_time`, `end_time`). Added `updateItemSchedule` for dedicated schedule updates.
- `src/app/admin/(protected)/items/item-form.tsx`: Client-side validation via `zodResolver` with field error displays; dirty-field partial updates; seconds preserved in `toDatetimeLocal` (`YYYY-MM-DDTHH:mm:ss`) and inputs with `step="1"`; venue/browser time zone note displayed under schedule fields.
- `can_bid` toggle on `/admin/users` was skipped per brief since Workstream H did not add `can_bid` to `profiles`.

## Workstream I (Integration cleanup: Lint, Type Casts, Second Migration Squash)

### Migrations Squashed (21 -> 4 baseline files)
- Folded all 17 workstream migrations into the 4 baseline files:
  - `20260913000000_baseline_schema.sql`
  - `20260913000100_baseline_functions.sql`
  - `20260913000200_baseline_rls.sql`
  - `20260913000300_baseline_ops.sql`
- Deleted all 17 workstream migration files (`2026091309*.sql` through `2026091317*.sql`).
- Schema-neutral proof: Sorted `pg_dump` diff between 21-migration state and 4-baseline state is completely empty (exit code 0, excluding session-level `\restrict` keys). Extra trigger and cron schedule diff is also completely identical.
- All 44 pgTAP tests (`supabase test db`) pass against the baseline.

### Linter & Types Clean
- `pnpm biome check src` is clean (0 errors, 0 warnings).
  - Added `css.parser.tailwindDirectives = true` to `biome.json`.
  - Added `src/lib/env.ts` with `getEnv()` to eliminate non-null assertions on env vars in Supabase clients.
  - Replaced callback returns in `forEach` with `for ... of` in server and middleware cookies setup.
  - Added `// biome-ignore lint/a11y/noLabelWithoutControl` to `src/components/ui/label.tsx`.
- Removed all `TODO(integration)` comments and temporary `any` casts from `src/lib/types.ts`, `override-actions.ts`, `items/actions.ts`, `admin/(protected)/page.tsx`, `admin/(protected)/users/page.tsx`, and `history/[id]/page.tsx`.
- `tsc --noEmit`, `vitest run` (17 tests), and `pnpm build` pass cleanly.

