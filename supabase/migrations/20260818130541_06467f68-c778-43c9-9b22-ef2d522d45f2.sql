
-- 1) Profiles: raise on privileged self-edits, also freeze email
CREATE OR REPLACE FUNCTION public.tg_profiles_freeze_admin_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF public.is_super_admin() THEN RETURN NEW; END IF;
  IF public.has_role(auth.uid(),'estate_admin') AND OLD.estate_id IS NOT NULL
     AND OLD.estate_id = public.current_estate_id() THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.approved IS DISTINCT FROM OLD.approved
     OR NEW.estate_id IS DISTINCT FROM OLD.estate_id
     OR NEW.verification_status IS DISTINCT FROM OLD.verification_status
     OR NEW.verification_notes IS DISTINCT FROM OLD.verification_notes
     OR NEW.verification_reviewed_at IS DISTINCT FROM OLD.verification_reviewed_at
     OR NEW.verification_reviewed_by IS DISTINCT FROM OLD.verification_reviewed_by
     OR NEW.premium_plan IS DISTINCT FROM OLD.premium_plan
     OR NEW.premium_expires_at IS DISTINCT FROM OLD.premium_expires_at
     OR NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'Approval, verification, premium, estate and email fields can only be changed by estate management';
  END IF;

  RETURN NEW;
END $function$;

-- 2) Guest invites: resident self-update policy limited to the resident role
DROP POLICY IF EXISTS "gi: resident update own" ON public.guest_invites;
CREATE POLICY "gi: resident update own"
ON public.guest_invites FOR UPDATE TO authenticated
USING (
  resident_id = auth.uid()
  AND estate_id = public.current_estate_id()
  AND public.has_role(auth.uid(), 'resident')
)
WITH CHECK (
  resident_id = auth.uid()
  AND estate_id = public.current_estate_id()
  AND public.has_role(auth.uid(), 'resident')
);

-- 3) Registrations: ensure attendee self-updates cannot touch validation fields
CREATE OR REPLACE FUNCTION public.tg_registrations_freeze_checkin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_is_organizer boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = OLD.event_id AND e.organizer_id = auth.uid()
  ) INTO v_is_organizer;

  IF public.is_super_admin() OR v_is_organizer THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.checked_in_at IS DISTINCT FROM OLD.checked_in_at
     OR NEW.validation_code IS DISTINCT FROM OLD.validation_code
     OR NEW.event_id IS DISTINCT FROM OLD.event_id
     OR NEW.ticket_id IS DISTINCT FROM OLD.ticket_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Check-in and ticket fields can only be changed by event staff';
  END IF;

  RETURN NEW;
END $function$;
