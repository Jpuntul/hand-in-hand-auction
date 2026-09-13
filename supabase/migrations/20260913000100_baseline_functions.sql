-- Baseline functions: helpers, triggers, lifecycle maintenance, and RPCs.
--
-- Functions:
--   is_admin                 — check if caller has admin role (security definer)
--   touch_updated_at         — maintain updated_at on UPDATE
--   handle_new_user          — create profile + notification_prefs on signup (with phone)
--   prevent_self_promotion   — block users from changing their own is_admin
--   log_audit                — client-callable audit logger (locked down, authenticated only)
--   place_bid                — serialized atomic bid placement with anti-sniping and ceiling cap (v2)
--   server_time              — clock sync RPC for countdowns
--   close_expired_auctions   — auction expiry and winner assignment
--   open_scheduled_auctions  — auto-opens scheduled auctions when start_time arrives
--   pause_item               — admin override: open -> paused
--   resume_item              — admin override: paused -> open
--   extend_deadline          — admin override: extend auction end_time
--   force_close_item         — admin override: open/paused -> closed (assigns winner)
--   cancel_last_bid          — admin override: soft-cancel newest live bid, rollback extension
--   install_notification_webhooks — dynamic installation of DB webhook triggers

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

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists items_touch_updated_at on public.items;
create trigger items_touch_updated_at
  before update on public.items
  for each row execute function public.touch_updated_at();

drop trigger if exists notification_prefs_touch_updated_at on public.notification_prefs;
create trigger notification_prefs_touch_updated_at
  before update on public.notification_prefs
  for each row execute function public.touch_updated_at();

-- ============================================================
-- Auto-create profile + notification_prefs on signup
--
-- Runs after a new row lands in auth.users (i.e., a successful signup
-- of any kind: email/password, OAuth, or anonymous).
-- Reads display_name and phone from raw_user_meta_data.
-- ============================================================
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Prevent self-promotion to admin
--
-- Users CAN edit their own profile row (display_name, phone, etc.) but
-- CANNOT change is_admin unless they are already an admin. This protects
-- against compromised users escalating privileges via the API.
--
-- Scope the check to authenticated app sessions: only enforce when
-- auth.uid() is not null. Backend operations (postgres role, service
-- role, SQL editor) bypass the trigger — they are already trusted by
-- virtue of having direct DB access.
-- ============================================================
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

drop trigger if exists profiles_prevent_self_promotion on public.profiles;
create trigger profiles_prevent_self_promotion
  before update on public.profiles
  for each row execute function public.prevent_self_promotion();

