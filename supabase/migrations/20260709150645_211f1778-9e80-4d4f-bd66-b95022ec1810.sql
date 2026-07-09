
-- Storage DELETE policies
CREATE POLICY "avatars: owner delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "verif docs: owner or estate admin delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'verification-docs' AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_super_admin()
      OR (public.has_role(auth.uid(), 'estate_admin'::public.app_role) AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id::text = (storage.foldername(objects.name))[1]
          AND p.estate_id = public.current_estate_id()
      ))
    )
  );

-- Issues: move public role policies to authenticated
DROP POLICY IF EXISTS "issues: guard insert" ON public.issues;
DROP POLICY IF EXISTS "issues: guard update own" ON public.issues;
DROP POLICY IF EXISTS "issues: read scope" ON public.issues;

CREATE POLICY "issues: guard insert" ON public.issues
  FOR INSERT TO authenticated
  WITH CHECK (
    estate_id = public.current_estate_id()
    AND public.has_role(auth.uid(), 'guard'::public.app_role)
    AND reporter_id = auth.uid()
    AND resident_id IS NULL
  );

CREATE POLICY "issues: guard update own" ON public.issues
  FOR UPDATE TO authenticated
  USING (
    estate_id = public.current_estate_id()
    AND reporter_id = auth.uid()
    AND public.has_role(auth.uid(), 'guard'::public.app_role)
  )
  WITH CHECK (
    estate_id = public.current_estate_id()
    AND reporter_id = auth.uid()
  );

CREATE POLICY "issues: read scope" ON public.issues
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR resident_id = auth.uid()
    OR reporter_id = auth.uid()
    OR (estate_id = public.current_estate_id() AND (
      public.has_role(auth.uid(), 'estate_admin'::public.app_role)
      OR public.has_role(auth.uid(), 'guard'::public.app_role)
    ))
  );

-- Tickets: restrict read policy to authenticated
DROP POLICY IF EXISTS "tickets read" ON public.tickets;

CREATE POLICY "tickets read" ON public.tickets
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = tickets.event_id
        AND (
          (e.visibility = 'public' AND e.status = 'published')
          OR e.organizer_id = auth.uid()
          OR e.estate_id = public.current_estate_id()
          OR public.is_super_admin()
        )
    )
  );

-- Bills: tighten resident mark-paid policy so only unpaid bills can be transitioned to paid
DROP POLICY IF EXISTS "bills: resident mark paid" ON public.bills;

CREATE POLICY "bills: resident mark paid" ON public.bills
  FOR UPDATE TO authenticated
  USING (resident_id = auth.uid() AND status <> 'paid'::public.bill_status)
  WITH CHECK (resident_id = auth.uid() AND status = 'paid'::public.bill_status);
