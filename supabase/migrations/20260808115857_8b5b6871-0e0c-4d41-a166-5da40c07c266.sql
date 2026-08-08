-- 1) estate-media: restrict reads to same-estate members (or own files / super admin)
DROP POLICY IF EXISTS "estate_media_read" ON storage.objects;
CREATE POLICY "estate_media_read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'estate-media'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.profiles owner
      JOIN public.profiles viewer ON viewer.id = auth.uid()
      WHERE owner.id::text = (storage.foldername(storage.objects.name))[1]
        AND owner.estate_id IS NOT NULL
        AND owner.estate_id = viewer.estate_id
    )
  )
);

-- 2) support_otps: never expose OTP codes to estate admins
DROP POLICY IF EXISTS "Estate admins can view support otps" ON public.support_otps;
REVOKE SELECT ON public.support_otps FROM authenticated;

CREATE OR REPLACE FUNCTION public.admin_recent_support_otps(_limit integer DEFAULT 5)
RETURNS TABLE (
  id uuid,
  email text,
  purpose text,
  expires_at timestamptz,
  used_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.email, o.purpose, o.expires_at, o.used_at, o.created_at
  FROM public.support_otps o
  WHERE o.estate_id = public.current_estate_id()
    AND public.has_role(auth.uid(), 'estate_admin')
  ORDER BY o.created_at DESC
  LIMIT greatest(1, least(coalesce(_limit, 5), 50));
$$;

REVOKE ALL ON FUNCTION public.admin_recent_support_otps(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_recent_support_otps(integer) TO authenticated;