-- ============================================================
-- log_audit RPC
--
-- Security rules:
--   1. Reject unauthenticated callers (auth.uid() is null -> 42501).
--   2. Validate p_action matches allow-list pattern ^(auth|admin)\.[a-z_.]+$ (-> 22023).
--   3. Resolve actor_email strictly from profiles. Never trust p_metadata->>'email'.
--   4. Revoke execute from public and anon; grant execute to authenticated only.
-- ============================================================
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
  if v_actor_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  if p_action is null or p_action !~ '^(auth|admin)\.[a-z_.]+$' then
    raise exception 'Invalid action format: %', p_action
      using errcode = '22023';
  end if;

  -- Resolve actor_email from profiles table only. Never trust metadata.
  -- Note: log_audit is authenticated-gated, not admin-gated (server actions enforce admin role).
  -- TODO(G): Failed-login audit rows for unauthenticated attempts moved server-side if needed.
  select email into v_actor_email
  from public.profiles
  where id = v_actor_id;

  insert into public.audit_log (
    actor_id, actor_email, action, target_type, target_id, metadata
  ) values (
    v_actor_id,
    v_actor_email,
    p_action,
    p_target_type,
    p_target_id,
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

comment on function public.log_audit is
  'Append a row to audit_log. Authenticated callers only; validates action format and resolves actor email from profiles table.';

-- ============================================================
-- place_bid RPC (v2)
--
-- ACID bid placement. Serializes concurrent bids on the same item via
-- SELECT FOR UPDATE.
-- 1. Evaluates v_now := clock_timestamp() AFTER acquiring the row lock on items,
--    ensuring window checks and anti-sniping evaluate against lock-acquisition time.
-- 2. Enforces a sanity ceiling on bids to prevent absurd jumps / typos.
-- 3. Retains self-outbid support ("Raise your bid").
-- ============================================================
create or replace function public.place_bid(
  p_item_id uuid,
  p_amount  numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id             uuid := auth.uid();
  v_item                public.items;
  v_now                 timestamptz;
  v_min_bid             numeric;
  v_extended            timestamptz;
  v_prev_bid            numeric;
  v_prev_bidder         uuid;
  v_anti_snipe_window   constant interval := interval '60 seconds';
  v_max_jump_multiplier constant numeric := 10;
  v_max_jump_offset     constant numeric := 10000;
  v_max_allowed_bid     numeric;
begin
  if v_user_id is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  -- Row lock — concurrent place_bid calls on the same item serialize here.
  select * into v_item
  from public.items
  where id = p_item_id
  for update;

  if not found then
    raise exception 'Item not found'
      using errcode = 'P0002';
  end if;

  -- Post-lock wall clock timestamp (DB-4): window checks and anti-snipe
  -- evaluate the time the row lock was acquired, not transaction start.
  v_now := clock_timestamp();

  if v_item.status <> 'open' then
    raise exception 'Auction is not open (status: %)', v_item.status
      using errcode = '22023';
  end if;

  if v_item.start_time is not null and v_now < v_item.start_time then
    raise exception 'Auction has not started yet'
      using errcode = '22023';
  end if;

  if v_item.end_time is not null and v_now >= v_item.end_time then
    raise exception 'Auction has ended'
      using errcode = '22023';
  end if;

  v_min_bid := coalesce(
    v_item.current_bid + v_item.bid_increment,
    v_item.starting_bid
  );

  if p_amount < v_min_bid then
    raise exception 'Bid must be at least %', v_min_bid
      using errcode = '22023';
  end if;

  -- Ceiling sanity check (DB-5)
  v_max_allowed_bid := greatest(v_min_bid * v_max_jump_multiplier, v_min_bid + v_max_jump_offset);
  if p_amount > v_max_allowed_bid then
    raise exception 'Bid exceeds the maximum allowed jump (%)', v_max_allowed_bid
      using errcode = '22023';
  end if;

  v_prev_bid    := v_item.current_bid;
  v_prev_bidder := v_item.current_bidder_id;

  -- Anti-snipe: if bid arrives within the final window, extend end_time.
  if v_item.end_time is not null
     and v_item.end_time - v_now < v_anti_snipe_window
  then
    v_extended := v_now + v_anti_snipe_window;
  end if;

  update public.items
  set current_bid       = p_amount,
      current_bidder_id = v_user_id,
      bid_count         = bid_count + 1,
      end_time          = coalesce(v_extended, end_time)
  where id = p_item_id;

  insert into public.bid_history (
    item_id, user_id, amount,
    previous_bidder_id, previous_bid, extended_end_time
  ) values (
    p_item_id, v_user_id, p_amount,
    v_prev_bidder, v_prev_bid, v_extended
  );

  return jsonb_build_object(
    'ok', true,
    'item_id', p_item_id,
    'amount', p_amount,
    'extended_end_time', v_extended,
    'previous_bidder_id', v_prev_bidder,
    'new_end_time', coalesce(v_extended, v_item.end_time)
  );
end;
$$;

comment on function public.place_bid is
  'Atomic bid placement with row-level locking, validation, post-lock timestamp, ceiling cap, and anti-sniping. Authenticated users only.';

-- ============================================================
-- server_time RPC
--
-- Tiny RPC so clients can sync countdowns against the database clock
-- rather than trusting the user's laptop clock.
-- ============================================================
create or replace function public.server_time()
returns timestamptz
language sql
stable
as $$
  select now();
$$;

comment on function public.server_time is
  'Returns the database NOW(). Clients call this on mount and every 30s to compute a clock offset for countdowns.';

-- ============================================================
-- close_expired_auctions
--
-- Mark all open items past their end_time as closed and record the winner.
-- ============================================================
create or replace function public.close_expired_auctions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_closed_count integer := 0;
begin
  with closed as (
    update public.items
    set status         = 'closed',
        winner_user_id = current_bidder_id,
        winning_bid    = current_bid
    where status = 'open'
      and end_time is not null
      and end_time <= now()
    returning id
  )
  select count(*) into v_closed_count from closed;

  return v_closed_count;
end;
$$;

comment on function public.close_expired_auctions is
  'Mark all open items past their end_time as closed and record the winner. Paused items are intentionally not closed while paused. Returns the count of items closed.';

-- ============================================================
-- open_scheduled_auctions
--
-- Transitions scheduled auctions whose start_time has arrived to open.
-- ============================================================
create or replace function public.open_scheduled_auctions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_opened_count integer := 0;
begin
  with opened as (
    update public.items
    set status = 'open'
    where status = 'scheduled'
      and start_time is not null
      and start_time <= now()
      and (end_time is null or end_time > now())
    returning id
  )
  select count(*) into v_opened_count from opened;

  return v_opened_count;
end;
$$;

comment on function public.open_scheduled_auctions is
  'Transitions scheduled auctions whose start_time has arrived (and end_time is null or in the future) to open. Returns count of items opened. Never touches paused items.';

-- ============================================================
-- Admin override RPCs (pause, resume, extend, force-close, cancel-bid)
-- ============================================================

-- pause_item: open -> paused
create or replace function public.pause_item(p_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.items;
begin
  if not public.is_admin() then
    raise exception 'Forbidden'
      using errcode = '42501';
  end if;

  select * into v_item
  from public.items
  where id = p_item_id
  for update;

  if not found then
    raise exception 'Item not found'
      using errcode = 'P0002';
  end if;

  if v_item.status <> 'open' then
    raise exception 'Only open items can be paused (current status: %)', v_item.status
      using errcode = '22023';
  end if;

  update public.items
  set status = 'paused'
  where id = p_item_id;

  insert into public.audit_log (
    actor_id, actor_email, action, target_type, target_id, metadata
  ) values (
    auth.uid(),
    (select email from public.profiles where id = auth.uid()),
    'admin.item.pause',
    'item',
    p_item_id::text,
    jsonb_build_object('item_name', v_item.name)
  );

  return jsonb_build_object(
    'ok', true,
    'item_id', p_item_id,
    'status', 'paused'
  );
end;
$$;

comment on function public.pause_item is
  'Transitions an item from open to paused with row-level locking and audit logging. Admins only.';

-- resume_item: paused -> open
create or replace function public.resume_item(p_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.items;
begin
  if not public.is_admin() then
    raise exception 'Forbidden'
      using errcode = '42501';
  end if;

  select * into v_item
  from public.items
  where id = p_item_id
  for update;

  if not found then
    raise exception 'Item not found'
      using errcode = 'P0002';
  end if;

  if v_item.status <> 'paused' then
    raise exception 'Only paused items can be resumed (current status: %)', v_item.status
      using errcode = '22023';
  end if;

  if v_item.end_time is not null and v_item.end_time <= clock_timestamp() then
    raise exception 'Cannot resume an expired item; extend the deadline first'
      using errcode = '22023';
  end if;

  update public.items
  set status = 'open'
  where id = p_item_id;

  insert into public.audit_log (
    actor_id, actor_email, action, target_type, target_id, metadata
  ) values (
    auth.uid(),
    (select email from public.profiles where id = auth.uid()),
    'admin.item.resume',
    'item',
    p_item_id::text,
    jsonb_build_object('item_name', v_item.name)
  );

  return jsonb_build_object(
    'ok', true,
    'item_id', p_item_id,
    'status', 'open'
  );
end;
$$;

comment on function public.resume_item is
  'Transitions an item from paused to open. Rejects if end_time has passed. Admins only.';

-- extend_deadline: add minutes to end_time
create or replace function public.extend_deadline(
  p_item_id uuid,
  p_minutes integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item         public.items;
  v_new_end_time timestamptz;
begin
  if not public.is_admin() then
    raise exception 'Forbidden'
      using errcode = '42501';
  end if;

  if p_minutes is null or p_minutes < 1 or p_minutes > 1440 then
    raise exception 'Extension must be between 1 and 1440 minutes'
      using errcode = '22023';
  end if;

  select * into v_item
  from public.items
  where id = p_item_id
  for update;

  if not found then
    raise exception 'Item not found'
      using errcode = 'P0002';
  end if;

  if v_item.status not in ('open', 'paused') then
    raise exception 'Only open or paused items can have their deadline extended (current status: %)', v_item.status
      using errcode = '22023';
  end if;

  v_new_end_time := coalesce(v_item.end_time, clock_timestamp()) + make_interval(mins => p_minutes);

  update public.items
  set end_time = v_new_end_time
  where id = p_item_id;

  insert into public.audit_log (
    actor_id, actor_email, action, target_type, target_id, metadata
  ) values (
    auth.uid(),
    (select email from public.profiles where id = auth.uid()),
    'admin.item.extend_deadline',
    'item',
    p_item_id::text,
    jsonb_build_object(
      'item_name', v_item.name,
      'minutes_added', p_minutes,
      'new_end_time', v_new_end_time
    )
  );

  return jsonb_build_object(
    'ok', true,
    'item_id', p_item_id,
    'new_end_time', v_new_end_time
  );
end;
$$;

comment on function public.extend_deadline is
  'Atomically extends the deadline of an open or paused item. Admins only.';

-- force_close_item: open|paused -> closed (assigns winner)
create or replace function public.force_close_item(p_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.items;
begin
  if not public.is_admin() then
    raise exception 'Forbidden'
      using errcode = '42501';
  end if;

  select * into v_item
  from public.items
  where id = p_item_id
  for update;

  if not found then
    raise exception 'Item not found'
      using errcode = 'P0002';
  end if;

  if v_item.status not in ('open', 'paused') then
    raise exception 'Only open or paused items can be force closed (current status: %)', v_item.status
      using errcode = '22023';
  end if;

  update public.items
  set status         = 'closed',
      winner_user_id = current_bidder_id,
      winning_bid    = current_bid
  where id = p_item_id;

  insert into public.audit_log (
    actor_id, actor_email, action, target_type, target_id, metadata
  ) values (
    auth.uid(),
    (select email from public.profiles where id = auth.uid()),
    'admin.item.force_close',
    'item',
    p_item_id::text,
    jsonb_build_object(
      'item_name', v_item.name,
      'winning_bid', v_item.current_bid,
      'winner_user_id', v_item.current_bidder_id
    )
  );

  return jsonb_build_object(
    'ok', true,
    'item_id', p_item_id,
    'status', 'closed',
    'winner_user_id', v_item.current_bidder_id,
    'winning_bid', v_item.current_bid
  );
end;
$$;

comment on function public.force_close_item is
  'Immediately closes an open or paused item, assigning the leading bidder as winner. Admins only.';

-- cancel_last_bid: soft-cancel newest live bid, recompute state
create or replace function public.cancel_last_bid(
  p_item_id uuid,
  p_reason  text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item                 public.items;
  v_bid                  public.bid_history;
  v_new_current_bid      numeric;
  v_new_current_bidder_id uuid;
  v_new_bid_count        integer;
  v_new_end_time         timestamptz;
begin
  if not public.is_admin() then
    raise exception 'Forbidden'
      using errcode = '42501';
  end if;

  if nullif(trim(p_reason), '') is null then
    raise exception 'Reason is required'
      using errcode = '22023';
  end if;

  -- 1. Row lock on items first (serializes with place_bid)
  select * into v_item
  from public.items
  where id = p_item_id
  for update;

  if not found then
    raise exception 'Item not found'
      using errcode = 'P0002';
  end if;

  -- 2. Pick and lock the newest live bid (order by id desc per DB-4)
  select * into v_bid
  from public.bid_history
  where item_id = p_item_id
    and cancelled_at is null
  order by id desc
  limit 1
  for update;

  if not found then
    raise exception 'No live bids to cancel'
      using errcode = '22023';
  end if;

  -- 3. Soft-cancel: append-only, never physically delete (DB-2)
  update public.bid_history
  set cancelled_at  = clock_timestamp(),
      cancelled_by  = auth.uid(),
      cancel_reason = trim(p_reason)
  where id = v_bid.id;

  -- 4. Recompute from remaining live bids only (order by id desc)
  select amount, user_id
  into v_new_current_bid, v_new_current_bidder_id
  from public.bid_history
  where item_id = p_item_id
    and cancelled_at is null
  order by id desc
  limit 1;

  select count(*)
  into v_new_bid_count
  from public.bid_history
  where item_id = p_item_id
    and cancelled_at is null;

  -- 5. Anti-snipe rollback: if cancelled bid extended end_time, revert by 60s
  v_new_end_time := v_item.end_time;
  if v_bid.extended_end_time is not null and v_new_end_time is not null then
    v_new_end_time := v_new_end_time - interval '60 seconds';
    if v_item.status = 'open' then
      v_new_end_time := greatest(v_new_end_time, clock_timestamp());
    end if;
  end if;

  -- 6. Atomically update items state (and winner if closed)
  update public.items
  set current_bid       = v_new_current_bid,
      current_bidder_id = v_new_current_bidder_id,
      bid_count         = v_new_bid_count,
      end_time          = v_new_end_time,
      winner_user_id    = case when status = 'closed' then v_new_current_bidder_id else winner_user_id end,
      winning_bid       = case when status = 'closed' then v_new_current_bid else winning_bid end
  where id = p_item_id;

  -- 7. In-transaction audit row
  insert into public.audit_log (
    actor_id, actor_email, action, target_type, target_id, metadata
  ) values (
    auth.uid(),
    (select email from public.profiles where id = auth.uid()),
    'admin.item.cancel_bid',
    'item',
    p_item_id::text,
    jsonb_build_object(
      'reason', trim(p_reason),
      'cancelled_bid_id', v_bid.id,
      'cancelled_amount', v_bid.amount,
      'new_current_bid', v_new_current_bid,
      'new_bid_count', v_new_bid_count
    )
  );

  return jsonb_build_object(
    'ok', true,
    'item_id', p_item_id,
    'cancelled_bid_id', v_bid.id,
    'cancelled_amount', v_bid.amount,
    'current_bid', v_new_current_bid,
    'current_bidder_id', v_new_current_bidder_id,
    'bid_count', v_new_bid_count,
    'end_time', v_new_end_time
  );
end;
$$;

comment on function public.cancel_last_bid is
  'Soft-cancels the newest live bid, recomputes current bid state from remaining live bids, reverses anti-snipe extension if applicable, and logs the action. Admins only.';

-- ============================================================
-- install_notification_webhooks
-- ============================================================
create or replace function public.install_notification_webhooks()
returns void
language plpgsql
security definer
as $$
declare
  v_secret text;
  v_headers text;
  v_base_url text;
begin
  -- Read webhook_secret from Supabase Vault (decrypted_secrets view)
  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'webhook_secret';

  if v_secret is null then
    v_secret := '';
  end if;

  -- Read project_url from Supabase Vault if customized, otherwise default to project ref URL
  select decrypted_secret into v_base_url
  from vault.decrypted_secrets
  where name = 'project_url';

  if v_base_url is null or v_base_url = '' then
    v_base_url := 'https://raxaicqhlbmyzngcubye.supabase.co';
  end if;

  v_headers := json_build_object(
    'Content-Type', 'application/json',
    'x-webhook-secret', v_secret
  )::text;

  -- 1. Trigger for bid placed (public.bid_history on INSERT)
  execute format(
    'create or replace trigger on_bid_placed_webhook
     after insert on public.bid_history
     for each row
     execute function supabase_functions.http_request(
       %L,
       ''POST'',
       %L,
       ''{}'',
       ''5000''
     );',
    v_base_url || '/functions/v1/on-bid-placed',
    v_headers
  );

  -- 2. Trigger for auction closed/cancelled (public.items on status update only)
  execute format(
    'create or replace trigger on_auction_closed_webhook
     after update of status on public.items
     for each row
     when (old.status is distinct from new.status)
     execute function supabase_functions.http_request(
       %L,
       ''POST'',
       %L,
       ''{}'',
       ''5000''
     );',
    v_base_url || '/functions/v1/on-auction-closed',
    v_headers
  );
end;
$$;

-- ============================================================
-- Function Privileges
-- ============================================================
revoke execute on all functions in schema public from public, anon;

-- Public clock sync RPC
grant execute on function public.server_time() to anon, authenticated;

-- Core bidding RPC
grant execute on function public.place_bid(uuid, numeric) to authenticated;

-- Helper used across RLS policies
grant execute on function public.is_admin() to authenticated;

-- Admin override RPCs (internally gated by public.is_admin())
grant execute on function public.pause_item(uuid) to authenticated;
grant execute on function public.resume_item(uuid) to authenticated;
grant execute on function public.extend_deadline(uuid, integer) to authenticated;
grant execute on function public.force_close_item(uuid) to authenticated;
grant execute on function public.cancel_last_bid(uuid, text) to authenticated;

-- Trigger functions called during row updates/inserts by authenticated users
grant execute on function public.touch_updated_at() to authenticated;
grant execute on function public.prevent_self_promotion() to authenticated;
grant execute on function public.handle_new_user() to authenticated;

-- Audit logging (authenticated only)
grant execute on function public.log_audit(text, text, text, jsonb) to authenticated;

-- Internal lifecycle maintenance functions (called by pg_cron as postgres role only)
revoke execute on function public.close_expired_auctions() from authenticated;
revoke execute on function public.open_scheduled_auctions() from authenticated;

-- Internal webhooks installation function (called during migrations or by postgres admin only)
revoke execute on function public.install_notification_webhooks() from public, anon, authenticated;

-- Prevent future functions from inheriting default public execute privilege
alter default privileges in schema public revoke execute on functions from public;
