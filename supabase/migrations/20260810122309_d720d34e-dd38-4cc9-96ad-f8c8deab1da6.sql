CREATE OR REPLACE FUNCTION public.set_estate_access(_user_id uuid, _approved boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_estate uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT estate_id INTO v_estate FROM public.profiles WHERE id = _user_id;
  IF NOT (public.is_super_admin()
          OR (public.has_role(auth.uid(),'estate_admin') AND v_estate = public.current_estate_id())) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  -- audit row is written by trigger trg_audit_profiles_access
  UPDATE public.profiles SET approved = _approved WHERE id = _user_id;
END $function$;

CREATE OR REPLACE FUNCTION public.review_verification(_user_id uuid, _approve boolean, _notes text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_estate uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT estate_id INTO v_estate FROM public.profiles WHERE id = _user_id;
  IF v_estate IS NULL THEN RAISE EXCEPTION 'Resident has no estate'; END IF;
  IF NOT (public.is_super_admin()
          OR (public.has_role(auth.uid(),'estate_admin') AND v_estate = public.current_estate_id())) THEN
    RAISE EXCEPTION 'Not authorised to review this profile';
  END IF;

  UPDATE public.profiles SET
    verification_status = CASE WHEN _approve THEN 'approved'::public.verification_status
                               ELSE 'rejected'::public.verification_status END,
    verification_reviewed_at = now(),
    verification_reviewed_by = auth.uid(),
    verification_notes = _notes,
    approved = CASE WHEN _approve THEN true ELSE approved END
  WHERE id = _user_id;
  -- audit rows are written by trigger trg_audit_profiles_access
END $function$;