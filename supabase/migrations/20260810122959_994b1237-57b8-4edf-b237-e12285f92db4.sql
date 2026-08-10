CREATE OR REPLACE FUNCTION public.log_activity(
  _action text,
  _entity text DEFAULT NULL,
  _entity_id uuid DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_estate uuid; v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _action IS NULL OR length(trim(_action)) = 0 THEN RAISE EXCEPTION 'action required'; END IF;
  v_estate := public.current_estate_id();

  INSERT INTO public.audit_logs(estate_id, actor_id, action, entity, entity_id, metadata)
  VALUES (v_estate, auth.uid(), left(trim(_action), 80), left(_entity, 80), _entity_id,
          COALESCE(_metadata, '{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.log_activity(text, text, uuid, jsonb) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.log_activity(text, text, uuid, jsonb) TO authenticated;