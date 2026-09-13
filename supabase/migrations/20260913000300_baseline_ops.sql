-- Baseline operations: Realtime publication, storage bucket, extensions, pg_cron schedule, and webhooks.

-- ============================================================
-- Realtime
--
-- Enable Realtime for items so client subscriptions get live updates
-- when bids change. (bid_history is not published directly).
-- ============================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'items'
  ) then
    alter publication supabase_realtime add table public.items;
  end if;
end $$;

-- ============================================================
-- Storage bucket for item images
--
-- Public bucket: anyone can read (which is what we want for an open auction
-- site). Only admins can upload/update/delete via storage.objects policies.
-- Bucket is capped at 5MB per file and limited to image MIME types.
-- ============================================================
insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
)
values (
  'item-images',
  'item-images',
  true,
  5242880, -- 5MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

drop policy if exists "item_images_admin_insert" on storage.objects;
create policy "item_images_admin_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'item-images' and public.is_admin()
  );

drop policy if exists "item_images_admin_update" on storage.objects;
create policy "item_images_admin_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'item-images' and public.is_admin())
  with check (bucket_id = 'item-images');

drop policy if exists "item_images_admin_delete" on storage.objects;
create policy "item_images_admin_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'item-images' and public.is_admin());

-- ============================================================
-- Extensions
-- ============================================================
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net;

-- ============================================================
-- pg_cron schedules
-- ============================================================

-- Unified auction lifecycle job (every minute)
select cron.schedule(
  'auction-lifecycle',
  '* * * * *',
  $$select public.open_scheduled_auctions(); select public.close_expired_auctions();$$
);

-- Prune audit log entries older than 90 days (daily at 03:00 UTC)
select cron.schedule(
  'audit-log-retention',
  '0 3 * * *',
  $$delete from public.audit_log where created_at < now() - interval '90 days'$$
);

-- ============================================================
-- Notification webhooks trigger installation
-- ============================================================
select public.install_notification_webhooks();
