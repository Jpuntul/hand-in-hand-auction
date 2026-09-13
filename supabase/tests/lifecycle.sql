begin;
select plan(5);

-- Seed items for open_scheduled_auctions testing
insert into public.items (
  id, item_no, name, status, starting_bid, bid_increment, start_time, end_time
) values
  ('11111111-cccc-cccc-cccc-cccccccccccc', 931, 'Past Scheduled Item', 'scheduled', 50, 10,
   now() - interval '10 minutes', now() + interval '2 hours'),
  ('22222222-cccc-cccc-cccc-cccccccccccc', 932, 'Paused Scheduled Item', 'paused', 50, 10,
   now() - interval '10 minutes', now() + interval '2 hours'),
  ('33333333-cccc-cccc-cccc-cccccccccccc', 933, 'Future Scheduled Item', 'scheduled', 50, 10,
   now() + interval '10 minutes', now() + interval '2 hours');

-- Run open_scheduled_auctions()
select public.open_scheduled_auctions();

select is(
  (select status from public.items where id = '11111111-cccc-cccc-cccc-cccccccccccc'),
  'open'::public.item_status,
  'open_scheduled_auctions opens past-start_time scheduled item'
);

select is(
  (select status from public.items where id = '22222222-cccc-cccc-cccc-cccccccccccc'),
  'paused'::public.item_status,
  'open_scheduled_auctions ignores paused item'
);

select is(
  (select status from public.items where id = '33333333-cccc-cccc-cccc-cccccccccccc'),
  'scheduled'::public.item_status,
  'open_scheduled_auctions does not open future scheduled item'
);

-- Seed items for close_expired_auctions testing
insert into public.items (
  id, item_no, name, status, starting_bid, bid_increment, start_time, end_time
) values
  ('44444444-cccc-cccc-cccc-cccccccccccc', 934, 'Expired Open Item', 'open', 50, 10,
   now() - interval '2 hours', now() - interval '5 minutes'),
  ('55555555-cccc-cccc-cccc-cccccccccccc', 935, 'Expired Paused Item', 'paused', 50, 10,
   now() - interval '2 hours', now() - interval '5 minutes');

-- Run close_expired_auctions()
select public.close_expired_auctions();

select is(
  (select status from public.items where id = '44444444-cccc-cccc-cccc-cccccccccccc'),
  'closed'::public.item_status,
  'close_expired_auctions closes past-end_time open item'
);

select is(
  (select status from public.items where id = '55555555-cccc-cccc-cccc-cccccccccccc'),
  'paused'::public.item_status,
  'close_expired_auctions ignores paused item'
);

select * from finish();
rollback;
