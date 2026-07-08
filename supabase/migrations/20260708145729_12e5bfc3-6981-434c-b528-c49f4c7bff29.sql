DROP POLICY IF EXISTS "avatars: read authenticated" ON storage.objects;
CREATE POLICY "avatars: owner read" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);