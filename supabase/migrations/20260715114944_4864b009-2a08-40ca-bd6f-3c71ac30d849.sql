
-- ============ Biometric credentials ============
CREATE TABLE public.resident_biometric_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id text NOT NULL UNIQUE,
  public_key text NOT NULL,
  sign_count bigint NOT NULL DEFAULT 0,
  device_name text,
  transports text[],
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.resident_biometric_credentials TO authenticated;
GRANT ALL ON public.resident_biometric_credentials TO service_role;
ALTER TABLE public.resident_biometric_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own credentials read" ON public.resident_biometric_credentials
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_super_admin());
CREATE POLICY "own credentials write" ON public.resident_biometric_credentials
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own credentials delete" ON public.resident_biometric_credentials
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============ Resident passes ============
CREATE TYPE public.resident_pass_kind AS ENUM ('self','guest');

CREATE TABLE public.resident_passes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estate_id uuid NOT NULL REFERENCES public.estates(id) ON DELETE CASCADE,
  resident_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind public.resident_pass_kind NOT NULL DEFAULT 'self',
  guest_name text,
  code text NOT NULL,
  issued_via text NOT NULL DEFAULT 'biometric',
  credential_id text,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  used_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(estate_id, code)
);
CREATE INDEX resident_passes_estate_expiry_idx ON public.resident_passes(estate_id, expires_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.resident_passes TO authenticated;
GRANT ALL ON public.resident_passes TO service_role;
ALTER TABLE public.resident_passes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "resident own passes" ON public.resident_passes
  FOR SELECT TO authenticated USING (
    resident_id = auth.uid()
    OR public.is_super_admin()
    OR (public.has_role(auth.uid(),'estate_admin') AND estate_id = public.current_estate_id())
    OR (public.has_role(auth.uid(),'guard') AND estate_id = public.current_estate_id())
  );

-- ============ Discounts ============
CREATE TABLE public.discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estate_id uuid NOT NULL REFERENCES public.estates(id) ON DELETE CASCADE,
  name text NOT NULL,
  percent numeric(5,2) NOT NULL CHECK (percent > 0 AND percent <= 100),
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discounts TO authenticated;
GRANT ALL ON public.discounts TO service_role;
ALTER TABLE public.discounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "discounts read in estate" ON public.discounts FOR SELECT TO authenticated
  USING (public.is_super_admin() OR estate_id = public.current_estate_id());
CREATE POLICY "discounts admin write" ON public.discounts FOR ALL TO authenticated
  USING (public.is_super_admin() OR (public.has_role(auth.uid(),'estate_admin') AND estate_id = public.current_estate_id()))
  WITH CHECK (public.is_super_admin() OR (public.has_role(auth.uid(),'estate_admin') AND estate_id = public.current_estate_id()));
CREATE TRIGGER tg_discounts_updated_at BEFORE UPDATE ON public.discounts
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ Access cards ============
CREATE TABLE public.access_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estate_id uuid NOT NULL REFERENCES public.estates(id) ON DELETE CASCADE,
  resident_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_number text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  issued_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(estate_id, card_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.access_cards TO authenticated;
GRANT ALL ON public.access_cards TO service_role;
ALTER TABLE public.access_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "access_cards read" ON public.access_cards FOR SELECT TO authenticated
  USING (resident_id = auth.uid() OR public.is_super_admin()
    OR (public.has_role(auth.uid(),'estate_admin') AND estate_id = public.current_estate_id())
    OR (public.has_role(auth.uid(),'guard') AND estate_id = public.current_estate_id()));
CREATE POLICY "access_cards admin write" ON public.access_cards FOR ALL TO authenticated
  USING (public.is_super_admin() OR (public.has_role(auth.uid(),'estate_admin') AND estate_id = public.current_estate_id()))
  WITH CHECK (public.is_super_admin() OR (public.has_role(auth.uid(),'estate_admin') AND estate_id = public.current_estate_id()));

-- ============ Vehicle tags ============
CREATE TABLE public.vehicle_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estate_id uuid NOT NULL REFERENCES public.estates(id) ON DELETE CASCADE,
  resident_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plate text NOT NULL,
  tag_number text,
  make_model text,
  color text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(estate_id, plate)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_tags TO authenticated;
GRANT ALL ON public.vehicle_tags TO service_role;
ALTER TABLE public.vehicle_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vehicle_tags read" ON public.vehicle_tags FOR SELECT TO authenticated
  USING (resident_id = auth.uid() OR public.is_super_admin()
    OR (public.has_role(auth.uid(),'estate_admin') AND estate_id = public.current_estate_id())
    OR (public.has_role(auth.uid(),'guard') AND estate_id = public.current_estate_id()));
CREATE POLICY "vehicle_tags resident own write" ON public.vehicle_tags FOR ALL TO authenticated
  USING (resident_id = auth.uid() OR public.is_super_admin() OR (public.has_role(auth.uid(),'estate_admin') AND estate_id = public.current_estate_id()))
  WITH CHECK (
    (resident_id = auth.uid() AND estate_id = public.current_estate_id())
    OR public.is_super_admin()
    OR (public.has_role(auth.uid(),'estate_admin') AND estate_id = public.current_estate_id())
  );

-- ============ Feature flags ============
CREATE TABLE public.estate_feature_flags (
  estate_id uuid NOT NULL REFERENCES public.estates(id) ON DELETE CASCADE,
  key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (estate_id, key)
);
GRANT SELECT ON public.estate_feature_flags TO authenticated;
GRANT ALL ON public.estate_feature_flags TO service_role;
ALTER TABLE public.estate_feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "flags read in estate" ON public.estate_feature_flags FOR SELECT TO authenticated
  USING (public.is_super_admin() OR estate_id = public.current_estate_id());

-- ============ Platform plans ============
CREATE TABLE public.platform_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  monthly_ngn numeric(12,2) NOT NULL DEFAULT 0,
  limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_plans TO authenticated;
GRANT ALL ON public.platform_plans TO service_role;
ALTER TABLE public.platform_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans read" ON public.platform_plans FOR SELECT TO authenticated USING (true);

CREATE TABLE public.estate_subscriptions (
  estate_id uuid PRIMARY KEY REFERENCES public.estates(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.platform_plans(id),
  status text NOT NULL DEFAULT 'trial',
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.estate_subscriptions TO authenticated;
GRANT ALL ON public.estate_subscriptions TO service_role;
ALTER TABLE public.estate_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subs read in estate" ON public.estate_subscriptions FOR SELECT TO authenticated
  USING (public.is_super_admin() OR estate_id = public.current_estate_id());

-- ============ RPCs ============
CREATE OR REPLACE FUNCTION public.enroll_biometric_credential(
  _credential_id text, _public_key text, _device_name text, _transports text[]
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _credential_id IS NULL OR length(_credential_id) < 8 THEN RAISE EXCEPTION 'Invalid credential'; END IF;
  INSERT INTO public.resident_biometric_credentials(user_id, credential_id, public_key, device_name, transports)
  VALUES (auth.uid(), _credential_id, _public_key, NULLIF(trim(_device_name),''), _transports)
  ON CONFLICT (credential_id) DO UPDATE SET last_used_at = now(), device_name = COALESCE(EXCLUDED.device_name, resident_biometric_credentials.device_name)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.issue_resident_pass(
  _kind public.resident_pass_kind, _guest_name text, _ttl_minutes int, _credential_id text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_estate uuid;
  v_code text;
  v_id uuid;
  v_expires timestamptz;
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i int;
  v_has_cred boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  v_estate := public.current_estate_id();
  IF v_estate IS NULL THEN RAISE EXCEPTION 'No estate assignment'; END IF;

  -- Require biometric enrolment
  SELECT EXISTS(SELECT 1 FROM public.resident_biometric_credentials
                WHERE user_id = auth.uid()
                  AND (_credential_id IS NULL OR credential_id = _credential_id))
    INTO v_has_cred;
  IF NOT v_has_cred THEN RAISE EXCEPTION 'Biometric device not enrolled'; END IF;

  v_expires := now() + make_interval(mins => GREATEST(5, LEAST(COALESCE(_ttl_minutes, 30), 24*60)));

  LOOP
    v_code := '';
    FOR i IN 1..8 LOOP
      v_code := v_code || substr(v_chars, 1 + floor(random()*length(v_chars))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.resident_passes WHERE estate_id = v_estate AND code = v_code);
  END LOOP;

  INSERT INTO public.resident_passes(estate_id, resident_id, kind, guest_name, code, credential_id, expires_at)
  VALUES (v_estate, auth.uid(), COALESCE(_kind,'self'), NULLIF(trim(_guest_name),''), v_code, _credential_id, v_expires)
  RETURNING id INTO v_id;

  UPDATE public.resident_biometric_credentials SET last_used_at = now()
    WHERE user_id = auth.uid() AND (_credential_id IS NULL OR credential_id = _credential_id);

  INSERT INTO public.audit_logs(estate_id, actor_id, action, entity, entity_id, metadata)
  VALUES (v_estate, auth.uid(), 'pass.issued', 'resident_passes', v_id,
          jsonb_build_object('kind', _kind, 'expires_at', v_expires));

  RETURN jsonb_build_object('id', v_id, 'code', v_code, 'expires_at', v_expires, 'kind', COALESCE(_kind,'self'));
END $$;

CREATE OR REPLACE FUNCTION public.validate_resident_pass(_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_estate uuid;
  v_row public.resident_passes;
  v_host jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT (public.has_role(auth.uid(),'guard') OR public.has_role(auth.uid(),'estate_admin')) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  v_estate := public.current_estate_id();
  SELECT * INTO v_row FROM public.resident_passes
    WHERE estate_id = v_estate AND code = trim(_code) LIMIT 1;
  IF v_row.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  SELECT jsonb_build_object('full_name', p.full_name, 'unit', p.unit)
    INTO v_host FROM public.profiles p WHERE p.id = v_row.resident_id;
  RETURN jsonb_build_object(
    'ok', true, 'pass', to_jsonb(v_row), 'host', v_host,
    'expired', v_row.expires_at < now(),
    'already_used', v_row.used_at IS NOT NULL
  );
END $$;

CREATE OR REPLACE FUNCTION public.guard_use_resident_pass(_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_estate uuid;
  v_row public.resident_passes;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_role(auth.uid(),'guard') THEN RAISE EXCEPTION 'Only guards can record entries'; END IF;
  v_estate := public.current_estate_id();
  SELECT * INTO v_row FROM public.resident_passes
    WHERE estate_id = v_estate AND code = trim(_code) FOR UPDATE;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Pass not found'; END IF;
  IF v_row.expires_at < now() THEN RAISE EXCEPTION 'Pass expired'; END IF;
  IF v_row.used_at IS NOT NULL THEN RAISE EXCEPTION 'Pass already used'; END IF;
  UPDATE public.resident_passes SET used_at = now(), used_by = auth.uid()
    WHERE id = v_row.id RETURNING * INTO v_row;
  INSERT INTO public.audit_logs(estate_id, actor_id, action, entity, entity_id)
  VALUES (v_estate, auth.uid(), 'pass.used', 'resident_passes', v_row.id);
  RETURN jsonb_build_object('ok', true, 'pass', to_jsonb(v_row));
END $$;

CREATE OR REPLACE FUNCTION public.platform_rollup()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Not authorised'; END IF;
  SELECT jsonb_build_object(
    'estates', jsonb_build_object(
      'total', (SELECT count(*) FROM public.estates),
      'active', (SELECT count(*) FROM public.estates WHERE status='active'),
      'suspended', (SELECT count(*) FROM public.estates WHERE status='suspended')
    ),
    'users', jsonb_build_object(
      'total', (SELECT count(*) FROM public.profiles),
      'residents', (SELECT count(*) FROM public.user_roles WHERE role='resident'),
      'guards', (SELECT count(*) FROM public.user_roles WHERE role='guard'),
      'estate_admins', (SELECT count(*) FROM public.user_roles WHERE role='estate_admin')
    ),
    'access', jsonb_build_object(
      'guest_invites_total', (SELECT count(*) FROM public.guest_invites),
      'check_ins_today', (SELECT count(*) FROM public.guest_invites WHERE checked_in_at::date = current_date),
      'check_outs_today', (SELECT count(*) FROM public.guest_invites WHERE checked_out_at::date = current_date),
      'passes_today', (SELECT count(*) FROM public.resident_passes WHERE created_at::date = current_date)
    ),
    'billing', jsonb_build_object(
      'billed', (SELECT coalesce(sum(amount),0) FROM public.bills),
      'collected', (SELECT coalesce(sum(amount),0) FROM public.payments),
      'orders', (SELECT count(*) FROM public.shop_orders)
    ),
    'subscriptions', (
      SELECT coalesce(jsonb_agg(row_to_json(s)), '[]'::jsonb) FROM (
        SELECT es.estate_id, e.name AS estate_name, es.status, es.started_at, es.expires_at,
               p.name AS plan_name, p.monthly_ngn
        FROM public.estate_subscriptions es
        JOIN public.estates e ON e.id = es.estate_id
        LEFT JOIN public.platform_plans p ON p.id = es.plan_id
        ORDER BY es.updated_at DESC
      ) s
    )
  ) INTO r;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.set_estate_feature_flag(_estate_id uuid, _key text, _enabled boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Not authorised'; END IF;
  INSERT INTO public.estate_feature_flags(estate_id, key, enabled, updated_at)
  VALUES (_estate_id, _key, _enabled, now())
  ON CONFLICT (estate_id, key) DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = now();
  INSERT INTO public.audit_logs(estate_id, actor_id, action, entity, entity_id, metadata)
  VALUES (_estate_id, auth.uid(), 'feature_flag.set', 'estate_feature_flags', _estate_id,
          jsonb_build_object('key', _key, 'enabled', _enabled));
END $$;

CREATE OR REPLACE FUNCTION public.set_estate_plan(_estate_id uuid, _plan_id uuid, _status text, _expires_at timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Not authorised'; END IF;
  INSERT INTO public.estate_subscriptions(estate_id, plan_id, status, started_at, expires_at, updated_at)
  VALUES (_estate_id, _plan_id, COALESCE(_status,'active'), now(), _expires_at, now())
  ON CONFLICT (estate_id) DO UPDATE
    SET plan_id = EXCLUDED.plan_id, status = EXCLUDED.status, expires_at = EXCLUDED.expires_at, updated_at = now();
  INSERT INTO public.audit_logs(estate_id, actor_id, action, entity, entity_id, metadata)
  VALUES (_estate_id, auth.uid(), 'plan.set', 'estate_subscriptions', _estate_id,
          jsonb_build_object('plan_id', _plan_id, 'status', _status));
END $$;

-- Seed default plans
INSERT INTO public.platform_plans(name, monthly_ngn, limits) VALUES
  ('Starter', 0, '{"residents": 50, "guards": 2}'::jsonb),
  ('Growth', 50000, '{"residents": 500, "guards": 10}'::jsonb),
  ('Enterprise', 250000, '{"residents": null, "guards": null}'::jsonb)
ON CONFLICT (name) DO NOTHING;
