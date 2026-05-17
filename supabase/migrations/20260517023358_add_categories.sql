-- categories enum + items.categories column
--
-- Captured retroactively after the column was added directly via the
-- Supabase dashboard. The schema change is already live on the remote;
-- this file just makes the schema reproducible from migrations alone.

create type "public"."categories" as enum ('sport', 'hotel', 'food');

alter table "public"."items" add column "categories" public.categories;

create index items_categories_idx on public.items (categories);
