-- =========================================================================
-- 0003_storage.sql — listing image bucket and its policies
--
-- Apply after 0002. Re-runnable.
-- =========================================================================

-- A public bucket: listing photos are not sensitive, and public objects let
-- next/image optimise them directly instead of going through signed URLs on
-- every render.
--
-- Limits are enforced here, at the storage layer, not only in the upload form:
-- a hand-crafted request cannot exceed them.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'listing-images',
  'listing-images',
  true,
  5242880,                                        -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;


-- --- Object policies -----------------------------------------------------
--
-- Objects are stored as `<user-uuid>/<filename>`, and every write policy
-- requires the first path segment to equal the caller's own uid. That is what
-- stops one user overwriting or deleting another user's images: the ownership
-- check is on the path itself, so there is no metadata to get out of sync.

drop policy if exists listing_images_read on storage.objects;
create policy listing_images_read
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'listing-images');

drop policy if exists listing_images_insert_own on storage.objects;
create policy listing_images_insert_own
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists listing_images_update_own on storage.objects;
create policy listing_images_update_own
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists listing_images_delete_own on storage.objects;
create policy listing_images_delete_own
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
