-- Storage bucket for item images.
--
-- Public bucket: anyone can read (which is what we want for an open auction
-- site). Only admins can upload/update/delete via storage.objects policies.
-- Bucket is capped at 5MB per file and limited to image MIME types.

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

-- Admin INSERT
create policy "item_images_admin_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'item-images' and public.is_admin()
  );

-- Admin UPDATE (e.g., overwrite)
create policy "item_images_admin_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'item-images' and public.is_admin())
  with check (bucket_id = 'item-images');

-- Admin DELETE
create policy "item_images_admin_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'item-images' and public.is_admin());

-- Public read is implicit because public=true on the bucket.
