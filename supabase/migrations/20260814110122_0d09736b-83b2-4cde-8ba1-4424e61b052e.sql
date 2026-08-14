-- 1. Guards: remove broad biometric row access, provide narrow status lookup
DROP POLICY IF EXISTS "Guards view biometrics in their estate" ON public.biometric_access;

CREATE OR REPLACE FUNCTION public.guard_biometric_status(_resident_id uuid)
RETURNS TABLE(biometric_type text, access_status text, enrollment_status text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.biometric_type, b.access_status, b.enrollment_status
  FROM public.biometric_access b
  WHERE b.resident_id = _resident_id
    AND b.estate_id = public.current_estate_id()
    AND (
      public.has_role(auth.uid(), 'guard') OR
      public.has_role(auth.uid(), 'estate_admin')
    )
$$;

REVOKE ALL ON FUNCTION public.guard_biometric_status(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.guard_biometric_status(uuid) TO authenticated;

-- 2. Storage: only shared folders are estate-readable; chat attachments are thread-scoped
DROP POLICY IF EXISTS "estate_media_read" ON storage.objects;
CREATE POLICY "estate_media_read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'estate-media'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_super_admin()
    OR (
      (storage.foldername(name))[2] IN (
        'announcements','community','blog','polls','collections','products','estate'
      )
      AND EXISTS (
        SELECT 1
        FROM public.profiles owner
        JOIN public.profiles viewer ON viewer.id = auth.uid()
        WHERE owner.id::text = (storage.foldername(storage.objects.name))[1]
          AND owner.estate_id IS NOT NULL
          AND owner.estate_id = viewer.estate_id
      )
    )
    OR (
      (storage.foldername(name))[2] = 'chat'
      AND EXISTS (
        SELECT 1
        FROM public.chat_messages m
        WHERE m.attachment_url = storage.objects.name
          AND (
            m.resident_id = auth.uid()
            OR m.sender_id = auth.uid()
            OR (
              public.has_role(auth.uid(), 'estate_admin')
              AND m.estate_id = public.current_estate_id()
            )
          )
      )
    )
  )
);

-- 3. Tickets: hide draft event ticket types from estate members
DROP POLICY IF EXISTS "tickets read" ON public.tickets;
CREATE POLICY "tickets read"
ON public.tickets FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = tickets.event_id
      AND (
        (e.visibility = 'public' AND e.status = 'published')
        OR e.organizer_id = auth.uid()
        OR (e.estate_id = public.current_estate_id() AND e.status = 'published')
        OR public.is_super_admin()
      )
  )
);