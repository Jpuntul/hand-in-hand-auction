begin;
select plan(2);

-- Seed users
insert into auth.users (id, email) values
  ('11111111-9999-9999-9999-999999999999', 'bidderA_order@test.com'),
  ('22222222-9999-9999-9999-999999999999', 'bidderB_order@test.com');

-- Seed open item
insert into public.items (
  id, item_no, name, status, starting_bid, bid_increment, start_time, end_time
) values (
  '33333333-9999-9999-9999-999999999999', 971, 'Ordering Item', 'open', 50, 10,
  now() - interval '1 hour', now() + interval '2 hours'
);

-- In a single transaction block where transaction_timestamp() / now() is frozen:
-- Pre-H3: created_at defaulted to now(), so subsequent bids within a transaction shared identical timestamps.
-- Post-H3: created_at defaults to clock_timestamp(), guaranteeing A.created_at < B.created_at.

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-9999-9999-9999-999999999999", "role": "authenticated"}';
select public.place_bid('33333333-9999-9999-9999-999999999999', 60);

-- Sleep 20ms: now() remains fixed, clock_timestamp() advances
select pg_sleep(0.02);

set local "request.jwt.claims" to '{"sub": "22222222-9999-9999-9999-999999999999", "role": "authenticated"}';
select public.place_bid('33333333-9999-9999-9999-999999999999', 80);

set local role postgres;

-- 1. A.id < B.id
select ok(
  (select id from public.bid_history where item_id = '33333333-9999-9999-9999-999999999999' and amount = 60) <
  (select id from public.bid_history where item_id = '33333333-9999-9999-9999-999999999999' and amount = 80),
  'bid A.id < bid B.id'
);

-- 2. A.created_at < B.created_at (guards clock_timestamp() regression)
select ok(
  (select created_at from public.bid_history where item_id = '33333333-9999-9999-9999-999999999999' and amount = 60) <
  (select created_at from public.bid_history where item_id = '33333333-9999-9999-9999-999999999999' and amount = 80),
  'bid A.created_at < bid B.created_at (monotonic clock_timestamp default)'
);

select * from finish();
rollback;
