CREATE TABLE public.user_device_sessions (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  device_label text,
  user_agent text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.user_device_sessions TO authenticated;
GRANT ALL ON public.user_device_sessions TO service_role;

ALTER TABLE public.user_device_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own device session readable"
ON public.user_device_sessions FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "staff can read estate device sessions"
ON public.user_device_sessions FOR SELECT TO authenticated
USING (
  public.is_super_admin()
  OR (
    public.current_role_is('estate_admin')
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = user_device_sessions.user_id
        AND p.estate_id = public.current_estate_id()
    )
  )
);

CREATE TRIGGER user_device_sessions_touch
BEFORE UPDATE ON public.user_device_sessions
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE OR REPLACE FUNCTION public.claim_device_session(
  _device_id text,
  _device_label text DEFAULT NULL,
  _user_agent text DEFAULT NULL,
  _force boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.user_device_sessions;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  END IF;
  IF _device_id IS NULL OR length(trim(_device_id)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_device');
  END IF;

  SELECT * INTO _row FROM public.user_device_sessions WHERE user_id = _uid;

  IF _row.user_id IS NULL THEN
    INSERT INTO public.user_device_sessions (user_id, device_id, device_label, user_agent)
    VALUES (_uid, _device_id, _device_label, _user_agent);
    RETURN jsonb_build_object('ok', true, 'claimed', true);
  END IF;

  IF _row.device_id = _device_id THEN
    UPDATE public.user_device_sessions
      SET last_seen_at = now(), device_label = COALESCE(_device_label, device_label),
          user_agent = COALESCE(_user_agent, user_agent)
      WHERE user_id = _uid;
    RETURN jsonb_build_object('ok', true, 'claimed', false);
  END IF;

  IF _force THEN
    UPDATE public.user_device_sessions
      SET device_id = _device_id, device_label = _device_label,
          user_agent = _user_agent, last_seen_at = now()
      WHERE user_id = _uid;
    PERFORM public.log_activity('auth.device_takeover', 'profile', _uid,
      jsonb_build_object('device_label', _device_label));
    RETURN jsonb_build_object('ok', true, 'claimed', true, 'forced', true);
  END IF;

  RETURN jsonb_build_object(
    'ok', false,
    'reason', 'other_device',
    'device_label', _row.device_label,
    'last_seen_at', _row.last_seen_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.release_device_session(_device_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  DELETE FROM public.user_device_sessions
    WHERE user_id = auth.uid() AND device_id = _device_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_device_session(text, text, text, boolean) FROM public, anon;
REVOKE ALL ON FUNCTION public.release_device_session(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.claim_device_session(text, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_device_session(text) TO authenticated;