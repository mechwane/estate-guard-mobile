
-- Incident severity enum
DO $$ BEGIN
  CREATE TYPE public.issue_severity AS ENUM ('low','medium','high','critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Extend issues for guard incident reports & admin response tracking
ALTER TABLE public.issues
  ALTER COLUMN resident_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS severity public.issue_severity NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS reporter_id uuid,
  ADD COLUMN IF NOT EXISTS reporter_role public.app_role,
  ADD COLUMN IF NOT EXISTS responded_by uuid,
  ADD COLUMN IF NOT EXISTS responded_at timestamptz;

-- Broaden SELECT to include guards viewing incidents in their estate + their own reports
DROP POLICY IF EXISTS "issues: read scope" ON public.issues;
CREATE POLICY "issues: read scope" ON public.issues FOR SELECT
USING (
  public.is_super_admin()
  OR resident_id = auth.uid()
  OR reporter_id = auth.uid()
  OR (estate_id = public.current_estate_id() AND (
        public.has_role(auth.uid(),'estate_admin')
     OR public.has_role(auth.uid(),'guard')
  ))
);

-- Allow guards to file incident reports (no resident_id, reporter_id = self)
DROP POLICY IF EXISTS "issues: guard insert" ON public.issues;
CREATE POLICY "issues: guard insert" ON public.issues FOR INSERT
WITH CHECK (
  estate_id = public.current_estate_id()
  AND public.has_role(auth.uid(),'guard')
  AND reporter_id = auth.uid()
  AND resident_id IS NULL
);

-- Guards may update status/response on incidents they filed (not close/resolve resident issues)
DROP POLICY IF EXISTS "issues: guard update own" ON public.issues;
CREATE POLICY "issues: guard update own" ON public.issues FOR UPDATE
USING (estate_id = public.current_estate_id() AND reporter_id = auth.uid() AND public.has_role(auth.uid(),'guard'))
WITH CHECK (estate_id = public.current_estate_id() AND reporter_id = auth.uid());

-- Super Admin RPCs
CREATE OR REPLACE FUNCTION public.suspend_estate(_estate_id uuid, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Not authorised'; END IF;
  UPDATE public.estates SET status='suspended' WHERE id=_estate_id;
  INSERT INTO public.audit_logs(estate_id, actor_id, action, entity, entity_id, metadata)
  VALUES (_estate_id, auth.uid(), 'estate.suspended', 'estates', _estate_id, jsonb_build_object('reason',_reason));
END $$;

CREATE OR REPLACE FUNCTION public.activate_estate(_estate_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Not authorised'; END IF;
  UPDATE public.estates SET status='active' WHERE id=_estate_id;
  INSERT INTO public.audit_logs(estate_id, actor_id, action, entity, entity_id)
  VALUES (_estate_id, auth.uid(), 'estate.activated', 'estates', _estate_id);
END $$;

CREATE OR REPLACE FUNCTION public.update_estate(_estate_id uuid, _name text, _address text, _city text, _state text, _contact_email text, _contact_phone text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Not authorised'; END IF;
  UPDATE public.estates SET
    name          = COALESCE(NULLIF(trim(_name),''), name),
    address       = _address,
    city          = _city,
    state         = _state,
    contact_email = _contact_email,
    contact_phone = _contact_phone
  WHERE id = _estate_id;
  INSERT INTO public.audit_logs(estate_id, actor_id, action, entity, entity_id)
  VALUES (_estate_id, auth.uid(), 'estate.updated', 'estates', _estate_id);
END $$;

CREATE OR REPLACE FUNCTION public.reassign_estate_admin(_estate_id uuid, _new_admin_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_prev uuid;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Not authorised'; END IF;
  SELECT admin_user_id INTO v_prev FROM public.estates WHERE id=_estate_id;
  UPDATE public.estates SET admin_user_id=_new_admin_user_id WHERE id=_estate_id;
  UPDATE public.profiles SET estate_id=_estate_id, approved=true WHERE id=_new_admin_user_id;
  INSERT INTO public.user_roles(user_id, role) VALUES (_new_admin_user_id,'estate_admin') ON CONFLICT DO NOTHING;
  INSERT INTO public.audit_logs(estate_id, actor_id, action, entity, entity_id, metadata)
  VALUES (_estate_id, auth.uid(), 'estate.admin_reassigned', 'estates', _estate_id,
          jsonb_build_object('previous', v_prev, 'new', _new_admin_user_id));
END $$;
