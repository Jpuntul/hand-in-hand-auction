-- Baseline schema: types, tables, constraints, indexes, views, comments.
--
-- Tables:
--   profiles           — public user data linked to auth.users
--   items              — auction items with denormalized current-bid state
--   bid_history        — append-only log of every accepted bid
--   notification_prefs — per-user email/push opt-in + push subscriptions
--   audit_log          — admin actions and security events
--   watchlist          — per-user starred items
-- Views:
--   public_profiles    — display names only for privacy (owner postgres, security_invoker=false)
--   user_bid_counts    — aggregated live bid counts per user
--   open_items_revenue — current bids sum across open items

-- ============================================================
-- Enums
-- ============================================================
do $$ begin
  create type public.item_status as enum (
    'scheduled', 'open', 'closed', 'cancelled', 'paused'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.categories as enum (
    'sport', 'hotel', 'food'
  );
exception
  when duplicate_object then null;
end $$;

-- ============================================================
-- profiles
-- ============================================================
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text,
  email         text,
  phone         text,
  is_admin      boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint profiles_display_name_len check (display_name is null or length(display_name) <= 100),
  constraint profiles_phone_len        check (phone is null or length(phone) <= 50)
);

create index if not exists profiles_is_admin_idx
  on public.profiles (is_admin)
  where is_admin = true;

comment on table public.profiles is
  'Public user profile data extending auth.users';

-- ============================================================
-- items
-- ============================================================
create table if not exists public.items (
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
  categories         public.categories,
  notified_at        timestamptz,
  constraint items_starting_bid_positive  check (starting_bid > 0),
  constraint items_bid_increment_positive check (bid_increment > 0),
  constraint items_end_after_start
    check (end_time is null or start_time is null or end_time > start_time),
  constraint items_bid_count_nonneg
    check (bid_count >= 0),
  constraint items_open_requires_end_time
    check (status <> 'open' or end_time is not null),
  constraint items_winner_only_when_closed
    check (status = 'closed' or (winner_user_id is null and winning_bid is null)),
  constraint items_closed_has_consistent_winner
    check (status <> 'closed'
           or (winner_user_id is not distinct from current_bidder_id
               and winning_bid is not distinct from current_bid))
);

create index if not exists items_status_idx       on public.items (status);
create index if not exists items_end_time_idx     on public.items (end_time);
create index if not exists items_current_bid_idx  on public.items (current_bid desc nulls last);
create index if not exists items_categories_idx   on public.items (categories);

comment on table public.items is
  'Auction items with denormalized current bid state for fast reads';
comment on column public.items.notified_at is
  'Timestamp when closing or cancellation notifications were dispatched; null if pending';

-- ============================================================
-- bid_history
-- ============================================================
create table if not exists public.bid_history (
  id                  bigint generated always as identity primary key,
  item_id             uuid not null references public.items(id) on delete restrict,
  user_id             uuid not null references public.profiles(id) on delete restrict,
  amount              numeric(12, 2) not null,
  previous_bidder_id  uuid references public.profiles(id) on delete set null,
  previous_bid        numeric(12, 2),
  extended_end_time   timestamptz,
  created_at          timestamptz not null default clock_timestamp(),
  cancelled_at        timestamptz,
  cancelled_by        uuid references public.profiles(id) on delete set null,
  cancel_reason       text,
  constraint bid_history_amount_positive check (amount > 0),
  constraint bid_history_cancel_reason_required
    check (cancelled_at is null or nullif(trim(cancel_reason), '') is not null)
);

create index if not exists bid_history_item_id_idx on public.bid_history (item_id, id desc);
create index if not exists bid_history_user_id_idx on public.bid_history (user_id, created_at desc);
create index if not exists bid_history_item_live_idx
  on public.bid_history (item_id, id desc)
  where cancelled_at is null;

comment on table public.bid_history is
  'Append-only. Cancellation sets cancelled_* via cancel_last_bid(); rows are never deleted.';
comment on column public.bid_history.id is
  'Canonical accepted order. Always order by id, never by created_at, when the order matters.';
comment on column public.bid_history.extended_end_time is
  'New end_time if this bid triggered anti-snipe extension (null otherwise)';

-- ============================================================
-- notification_prefs
-- ============================================================
create table if not exists public.notification_prefs (
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
create table if not exists public.audit_log (
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

create index if not exists audit_log_actor_id_idx   on public.audit_log (actor_id, created_at desc);
create index if not exists audit_log_action_idx     on public.audit_log (action, created_at desc);
create index if not exists audit_log_target_idx     on public.audit_log (target_type, target_id, created_at desc);
create index if not exists audit_log_created_at_idx on public.audit_log (created_at desc);

comment on table public.audit_log is
  'Admin actions and security events (login failures, role changes, bid cancellations, etc.)';

-- ============================================================
-- watchlist
-- ============================================================
create table if not exists public.watchlist (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  item_id    uuid not null references public.items(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

create index if not exists watchlist_item_id_idx on public.watchlist (item_id);

comment on table public.watchlist is
  'Per-user starred items. Users see and manage only their own rows via RLS.';

-- ============================================================
-- Views
-- ============================================================

-- Donor privacy view: display names only (bypasses profiles own-row RLS as postgres owner)
create or replace view public.public_profiles
  with (security_invoker = false) as
  select id, display_name from public.profiles;

alter view public.public_profiles owner to postgres;

revoke all on public.public_profiles from public, anon, authenticated;
grant select on public.public_profiles to anon, authenticated;

comment on view public.public_profiles is
  'Display names only. Exists so bid history can show who bid without exposing profiles.email/phone.';

-- Admin views: live bid counts per user and open items revenue
create or replace view public.user_bid_counts with (security_invoker = true) as
  select user_id, count(*)::int as bid_count
  from public.bid_history
  where cancelled_at is null
  group by user_id;

create or replace view public.open_items_revenue with (security_invoker = true) as
  select coalesce(sum(current_bid), 0)::numeric as revenue
  from public.items
  where status = 'open';

grant select on public.user_bid_counts, public.open_items_revenue to authenticated;
