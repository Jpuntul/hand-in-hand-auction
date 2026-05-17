-- watchlist: a user's starred items.
--
-- Composite PK on (user_id, item_id) means a user can only watch an item
-- once. Cascade deletes from both sides keep rows tidy.

create table public.watchlist (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  item_id    uuid not null references public.items(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

create index watchlist_user_id_idx on public.watchlist (user_id);
create index watchlist_item_id_idx on public.watchlist (item_id);

alter table public.watchlist enable row level security;

create policy watchlist_select_own
  on public.watchlist for select
  to authenticated
  using (user_id = auth.uid());

create policy watchlist_insert_own
  on public.watchlist for insert
  to authenticated
  with check (user_id = auth.uid());

create policy watchlist_delete_own
  on public.watchlist for delete
  to authenticated
  using (user_id = auth.uid());

comment on table public.watchlist is
  'Per-user starred items. Users see and manage only their own rows via RLS.';
