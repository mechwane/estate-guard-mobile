-- 1) Extend the self-update freeze to also cover premium fields
CREATE OR REPLACE FUNCTION public.tg_profiles_freeze_admin_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF public.is_super_admin() THEN RETURN NEW; END IF;
  IF public.has_role(auth.uid(),'estate_admin') AND OLD.estate_id IS NOT NULL
     AND OLD.estate_id = public.current_estate_id() THEN
    RETURN NEW;
  END IF;
  -- Self update: freeze admin-controlled fields
  NEW.approved := OLD.approved;
  NEW.estate_id := OLD.estate_id;
  NEW.verification_status := OLD.verification_status;
  NEW.verification_notes := OLD.verification_notes;
  NEW.verification_submitted_at := OLD.verification_submitted_at;
  NEW.verification_reviewed_at := OLD.verification_reviewed_at;
  NEW.verification_reviewed_by := OLD.verification_reviewed_by;
  NEW.premium_plan := OLD.premium_plan;
  NEW.premium_expires_at := OLD.premium_expires_at;
  RETURN NEW;
END $function$;

-- 2) Attach the trigger on profiles (was defined but not attached)
DROP TRIGGER IF EXISTS profiles_freeze_admin_fields ON public.profiles;
CREATE TRIGGER profiles_freeze_admin_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_profiles_freeze_admin_fields();

-- 3) Restrict event_categories reads to authenticated users
DROP POLICY IF EXISTS "cats readable" ON public.event_categories;
CREATE POLICY "cats readable"
ON public.event_categories
FOR SELECT
TO authenticated
USING (true);
REVOKE SELECT ON public.event_categories FROM anon;