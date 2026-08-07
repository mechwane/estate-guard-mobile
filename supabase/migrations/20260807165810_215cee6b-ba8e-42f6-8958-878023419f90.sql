DROP POLICY IF EXISTS "estate_media_read" ON storage.objects;
CREATE POLICY "estate_media_read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'estate-media');

DROP POLICY IF EXISTS "estate_media_insert_own" ON storage.objects;
CREATE POLICY "estate_media_insert_own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'estate-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "estate_media_update_own" ON storage.objects;
CREATE POLICY "estate_media_update_own"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'estate-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'estate-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "estate_media_delete_own" ON storage.objects;
CREATE POLICY "estate_media_delete_own"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'estate-media'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'estate_admin')
    OR public.has_role(auth.uid(), 'super_admin')
  )
);