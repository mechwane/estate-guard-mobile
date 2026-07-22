-- Estate Guard — Storage buckets and policies.
--
-- Run this against a fresh Supabase project AFTER `supabase db push`
-- has applied the public-schema migrations. Storage lives in the
-- `storage` schema and is not part of the public migration chain.

-- ─────────────────────────────────────────────────────────────────────
-- Buckets
-- ─────────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('verification-docs', 'verification-docs', false)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────
-- avatars: private. Each user owns files under `<auth.uid()>/…`.
-- ─────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "avatars_read_own" ON storage.objects;
CREATE POLICY "avatars_read_own"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "avatars_insert_own" ON storage.objects;
CREATE POLICY "avatars_insert_own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;
CREATE POLICY "avatars_update_own"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;
CREATE POLICY "avatars_delete_own"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ─────────────────────────────────────────────────────────────────────
-- verification-docs: private. Residents upload into their own folder.
-- Estate admins and super admins may read documents belonging to
-- residents in their estate.
-- ─────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "vdocs_insert_own" ON storage.objects;
CREATE POLICY "vdocs_insert_own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'verification-docs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "vdocs_read_own" ON storage.objects;
CREATE POLICY "vdocs_read_own"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'verification-docs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "vdocs_read_admin" ON storage.objects;
CREATE POLICY "vdocs_read_admin"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'verification-docs'
  AND (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id::text = (storage.foldername(storage.objects.name))[1]
        AND public.has_role(auth.uid(), 'estate_admin')
        AND p.estate_id = public.current_estate_id()
    )
  )
);

DROP POLICY IF EXISTS "vdocs_update_own" ON storage.objects;
CREATE POLICY "vdocs_update_own"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'verification-docs'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'verification-docs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "vdocs_delete_own" ON storage.objects;
CREATE POLICY "vdocs_delete_own"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'verification-docs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
