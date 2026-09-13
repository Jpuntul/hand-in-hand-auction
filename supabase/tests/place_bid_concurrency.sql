begin;
select plan(4);

-- Seed bidders
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'bidder1@test.com'),
  ('22222222-2222-2222-2222-222222222222', 'bidder2@test.com'),
  ('33333333-3333-3333-3333-333333333333', 'bidder3@test.com');

-- Seed open item
insert into public.items (
  id, item_no, name, status, starting_bid, bid_increment, start_time, end_time
) values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 901, 'Concurrency Test Item', 'open', 50, 10,
  now() - interval '1 hour', now() + interval '2 hours'
);

-- Bid 1: bidder 1 bids 60
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.place_bid('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 60);

-- Bid 2: bidder 2 bids 75
set local "request.jwt.claims" to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select public.place_bid('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 75);

-- Bid 3: bidder 3 bids 90
set local "request.jwt.claims" to '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select public.place_bid('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 90);

-- Bid 4: bidder 1 bids 110
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.place_bid('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 110);

-- Bid 5: bidder 2 bids 150
set local "request.jwt.claims" to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select public.place_bid('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 150);

-- Assertions
set local role postgres;

select is(
  (select bid_count from public.items where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  5,
  'bid_count equals total bids placed'
);

select is(
  (select current_bid from public.items where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  150::numeric,
  'current_bid equals max bid amount'
);

select is(
  (select current_bidder_id from public.items where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  '22222222-2222-2222-2222-222222222222'::uuid,
  'current_bidder_id equals user of max bid'
);

select is(
  (select count(*) from public.bid_history where item_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and cancelled_at is null),
  5::bigint,
  'bid_history has 5 live bids'
);

select * from finish();
rollback;
