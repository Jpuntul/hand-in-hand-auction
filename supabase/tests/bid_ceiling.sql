begin;
select plan(2);

-- Seed bidder
insert into auth.users (id, email) values
  ('11111111-eeee-eeee-eeee-eeeeeeeeeeee', 'bidder_ceiling@test.com');

-- Seed open item with starting_bid = 2000
insert into public.items (
  id, item_no, name, status, starting_bid, bid_increment, start_time, end_time
) values (
  '22222222-eeee-eeee-eeee-eeeeeeeeeeee', 951, 'Ceiling Test Item', 'open', 2000, 100,
  now() - interval '1 hour', now() + interval '2 hours'
);

set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-eeee-eeee-eeee-eeeeeeeeeeee", "role": "authenticated"}';

-- 1. v_min_bid * 11 (22000) rejected
do $$
declare
  v_caught boolean := false;
begin
  begin
    perform public.place_bid('22222222-eeee-eeee-eeee-eeeeeeeeeeee', 22000);
  exception when others then
    v_caught := true;
  end;
  if not v_caught then
    raise exception 'v_min_bid * 11 was not rejected';
  end if;
end;
$$;
select ok(true, 'bid of v_min_bid * 11 is rejected by ceiling check');

-- 2. v_min_bid * 9 (18000) accepted
select is(
  (public.place_bid('22222222-eeee-eeee-eeee-eeeeeeeeeeee', 18000) ->> 'ok')::boolean,
  true,
  'bid of v_min_bid * 9 is accepted'
);

select * from finish();
rollback;
