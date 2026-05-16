-- Extend handle_new_user to also read phone from raw_user_meta_data.
--
-- Without this, phone provided at signup is lost because the post-signup
-- profile UPDATE in actions.ts is blocked by RLS when email confirmation
-- is enabled (no session = no auth.uid()).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, phone)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Guest'
    ),
    nullif(new.raw_user_meta_data->>'phone', '')
  );

  insert into public.notification_prefs (user_id)
  values (new.id);

  return new;
end;
$$;
