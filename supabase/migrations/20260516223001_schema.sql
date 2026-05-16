-- Initial schema for the Hand in Hand auction platform.
--
-- Tables created in this migration:
--   profiles            — public user data linked to auth.users
--   items               — auction items with denormalized current-bid state
--   bid_history         — append-only log of every accepted bid
--   notification_prefs  — per-user email/push opt-in + push subscriptions
--   audit_log           — admin actions and security events

-- ============================================================
-- profiles
-- ============================================================
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text,
  email         text,
  phone         text,
  is_admin      boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index profiles_is_admin_idx
  on public.profiles (is_admin)
  where is_admin = true;

comment on table public.profiles is
  'Public user profile data extending auth.users';

-- ============================================================
-- items
-- ============================================================
create type public.item_status as enum (
  'scheduled', 'open', 'closed', 'cancelled'
);

create table public.items (
  id                 uuid primary key default gen_random_uuid(),
  item_no            integer unique,
  name               text not null,
  description        text,
  sponsor            text,
  retail_value       numeric(12, 2),
  starting_bid       numeric(12, 2) not null,
  bid_increment      numeric(12, 2) not null default 500,
  current_bid        numeric(12, 2),
  current_bidder_id  uuid references public.profiles(id) on delete set null,
  bid_count          integer not null default 0,
  start_time         timestamptz,
  end_time           timestamptz,
  status             public.item_status not null default 'scheduled',
  winner_user_id     uuid references public.profiles(id) on delete set null,
  winning_bid        numeric(12, 2),
  image_urls         text[] not null default '{}',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint items_starting_bid_positive  check (starting_bid > 0),
  constraint items_bid_increment_positive check (bid_increment > 0),
  constraint items_end_after_start
    check (end_time is null or start_time is null or end_time > start_time)
);

create index items_status_idx       on public.items (status);
create index items_end_time_idx     on public.items (end_time);
create index items_current_bid_idx  on public.items (current_bid desc nulls last);
create index items_item_no_idx      on public.items (item_no);

comment on table public.items is
  'Auction items with denormalized current bid state for fast reads';

-- ============================================================
-- bid_history
-- ============================================================
create table public.bid_history (
  id                  bigint generated always as identity primary key,
  item_id             uuid not null references public.items(id) on delete cascade,
  user_id             uuid not null references public.profiles(id) on delete cascade,
  amount              numeric(12, 2) not null,
  previous_bidder_id  uuid references public.profiles(id) on delete set null,
  previous_bid        numeric(12, 2),
  extended_end_time   timestamptz,
  created_at          timestamptz not null default now(),
  constraint bid_history_amount_positive check (amount > 0)
);

create index bid_history_item_id_idx on public.bid_history (item_id, created_at desc);
create index bid_history_user_id_idx on public.bid_history (user_id, created_at desc);

comment on table public.bid_history is
  'Append-only log of all accepted bids; written by place_bid() only';
comment on column public.bid_history.extended_end_time is
  'New end_time if this bid triggered anti-snipe extension (null otherwise)';

-- ============================================================
-- notification_prefs
-- ============================================================
create table public.notification_prefs (
  user_id             uuid primary key references public.profiles(id) on delete cascade,
  email_optin         boolean not null default true,
  push_optin          boolean not null default false,
  push_subscriptions  jsonb not null default '[]'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table public.notification_prefs is
  'Per-user email/push opt-in flags and Web Push subscription objects';

-- ============================================================
-- audit_log
-- ============================================================
create table public.audit_log (
  id           bigint generated always as identity primary key,
  actor_id     uuid references public.profiles(id) on delete set null,
  actor_email  text,
  action       text not null,
  target_type  text,
  target_id    text,
  metadata     jsonb not null default '{}'::jsonb,
  ip_address   inet,
  user_agent   text,
  created_at   timestamptz not null default now()
);

create index audit_log_actor_id_idx   on public.audit_log (actor_id, created_at desc);
create index audit_log_action_idx     on public.audit_log (action, created_at desc);
create index audit_log_target_idx     on public.audit_log (target_type, target_id, created_at desc);
create index audit_log_created_at_idx on public.audit_log (created_at desc);

comment on table public.audit_log is
  'Admin actions and security events (login failures, role changes, bid cancellations, etc.)';
