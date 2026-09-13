begin;
select plan(6);

-- Seed bidder
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'sniper@test.com');

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

-- Case 1: item ending in 59 seconds (< 60s) -> extends end_time and writes extended_end_time
set local role postgres;
insert into public.items (
  id, item_no, name, status, starting_bid, bid_increment, start_time, end_time
) values (
  '11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 911, '59s Item', 'open', 50, 10,
  clock_timestamp() - interval '10 minutes', clock_timestamp() + interval '59 seconds'
);

set local role authenticated;
select public.place_bid('11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 60);

set local role postgres;
select ok(
  (select extended_end_time from public.bid_history where item_id = '11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa' limit 1) is not null,
  'bid on 59s item writes extended_end_time'
);

select ok(
  (select end_time from public.items where id = '11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa') > clock_timestamp(),
  'bid on 59s item extends end_time'
);

-- Case 2: item ending in 61 seconds (> 60s) -> no extension
set local role postgres;
insert into public.items (
  id, item_no, name, status, starting_bid, bid_increment, start_time, end_time
) values (
  '22222222-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 912, '61s Item', 'open', 50, 10,
  clock_timestamp() - interval '10 minutes', clock_timestamp() + interval '61 seconds'
);

set local role authenticated;
select public.place_bid('22222222-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 60);

set local role postgres;
select ok(
  (select extended_end_time from public.bid_history where item_id = '22222222-aaaa-aaaa-aaaa-aaaaaaaaaaaa' limit 1) is null,
  'bid on 61s item does not write extended_end_time'
);

select ok(
  (select end_time from public.items where id = '22222222-aaaa-aaaa-aaaa-aaaaaaaaaaaa') <= clock_timestamp() + interval '62 seconds',
  'bid on 61s item preserves original end_time'
);

-- Case 3: exactly 60 seconds (pinned: place_bid uses strict <, so >= 60s does not extend)
set local role postgres;
insert into public.items (
  id, item_no, name, status, starting_bid, bid_increment, start_time, end_time
) values (
  '33333333-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 913, '60s Item', 'open', 50, 10,
  clock_timestamp() - interval '10 minutes', clock_timestamp() + interval '60.5 seconds'
);

set local role authenticated;
select public.place_bid('33333333-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 60);

set local role postgres;
select ok(
  (select extended_end_time from public.bid_history where item_id = '33333333-aaaa-aaaa-aaaa-aaaaaaaaaaaa' limit 1) is null,
  'bid at 60s boundary does not extend (strict < 60s rule pinned)'
);

select is(
  (select count(*) from public.bid_history where item_id = '33333333-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and extended_end_time is null),
  1::bigint,
  'exactly 60s bid confirmed not extended'
);

select * from finish();
rollback;
