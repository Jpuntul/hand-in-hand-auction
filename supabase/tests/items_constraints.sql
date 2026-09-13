begin;
select plan(5);

-- Seed users
insert into auth.users (id, email) values
  ('11111111-ffff-ffff-ffff-ffffffffffff', 'user1_constraints@test.com'),
  ('22222222-ffff-ffff-ffff-ffffffffffff', 'user2_constraints@test.com');

-- 1. open with null end_time rejected
do $$
declare
  v_caught boolean := false;
begin
  begin
    insert into public.items (item_no, name, status, starting_bid, bid_increment, end_time)
    values (961, 'Open No End Time', 'open', 10, 5, NULL);
  exception when check_violation then
    v_caught := true;
  end;
  if not v_caught then
    raise exception 'open item with null end_time was not rejected';
  end if;
end;
$$;
select ok(true, 'open item with null end_time rejected by items_open_requires_end_time');

-- 2. scheduled with a winner_user_id rejected
do $$
declare
  v_caught boolean := false;
begin
  begin
    insert into public.items (item_no, name, status, starting_bid, bid_increment, start_time, end_time, winner_user_id)
    values (962, 'Scheduled With Winner', 'scheduled', 10, 5, now() + interval '1 day', now() + interval '2 days', '11111111-ffff-ffff-ffff-ffffffffffff');
  exception when check_violation then
    v_caught := true;
  end;
  if not v_caught then
    raise exception 'scheduled item with winner_user_id was not rejected';
  end if;
end;
$$;
select ok(true, 'scheduled item with winner_user_id rejected by items_winner_only_when_closed');

-- 3. closed with winner_user_id <> current_bidder_id rejected
do $$
declare
  v_caught boolean := false;
begin
  begin
    insert into public.items (
      item_no, name, status, starting_bid, bid_increment, end_time,
      current_bidder_id, current_bid, winner_user_id, winning_bid
    ) values (
      963, 'Closed Inconsistent Winner', 'closed', 10, 5, now() - interval '1 hour',
      '11111111-ffff-ffff-ffff-ffffffffffff', 100,
      '22222222-ffff-ffff-ffff-ffffffffffff', 100
    );
  exception when check_violation then
    v_caught := true;
  end;
  if not v_caught then
    raise exception 'closed item with winner_user_id <> current_bidder_id was not rejected';
  end if;
end;
$$;
select ok(true, 'closed item with winner_user_id <> current_bidder_id rejected by items_closed_has_consistent_winner');

-- 4. PATCH items.current_bid as authenticated rejected (after H5)
select ok(
  not has_column_privilege('authenticated', 'public.items', 'current_bid', 'update'),
  'authenticated has no update privilege on items.current_bid column'
);

-- Seed item for direct update test
insert into public.items (
  id, item_no, name, status, starting_bid, bid_increment, start_time, end_time
) values (
  '33333333-ffff-ffff-ffff-ffffffffffff', 964, 'Privilege Item', 'open', 50, 10,
  now() - interval '1 hour', now() + interval '2 hours'
);

do $$
declare
  v_caught boolean := false;
begin
  begin
    set local role authenticated;
    set local "request.jwt.claims" to '{"sub": "11111111-ffff-ffff-ffff-ffffffffffff", "role": "authenticated"}';
    update public.items set current_bid = 999 where id = '33333333-ffff-ffff-ffff-ffffffffffff';
  exception when insufficient_privilege then
    v_caught := true;
  end;
  if not v_caught then
    raise exception 'direct update on current_bid as authenticated was not rejected with 42501';
  end if;
end;
$$;
select ok(true, 'updating items.current_bid as authenticated raises SQLSTATE 42501');

select * from finish();
rollback;
