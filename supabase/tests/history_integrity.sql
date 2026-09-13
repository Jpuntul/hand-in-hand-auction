begin;
select plan(5);

-- Seed users
insert into auth.users (id, email) values
  ('11111111-dddd-dddd-dddd-dddddddddddd', 'admin_integrity@test.com'),
  ('22222222-dddd-dddd-dddd-dddddddddddd', 'bidder_integrity@test.com');

update public.profiles set is_admin = true where id = '11111111-dddd-dddd-dddd-dddddddddddd';

-- Seed open item
insert into public.items (
  id, item_no, name, status, starting_bid, bid_increment, start_time, end_time
) values (
  '33333333-dddd-dddd-dddd-dddddddddddd', 941, 'Integrity Item', 'open', 50, 10,
  now() - interval '1 hour', now() + interval '2 hours'
);

-- Place bid 1
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "22222222-dddd-dddd-dddd-dddddddddddd", "role": "authenticated"}';
select public.place_bid('33333333-dddd-dddd-dddd-dddddddddddd', 50);

set local role postgres;

-- 1. deleting an auth.users row that has bids raises (FK restrict)
do $$
declare
  v_caught boolean := false;
begin
  begin
    delete from auth.users where id = '22222222-dddd-dddd-dddd-dddddddddddd';
  exception when foreign_key_violation then
    v_caught := true;
  end;
  if not v_caught then
    raise exception 'Deleting auth.users with bids did not raise foreign_key_violation';
  end if;
end;
$$;
select ok(true, 'deleting an auth.users row that has bids raises FK restrict violation');

-- 2. deleting an item with bids raises (FK restrict)
do $$
declare
  v_caught boolean := false;
begin
  begin
    delete from public.items where id = '33333333-dddd-dddd-dddd-dddddddddddd';
  exception when foreign_key_violation then
    v_caught := true;
  end;
  if not v_caught then
    raise exception 'Deleting items with bids did not raise foreign_key_violation';
  end if;
end;
$$;
select ok(true, 'deleting an item with bids raises FK restrict violation');

-- 3. DELETE on bid_history as admin affects 0 rows (delete policy was dropped in H2)
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-dddd-dddd-dddd-dddddddddddd", "role": "authenticated"}';
delete from public.bid_history where item_id = '33333333-dddd-dddd-dddd-dddddddddddd';

set local role postgres;
select is(
  (select count(*) from public.bid_history where item_id = '33333333-dddd-dddd-dddd-dddddddddddd'),
  1::bigint,
  'DELETE on bid_history as admin affects 0 rows'
);

-- 4. Place second bid and test cancel_last_bid leaves cancelled_at set and items.current_bid = max live amount
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "22222222-dddd-dddd-dddd-dddddddddddd", "role": "authenticated"}';
select public.place_bid('33333333-dddd-dddd-dddd-dddddddddddd', 70);

set local "request.jwt.claims" to '{"sub": "11111111-dddd-dddd-dddd-dddddddddddd", "role": "authenticated"}';
select public.cancel_last_bid('33333333-dddd-dddd-dddd-dddddddddddd', 'Retracted bid');

set local role postgres;
select ok(
  (select cancelled_at from public.bid_history where item_id = '33333333-dddd-dddd-dddd-dddddddddddd' and amount = 70) is not null,
  'cancel_last_bid leaves the row with cancelled_at set'
);

select is(
  (select current_bid from public.items where id = '33333333-dddd-dddd-dddd-dddddddddddd'),
  50::numeric,
  'items.current_bid equals the max live amount after cancellation'
);

select * from finish();
rollback;
