-- Scope the prevent_self_promotion check to authenticated app sessions.
--
-- Original version blocked all is_admin changes when public.is_admin() was
-- false, including SQL-editor / service-role operations where auth.uid()
-- is null. That made it impossible to bootstrap the first admin via SQL.
--
-- Fix: only enforce the check when there is an authenticated user
-- (auth.uid() is not null). Backend operations (postgres role, service
-- role, SQL editor) bypass the trigger — they are already trusted by
-- virtue of having direct DB access.

create or replace function public.prevent_self_promotion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_admin is distinct from old.is_admin
     and auth.uid() is not null
     and not public.is_admin()
  then
    raise exception 'Only admins can change admin status'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
