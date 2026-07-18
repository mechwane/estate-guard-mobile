
CREATE OR REPLACE FUNCTION public.broadcast_message(_title text, _body text, _link text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_estate uuid;
  v_count integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  v_estate := public.current_estate_id();
  IF NOT (public.is_super_admin() OR (public.has_role(auth.uid(),'estate_admin') AND v_estate IS NOT NULL)) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  IF v_estate IS NULL THEN RAISE EXCEPTION 'No estate assigned'; END IF;
  IF _title IS NULL OR length(trim(_title)) < 2 THEN RAISE EXCEPTION 'Title is required'; END IF;
  IF _body IS NULL OR length(trim(_body)) < 2 THEN RAISE EXCEPTION 'Message body is required'; END IF;

  INSERT INTO public.notifications (user_id, estate_id, title, body, link_to)
  SELECT p.id, v_estate, trim(_title), trim(_body), NULLIF(trim(_link),'')
  FROM public.profiles p
  WHERE p.estate_id = v_estate AND p.id <> auth.uid();

  GET DIAGNOSTICS v_count = ROW_COUNT;

  INSERT INTO public.audit_logs(estate_id, actor_id, action, entity, entity_id, metadata)
  VALUES (v_estate, auth.uid(), 'broadcast.sent', 'notifications', v_estate,
          jsonb_build_object('recipients', v_count, 'title', trim(_title)));

  RETURN v_count;
END $$;

GRANT EXECUTE ON FUNCTION public.broadcast_message(text,text,text) TO authenticated;
