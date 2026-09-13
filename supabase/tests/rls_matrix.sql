begin;
select plan(7);

-- Seed users
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'bidderA@test.com'),
  ('22222222-2222-2222-2222-222222222222', 'bidderB@test.com'),
  ('33333333-3333-3333-3333-333333333333', 'admin@test.com');

update public.profiles set is_admin = true where id = '33333333-3333-3333-3333-333333333333';

-- Seed item
insert into public.items (
  id, item_no, name, status, starting_bid, bid_increment, start_time, end_time
) values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 902, 'RLS Item', 'open', 50, 10,
  now() - interval '1 hour', now() + interval '2 hours'
);

-- Seed audit_log row
insert into public.audit_log (actor_id, actor_email, action)
values ('33333333-3333-3333-3333-333333333333', 'admin@test.com', 'admin.test');

-- 1. Bidder A
set local role authenticated;
set local "request.jwt.claims" to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select is(
  (select count(*) from public.profiles),
  1::bigint,
  'bidder A sees only own profile'
);

select is(
  (select count(*) from public.audit_log),
  0::bigint,
  'audit_log is unreadable by bidder A'
);

-- Bidder A update items affects 0 rows
update public.items set name = 'Hacked' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select is(
  (select name from public.items where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  'RLS Item',
  'items update by bidder affects 0 rows'
);

-- 2. Bidder B
set local "request.jwt.claims" to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

select is(
  (select id from public.profiles limit 1),
  '22222222-2222-2222-2222-222222222222'::uuid,
  'bidder B sees only own profile'
);

-- 3. Admin
set local "request.jwt.claims" to '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';

select ok(
  (select count(*) from public.profiles) >= 3,
  'admin sees all profiles'
);

-- 4. public_profiles has no email
select hasnt_column(
  'public',
  'public_profiles',
  'email',
  'public_profiles view does not contain email column'
);

-- 5. anon: log_audit execute is revoked from anon
set local role postgres;

select ok(
  not has_function_privilege('anon', 'public.log_audit(text, text, text, jsonb)', 'execute'),
  'log_audit as anon has no execute privilege'
);

select * from finish();
rollback;
