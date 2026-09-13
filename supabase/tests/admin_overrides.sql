begin;
select plan(8);

-- Seed users
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'admin_override@test.com'),
  ('22222222-2222-2222-2222-222222222222', 'bidderA@test.com'),
  ('33333333-3333-3333-3333-333333333333', 'bidderB@test.com');

update public.profiles set is_admin = true where id = '11111111-1111-1111-1111-111111111111';

-- 1. cancel_last_bid after second bid leaves items consistent with bid_history
insert into public.items (
  id, item_no, name, status, starting_bid, bid_increment, start_time, end_time
) values (
  '11111111-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 921, 'Cancel Bid Item', 'open', 50, 10,
  now() - interval '1 hour', now() + interval '2 hours'
);

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select public.place_bid('11111111-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 60);

set local "request.jwt.claims" to '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select public.place_bid('11111111-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 80);

-- Cancel as admin
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.cancel_last_bid('11111111-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Mistake bid');

set local role postgres;
select is(
  (select current_bid from public.items where id = '11111111-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  60::numeric,
  'cancel_last_bid restores items.current_bid to previous bid'
);

select is(
  (select current_bidder_id from public.items where id = '11111111-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  '22222222-2222-2222-2222-222222222222'::uuid,
  'cancel_last_bid restores items.current_bidder_id to previous bidder'
);

select is(
  (select bid_count from public.items where id = '11111111-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  1,
  'cancel_last_bid decrements live bid_count'
);

-- 2. extend_deadline twice = +30 minutes
do $$
declare
  v_initial timestamptz := timestamptz '2026-09-13 18:00:00+00';
  v_res jsonb;
  v_final timestamptz;
begin
  update public.items set end_time = v_initial where id = '11111111-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  perform public.extend_deadline('11111111-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 15);
  perform public.extend_deadline('11111111-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 15);
  select end_time into v_final from public.items where id = '11111111-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  if v_final <> v_initial + interval '30 minutes' then
    raise exception 'Expected %, got %', v_initial + interval '30 minutes', v_final;
  end if;
end;
$$;
select ok(true, 'extend_deadline twice extends end_time by exactly 30 minutes');

-- 3. force_close_item on scheduled raises
insert into public.items (
  id, item_no, name, status, starting_bid, bid_increment, start_time, end_time
) values (
  '22222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 922, 'Scheduled Item', 'scheduled', 50, 10,
  now() + interval '1 hour', now() + interval '2 hours'
);

do $$
declare
  v_caught boolean := false;
begin
  begin
    perform public.force_close_item('22222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
  exception when others then
    v_caught := true;
  end;
  if not v_caught then
    raise exception 'force_close_item on scheduled did not raise';
  end if;
end;
$$;
select ok(true, 'force_close_item on scheduled status raises exception');

-- 4. cancel_last_bid on closed item updates winner_*
insert into public.items (
  id, item_no, name, status, starting_bid, bid_increment, start_time, end_time
) values (
  '33333333-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 923, 'Closing Item', 'open', 100, 10,
  now() - interval '1 hour', now() + interval '2 hours'
);

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select public.place_bid('33333333-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 100);

set local "request.jwt.claims" to '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';
select public.place_bid('33333333-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 120);

set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select public.force_close_item('33333333-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

-- Cancel newest bid on closed item
select public.cancel_last_bid('33333333-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Disqualified winner');

set local role postgres;
select is(
  (select winner_user_id from public.items where id = '33333333-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  '22222222-2222-2222-2222-222222222222'::uuid,
  'cancel_last_bid on closed item updates winner_user_id to previous bidder'
);

select is(
  (select winning_bid from public.items where id = '33333333-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  100::numeric,
  'cancel_last_bid on closed item updates winning_bid to previous bid'
);

-- 5. Cancelling an extended bid rolls end_time back
insert into public.items (
  id, item_no, name, status, starting_bid, bid_increment, start_time, end_time
) values (
  '44444444-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 924, 'Extended Item', 'open', 50, 10,
  clock_timestamp() - interval '10 minutes', clock_timestamp() + interval '30 seconds'
);

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select public.place_bid('44444444-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 60);

set local role postgres;
do $$
declare
  v_ext_end timestamptz;
  v_rolled_end timestamptz;
begin
  select end_time into v_ext_end from public.items where id = '44444444-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  set local role authenticated;
  set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
  perform public.cancel_last_bid('44444444-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Rollback snipe');

  set local role postgres;
  select end_time into v_rolled_end from public.items where id = '44444444-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  if v_rolled_end > v_ext_end - interval '55 seconds' then
    raise exception 'end_time was not rolled back: ext %, rolled %', v_ext_end, v_rolled_end;
  end if;
end;
$$;
select ok(true, 'cancelling an extended bid rolls end_time back by 60 seconds');

select * from finish();
rollback;
