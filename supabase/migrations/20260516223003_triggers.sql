-- Triggers:
--   * touch_updated_at      — maintain updated_at on UPDATE
--   * handle_new_user       — create profile + notification_prefs on signup
--   * prevent_self_promotion — block users from changing their own is_admin

-- ============================================================
-- updated_at maintenance
-- ============================================================
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

create trigger items_touch_updated_at
  before update on public.items
  for each row execute function public.touch_updated_at();

create trigger notification_prefs_touch_updated_at
  before update on public.notification_prefs
  for each row execute function public.touch_updated_at();

-- ============================================================
-- Auto-create profile + notification_prefs on signup
--
-- Runs after a new row lands in auth.users (i.e., a successful signup
-- of any kind: email/password, OAuth, or anonymous).
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Guest'
    )
  );

  insert into public.notification_prefs (user_id)
  values (new.id);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Prevent self-promotion to admin
--
-- Users CAN edit their own profile row (display_name, phone, etc.) but
-- CANNOT change is_admin unless they are already an admin. This protects
-- against compromised users escalating privileges via the API.
-- ============================================================
create or replace function public.prevent_self_promotion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_admin is distinct from old.is_admin and not public.is_admin() then
    raise exception 'Only admins can change admin status'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_self_promotion
  before update on public.profiles
  for each row execute function public.prevent_self_promotion();
