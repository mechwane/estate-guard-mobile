
-- ============================================================
-- Access devices (physical gate terminals)
-- ============================================================
CREATE TABLE public.access_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estate_id uuid NOT NULL REFERENCES public.estates(id) ON DELETE CASCADE,
  name text NOT NULL,
  device_type text NOT NULL CHECK (device_type IN ('fingerprint','face','gate_scanner','qr_validator','rfid_reader')),
  location text,
  status text NOT NULL DEFAULT 'offline' CHECK (status IN ('online','offline','maintenance','disabled')),
  last_seen_at timestamptz,
  last_sync_at timestamptz,
  device_token_hash text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_access_devices_estate ON public.access_devices(estate_id);
CREATE INDEX idx_access_devices_status ON public.access_devices(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.access_devices TO authenticated;
GRANT ALL ON public.access_devices TO service_role;

ALTER TABLE public.access_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin full access on devices"
  ON public.access_devices FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE POLICY "Estate admin manages own estate devices"
  ON public.access_devices FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'estate_admin') AND estate_id = public.current_estate_id())
  WITH CHECK (public.has_role(auth.uid(),'estate_admin') AND estate_id = public.current_estate_id());

CREATE POLICY "Estate members can view devices"
  ON public.access_devices FOR SELECT TO authenticated
  USING (estate_id = public.current_estate_id());

CREATE TRIGGER trg_access_devices_updated
  BEFORE UPDATE ON public.access_devices
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============================================================
-- Biometric access enrollment (one per resident/dependent per type)
-- ============================================================
CREATE TABLE public.biometric_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estate_id uuid NOT NULL REFERENCES public.estates(id) ON DELETE CASCADE,
  resident_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  dependent_id uuid REFERENCES public.dependents(id) ON DELETE CASCADE,
  biometric_type text NOT NULL CHECK (biometric_type IN ('fingerprint','face')),
  device_id uuid REFERENCES public.access_devices(id) ON DELETE SET NULL,
  external_credential_ref text,
  enrollment_status text NOT NULL DEFAULT 'not_enrolled'
    CHECK (enrollment_status IN ('not_enrolled','pending','enrolled','rejected')),
  access_status text NOT NULL DEFAULT 'disabled'
    CHECK (access_status IN ('enabled','disabled')),
  approved_by uuid REFERENCES public.profiles(id),
  approved_at timestamptz,
  last_used_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (resident_id IS NOT NULL OR dependent_id IS NOT NULL)
);
CREATE UNIQUE INDEX uniq_biometric_resident_type
  ON public.biometric_access(resident_id, biometric_type)
  WHERE resident_id IS NOT NULL;
CREATE UNIQUE INDEX uniq_biometric_dependent_type
  ON public.biometric_access(dependent_id, biometric_type)
  WHERE dependent_id IS NOT NULL;
CREATE INDEX idx_biometric_estate ON public.biometric_access(estate_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.biometric_access TO authenticated;
GRANT ALL ON public.biometric_access TO service_role;

ALTER TABLE public.biometric_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin full access on biometrics"
  ON public.biometric_access FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE POLICY "Estate admin manages own estate biometrics"
  ON public.biometric_access FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'estate_admin') AND estate_id = public.current_estate_id())
  WITH CHECK (public.has_role(auth.uid(),'estate_admin') AND estate_id = public.current_estate_id());

CREATE POLICY "Residents view their own biometrics"
  ON public.biometric_access FOR SELECT TO authenticated
  USING (resident_id = auth.uid());

CREATE POLICY "Guards view biometrics in their estate"
  ON public.biometric_access FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'guard') AND estate_id = public.current_estate_id());

