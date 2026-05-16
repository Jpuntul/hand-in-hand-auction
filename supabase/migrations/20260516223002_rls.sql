-- Row Level Security policies.
--
-- Design principles:
--   * Items are publicly readable; only admins can write.
--   * Bid history is publicly readable for transparency; writes only via
--     the place_bid() function (added in a later migration), which uses
--     SECURITY DEFINER to bypass RLS.
--   * Users can read/write their own notification_prefs; admins can read all.
--   * audit_log is admin-read-only; writes only via SECURITY DEFINER functions.
--   * is_admin can only be changed via the admin role (enforced by trigger).

alter table public.profiles           enable row level security;
alter table public.items              enable row level security;
alter table public.bid_history        enable row level security;
alter table public.notification_prefs enable row level security;
alter table public.audit_log          enable row level security;

-- ============================================================
-- is_admin() helper
--
-- SECURITY DEFINER lets this function read profiles without triggering
-- the profiles RLS policies, which would otherwise recurse when called
-- from inside a policy.
-- ============================================================
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

-- ============================================================
-- profiles
-- ============================================================
-- Any authenticated user can read profiles (public-facing display data).
create policy profiles_select_authenticated
  on public.profiles for select
  to authenticated
  using (true);

-- Users can update their own profile row.
create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

-- Admins can update any profile (e.g., to promote/demote other admins).
create policy profiles_update_admin
  on public.profiles for update
  to authenticated
  using (public.is_admin());

-- INSERT is handled by the on_auth_user_created trigger; no client INSERT.
-- DELETE cascades from auth.users; no client DELETE.

-- ============================================================
-- items
-- ============================================================
-- Public read (anon + authenticated) — the auction is public.
create policy items_select_all
  on public.items for select
  using (true);

create policy items_insert_admin
  on public.items for insert
  to authenticated
  with check (public.is_admin());

create policy items_update_admin
  on public.items for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy items_delete_admin
  on public.items for delete
  to authenticated
  using (public.is_admin());

-- ============================================================
-- bid_history
-- ============================================================
-- Public read for transparency.
create policy bid_history_select_all
  on public.bid_history for select
  using (true);

-- No INSERT/UPDATE policy → no client writes. place_bid() uses
-- SECURITY DEFINER to write on behalf of the user.

-- Admin DELETE for bid cancellation (always logged to audit_log).
create policy bid_history_delete_admin
  on public.bid_history for delete
  to authenticated
  using (public.is_admin());

-- ============================================================
-- notification_prefs
-- ============================================================
create policy notification_prefs_select_own
  on public.notification_prefs for select
  to authenticated
  using (user_id = auth.uid());

create policy notification_prefs_insert_own
  on public.notification_prefs for insert
  to authenticated
  with check (user_id = auth.uid());

create policy notification_prefs_update_own
  on public.notification_prefs for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Admins can read all prefs for the notification dashboard.
create policy notification_prefs_select_admin
  on public.notification_prefs for select
  to authenticated
  using (public.is_admin());

-- ============================================================
-- audit_log
-- ============================================================
-- Admins only.
create policy audit_log_select_admin
  on public.audit_log for select
  to authenticated
  using (public.is_admin());

-- No INSERT/UPDATE/DELETE policies → all writes via SECURITY DEFINER functions.
