-- log_audit RPC: callable from clients to write security/admin events.
--
-- SECURITY DEFINER lets unauthenticated callers (e.g., failed-login flow)
-- write to audit_log without needing INSERT privileges. The function
-- resolves actor_id from auth.uid() when available, and falls back to
-- whatever email the caller passes in metadata.

create or replace function public.log_audit(
  p_action      text,
  p_target_type text default null,
  p_target_id   text default null,
  p_metadata    jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id    uuid := auth.uid();
  v_actor_email text;
begin
  if v_actor_id is not null then
    select email into v_actor_email
    from public.profiles
    where id = v_actor_id;
  end if;

  insert into public.audit_log (
    actor_id, actor_email, action, target_type, target_id, metadata
  ) values (
    v_actor_id,
    coalesce(v_actor_email, p_metadata->>'email'),
    p_action,
    p_target_type,
    p_target_id,
    p_metadata
  );
end;
$$;

grant execute on function public.log_audit(text, text, text, jsonb)
  to anon, authenticated;

comment on function public.log_audit is
  'Append a row to audit_log. Anyone can call; actor_id is resolved from auth.uid() if logged in.';