CREATE TRIGGER trg_biometric_access_updated
  BEFORE UPDATE ON public.biometric_access
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============================================================
-- Biometric access events (scan outcomes from devices)
-- ============================================================
CREATE TABLE public.biometric_access_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estate_id uuid NOT NULL REFERENCES public.estates(id) ON DELETE CASCADE,
  device_id uuid REFERENCES public.access_devices(id) ON DELETE SET NULL,
  biometric_access_id uuid REFERENCES public.biometric_access(id) ON DELETE SET NULL,
  resident_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  dependent_id uuid REFERENCES public.dependents(id) ON DELETE SET NULL,
  biometric_type text CHECK (biometric_type IN ('fingerprint','face')),
  outcome text NOT NULL CHECK (outcome IN ('granted','denied','error')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_bae_estate_time ON public.biometric_access_events(estate_id, created_at DESC);
CREATE INDEX idx_bae_resident ON public.biometric_access_events(resident_id);

GRANT SELECT, INSERT ON public.biometric_access_events TO authenticated;
GRANT ALL ON public.biometric_access_events TO service_role;

ALTER TABLE public.biometric_access_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin view all biometric events"
  ON public.biometric_access_events FOR SELECT TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "Estate admin/guard view estate biometric events"
  ON public.biometric_access_events FOR SELECT TO authenticated
  USING (
    (public.has_role(auth.uid(),'estate_admin') OR public.has_role(auth.uid(),'guard'))
    AND estate_id = public.current_estate_id()
  );

CREATE POLICY "Resident views own biometric events"
  ON public.biometric_access_events FOR SELECT TO authenticated
  USING (resident_id = auth.uid());

-- ============================================================
-- Admin RPCs: manage biometric access
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_upsert_biometric_access(
  _resident_id uuid,
  _dependent_id uuid,
  _biometric_type text,
  _device_id uuid,
  _enrollment_status text,
  _access_status text,
  _notes text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_estate uuid;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _biometric_type NOT IN ('fingerprint','face') THEN RAISE EXCEPTION 'Invalid biometric_type'; END IF;
  IF _resident_id IS NULL AND _dependent_id IS NULL THEN RAISE EXCEPTION 'resident or dependent required'; END IF;

  IF _resident_id IS NOT NULL THEN
    SELECT estate_id INTO v_estate FROM public.profiles WHERE id = _resident_id;
  ELSE
    SELECT estate_id INTO v_estate FROM public.dependents WHERE id = _dependent_id;
  END IF;
  IF v_estate IS NULL THEN RAISE EXCEPTION 'Estate not resolved'; END IF;

  IF NOT (public.is_super_admin()
          OR (public.has_role(auth.uid(),'estate_admin') AND v_estate = public.current_estate_id())) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  INSERT INTO public.biometric_access(
    estate_id, resident_id, dependent_id, biometric_type,
    device_id, enrollment_status, access_status, notes,
    approved_by, approved_at
  ) VALUES (
    v_estate, _resident_id, _dependent_id, _biometric_type,
    _device_id,
    COALESCE(_enrollment_status,'pending'),
    COALESCE(_access_status,'disabled'),
    _notes,
    CASE WHEN _enrollment_status = 'enrolled' THEN auth.uid() END,
    CASE WHEN _enrollment_status = 'enrolled' THEN now() END
  )
  ON CONFLICT (resident_id, biometric_type) WHERE resident_id IS NOT NULL
  DO UPDATE SET
    device_id = EXCLUDED.device_id,
    enrollment_status = EXCLUDED.enrollment_status,
    access_status = EXCLUDED.access_status,
    notes = EXCLUDED.notes,
    approved_by = CASE WHEN EXCLUDED.enrollment_status = 'enrolled' THEN auth.uid() ELSE public.biometric_access.approved_by END,
    approved_at = CASE WHEN EXCLUDED.enrollment_status = 'enrolled' THEN now() ELSE public.biometric_access.approved_at END
  RETURNING id INTO v_id;

  INSERT INTO public.audit_logs(estate_id, actor_id, action, entity, entity_id, metadata)
  VALUES (v_estate, auth.uid(), 'biometric.updated', 'biometric_access', v_id,
          jsonb_build_object('type', _biometric_type, 'enrollment', _enrollment_status, 'access', _access_status));
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_register_device(
  _name text, _device_type text, _location text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_estate uuid; v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  v_estate := public.current_estate_id();
  IF NOT (public.is_super_admin() OR (public.has_role(auth.uid(),'estate_admin') AND v_estate IS NOT NULL)) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  IF _name IS NULL OR length(trim(_name)) < 2 THEN RAISE EXCEPTION 'Device name required'; END IF;
  IF _device_type NOT IN ('fingerprint','face','gate_scanner','qr_validator','rfid_reader') THEN
    RAISE EXCEPTION 'Invalid device_type';
  END IF;

  INSERT INTO public.access_devices(estate_id, name, device_type, location)
  VALUES (v_estate, trim(_name), _device_type, NULLIF(trim(_location),''))
  RETURNING id INTO v_id;

  INSERT INTO public.audit_logs(estate_id, actor_id, action, entity, entity_id, metadata)
  VALUES (v_estate, auth.uid(), 'device.registered', 'access_devices', v_id,
          jsonb_build_object('type', _device_type, 'name', _name));
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_device_status(_device_id uuid, _status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_estate uuid;
BEGIN
  IF _status NOT IN ('online','offline','maintenance','disabled') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  SELECT estate_id INTO v_estate FROM public.access_devices WHERE id = _device_id;
  IF v_estate IS NULL THEN RAISE EXCEPTION 'Device not found'; END IF;
  IF NOT (public.is_super_admin()
          OR (public.has_role(auth.uid(),'estate_admin') AND v_estate = public.current_estate_id())) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  UPDATE public.access_devices SET status = _status, last_sync_at = now() WHERE id = _device_id;
  INSERT INTO public.audit_logs(estate_id, actor_id, action, entity, entity_id, metadata)
  VALUES (v_estate, auth.uid(), 'device.status_changed', 'access_devices', _device_id,
          jsonb_build_object('status', _status));
END $$;
