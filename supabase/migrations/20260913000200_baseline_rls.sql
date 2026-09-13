-- Baseline Row Level Security policies and column-level privileges.
--
-- Design principles:
--   * Items are publicly readable; only admins can write.
--   * items derived columns (current_bid, current_bidder_id, bid_count, winner_user_id,
--     winning_bid) cannot be updated directly by authenticated users — only modified by
--     SECURITY DEFINER functions.
--   * Bid history is publicly readable for transparency; writes only via
--     the place_bid() and cancel_last_bid() functions, which use SECURITY DEFINER.
--     Rows are append-only; no client UPDATE or DELETE.
--   * profiles SELECT is restricted to own-row (+ admin) to protect donor PII. Other
--     bidders' names are read through public_profiles. Update restricted to allowed columns.
--   * Users can read/write their own notification_prefs and watchlist.
--   * audit_log is admin-read-only; writes only via SECURITY DEFINER functions.

alter table public.profiles           enable row level security;
alter table public.items              enable row level security;
alter table public.bid_history        enable row level security;
alter table public.notification_prefs enable row level security;
alter table public.audit_log          enable row level security;
alter table public.watchlist          enable row level security;

-- ============================================================
-- profiles
-- ============================================================

-- Bidders can read only their own profile row; admins can read all profiles.
drop policy if exists profiles_select_authenticated on public.profiles;
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

drop policy if exists profiles_select_admin on public.profiles;
create policy profiles_select_admin
  on public.profiles for select
  to authenticated
  using (public.is_admin());

-- Users can update their own profile row.
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

-- Admins can update any profile (e.g., to promote/demote other admins).
drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin
  on public.profiles for update
  to authenticated
  using (public.is_admin());

-- Column privileges on profiles:
-- Revoke table-level update on profiles so column privileges take effect,
-- then grant update on allowed columns only (display_name, phone, is_admin).
revoke update on public.profiles from authenticated;
grant update (display_name, phone, is_admin) on public.profiles to authenticated;
revoke update (id, email, created_at, updated_at) on public.profiles from authenticated;

-- ============================================================
-- items
-- ============================================================
-- Public read (anon + authenticated) — the auction is public.
drop policy if exists items_select_all on public.items;
create policy items_select_all
  on public.items for select
  using (true);

drop policy if exists items_insert_admin on public.items;
create policy items_insert_admin
  on public.items for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists items_update_admin on public.items;
create policy items_update_admin
  on public.items for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists items_delete_admin on public.items;
create policy items_delete_admin
  on public.items for delete
  to authenticated
  using (public.is_admin());

-- Column privileges on items:
-- Lock down derived and immutable columns so they can only be changed by
-- SECURITY DEFINER functions (place_bid, override RPCs, cron jobs).
revoke update on public.items from authenticated;

grant update (
  item_no,
  name,
  description,
  sponsor,
  retail_value,
  starting_bid,
  bid_increment,
  start_time,
  end_time,
  status,
  image_urls,
  categories
) on public.items to authenticated;

revoke update (
  current_bid,
  current_bidder_id,
  bid_count,
  winner_user_id,
  winning_bid,
  id,
  created_at,
  updated_at
) on public.items from authenticated;

-- ============================================================
-- bid_history
-- ============================================================
-- Public read for transparency.
drop policy if exists bid_history_select_all on public.bid_history;
create policy bid_history_select_all
  on public.bid_history for select
  using (true);

-- No INSERT/UPDATE/DELETE policy -> no client writes. place_bid() and
-- cancel_last_bid() use SECURITY DEFINER to modify rows on behalf of users.
-- Admin DELETE policy is removed; bids are soft-cancelled only.

-- ============================================================
-- notification_prefs
-- ============================================================
drop policy if exists notification_prefs_select_own on public.notification_prefs;
create policy notification_prefs_select_own
  on public.notification_prefs for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists notification_prefs_insert_own on public.notification_prefs;
create policy notification_prefs_insert_own
  on public.notification_prefs for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists notification_prefs_update_own on public.notification_prefs;
create policy notification_prefs_update_own
  on public.notification_prefs for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Note: notification_prefs_select_admin policy was dropped to prevent exposure
-- of per-device push encryption keys.

-- ============================================================
-- audit_log
-- ============================================================
-- Admins only.
drop policy if exists audit_log_select_admin on public.audit_log;
create policy audit_log_select_admin
  on public.audit_log for select
  to authenticated
  using (public.is_admin());

-- No INSERT/UPDATE/DELETE policies -> all writes via SECURITY DEFINER functions.

-- ============================================================
-- watchlist
-- ============================================================
drop policy if exists watchlist_select_own on public.watchlist;
create policy watchlist_select_own
  on public.watchlist for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists watchlist_insert_own on public.watchlist;
create policy watchlist_insert_own
  on public.watchlist for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists watchlist_delete_own on public.watchlist;
create policy watchlist_delete_own
  on public.watchlist for delete
  to authenticated
  using (user_id = auth.uid());
