CREATE TABLE IF NOT EXISTS public.support_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estate_id uuid NOT NULL REFERENCES public.estates(id) ON DELETE CASCADE,
  user_id uuid,
  email text NOT NULL,
  purpose text NOT NULL DEFAULT 'sign_in',
  code text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.support_otps TO authenticated;
GRANT ALL ON public.support_otps TO service_role;
ALTER TABLE public.support_otps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Estate admins can view support otps" ON public.support_otps;
CREATE POLICY "Estate admins can view support otps"
  ON public.support_otps FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'estate_admin') AND estate_id = public.current_estate_id());

CREATE OR REPLACE FUNCTION public.admin_generate_support_otp(_email text, _purpose text DEFAULT 'sign_in')
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _estate uuid; _p record; _code text; _exp timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(), 'estate_admin') THEN RAISE EXCEPTION 'Not authorised'; END IF;
  _estate := public.current_estate_id();
  SELECT id, full_name, email INTO _p FROM public.profiles
    WHERE estate_id = _estate AND lower(email) = lower(trim(_email)) LIMIT 1;
  IF _p.id IS NULL THEN RAISE EXCEPTION 'No resident in this estate with that email'; END IF;
  _code := lpad((floor(random() * 1000000))::int::text, 6, '0');
  _exp := now() + interval '10 minutes';
  INSERT INTO public.support_otps (estate_id, user_id, email, purpose, code, expires_at, created_by)
  VALUES (_estate, _p.id, lower(trim(_email)), coalesce(_purpose, 'sign_in'), _code, _exp, auth.uid());
  INSERT INTO public.notifications (estate_id, user_id, title, body)
  VALUES (_estate, _p.id, 'Support code issued',
    'An estate admin generated a one-time code for you: ' || _code || '. It expires in 10 minutes.');
  INSERT INTO public.audit_logs (estate_id, actor_id, action, entity, entity_id)
  VALUES (_estate, auth.uid(), 'support.otp_generated', 'profiles', _p.id);
  RETURN json_build_object('code', _code, 'expires_at', _exp, 'full_name', _p.full_name);
END; $$;

REVOKE ALL ON FUNCTION public.admin_generate_support_otp(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_generate_support_otp(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_waive_payments(_email text, _end_date date, _start_date date DEFAULT NULL)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _estate uuid; _p record; _n int; _total numeric;
BEGIN
  IF NOT public.has_role(auth.uid(), 'estate_admin') THEN RAISE EXCEPTION 'Not authorised'; END IF;
  _estate := public.current_estate_id();
  SELECT id, full_name INTO _p FROM public.profiles
    WHERE estate_id = _estate AND lower(email) = lower(trim(_email)) LIMIT 1;
  IF _p.id IS NULL THEN RAISE EXCEPTION 'No resident in this estate with that email'; END IF;

  WITH upd AS (
    UPDATE public.bills SET status = 'waived', updated_at = now()
    WHERE estate_id = _estate AND resident_id = _p.id
      AND status IN ('unpaid', 'overdue')
      AND due_date <= _end_date
      AND (_start_date IS NULL OR due_date >= _start_date)
    RETURNING amount
  )
  SELECT count(*), coalesce(sum(amount), 0) INTO _n, _total FROM upd;

  IF _n > 0 THEN
    INSERT INTO public.notifications (estate_id, user_id, title, body)
    VALUES (_estate, _p.id, 'Payment waived',
      _n || ' outstanding charge(s) totalling ' || _total || ' were waived by estate management.');
  END IF;
  INSERT INTO public.audit_logs (estate_id, actor_id, action, entity, entity_id)
  VALUES (_estate, auth.uid(), 'support.payment_waived', 'profiles', _p.id);
  RETURN json_build_object('waived', _n, 'amount', _total, 'full_name', _p.full_name);
END; $$;

REVOKE ALL ON FUNCTION public.admin_waive_payments(text, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_waive_payments(text, date, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_grant_multi_code(_email text, _ttl_minutes int)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _estate uuid; _p record; _code text; _exp timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(), 'estate_admin') THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF coalesce(_ttl_minutes, 0) <= 0 OR _ttl_minutes > 1440 THEN RAISE EXCEPTION 'Invalid duration'; END IF;
  _estate := public.current_estate_id();
  SELECT id, full_name INTO _p FROM public.profiles
    WHERE estate_id = _estate AND lower(email) = lower(trim(_email)) LIMIT 1;
  IF _p.id IS NULL THEN RAISE EXCEPTION 'No resident in this estate with that email'; END IF;
  _code := lpad((floor(random() * 1000000))::int::text, 6, '0');
  _exp := now() + make_interval(mins => _ttl_minutes);
  INSERT INTO public.resident_passes (estate_id, resident_id, code, expires_at, issued_via, kind)
  VALUES (_estate, _p.id, _code, _exp, 'admin_multi_code', 'self');
  INSERT INTO public.notifications (estate_id, user_id, title, body)
  VALUES (_estate, _p.id, 'Multi-use access code',
    'Your access code ' || _code || ' is valid until ' || to_char(_exp, 'DD Mon YYYY HH24:MI') || '.');
  INSERT INTO public.audit_logs (estate_id, actor_id, action, entity, entity_id)
  VALUES (_estate, auth.uid(), 'support.multi_code_granted', 'profiles', _p.id);
  RETURN json_build_object('code', _code, 'expires_at', _exp, 'full_name', _p.full_name);
END; $$;

REVOKE ALL ON FUNCTION public.admin_grant_multi_code(text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_grant_multi_code(text, int) TO authenticated;