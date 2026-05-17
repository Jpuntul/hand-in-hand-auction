-- Auction lifecycle: auto-close + server-time RPC + missing index.
--
-- close_expired_auctions: scheduled function that finds items past
-- end_time and marks them closed, declaring the leading bidder as winner.
-- Phase 4 will extend this to send won/lost notifications.
--
-- server_time(): tiny RPC so clients can sync countdowns against the
-- database clock rather than trusting the user's laptop clock.
--
-- pg_cron schedule: runs close_expired_auctions every minute.

-- ============================================================
-- Categories index (the column was added directly via dashboard;
-- this catches the missing index that filter queries will need.)
-- ============================================================
create index if not exists items_categories_idx
  on public.items (categories);

-- ============================================================
-- server_time
-- ============================================================
create or replace function public.server_time()
returns timestamptz
language sql
stable
as $$
  select now();
$$;

grant execute on function public.server_time() to anon, authenticated;

comment on function public.server_time is
  'Returns the database NOW(). Clients call this on mount and every 30s to compute a clock offset for countdowns.';

-- ============================================================
-- close_expired_auctions
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
  'Mark all open items past their end_time as closed and record the winner. Returns the count of items closed.';

-- ============================================================
-- pg_cron schedule (every minute)
-- ============================================================
create extension if not exists pg_cron with schema extensions;

-- Idempotent: cron.schedule replaces an existing job of the same name.
select cron.schedule(
  'close-expired-auctions',
  '* * * * *',
  $$select public.close_expired_auctions()$$
);
