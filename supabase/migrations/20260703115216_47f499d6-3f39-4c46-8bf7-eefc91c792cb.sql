
-- Add missing columns for entry/exit tracking
ALTER TABLE public.guest_invites
  ADD COLUMN IF NOT EXISTS vehicle_number text,
  ADD COLUMN IF NOT EXISTS exited_by uuid REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_guest_invites_estate_checked_in ON public.guest_invites(estate_id, checked_in_at DESC);
CREATE INDEX IF NOT EXISTS idx_guest_invites_code ON public.guest_invites(estate_id, code);

-- Secure RPC: validate a guest code (read-only lookup) scoped to guard's estate
CREATE OR REPLACE FUNCTION public.validate_guest_code(_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_estate uuid;
  v_row public.guest_invites;
  v_host jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT (public.has_role(auth.uid(),'guard') OR public.has_role(auth.uid(),'estate_admin')) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  v_estate := public.current_estate_id();
  IF v_estate IS NULL THEN RAISE EXCEPTION 'No estate assignment'; END IF;

  SELECT * INTO v_row FROM public.guest_invites
   WHERE estate_id = v_estate AND code = trim(_code)
   LIMIT 1;

  IF v_row.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  SELECT jsonb_build_object('full_name', p.full_name, 'unit', p.unit)
    INTO v_host FROM public.profiles p WHERE p.id = v_row.resident_id;

  RETURN jsonb_build_object(
    'ok', true,
    'invite', to_jsonb(v_row),
    'host', v_host,
    'expired', v_row.expires_at < now(),
    'revoked', v_row.status = 'revoked',
    'already_checked_in', v_row.checked_in_at IS NOT NULL,
    'already_checked_out', v_row.checked_out_at IS NOT NULL
  );
END $$;

-- Secure RPC: record visitor entry
CREATE OR REPLACE FUNCTION public.guard_check_in(_invite_id uuid, _vehicle_number text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_estate uuid;
  v_row public.guest_invites;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_role(auth.uid(),'guard') THEN RAISE EXCEPTION 'Only guards can record entries'; END IF;
  v_estate := public.current_estate_id();
  IF v_estate IS NULL THEN RAISE EXCEPTION 'No estate assignment'; END IF;

  SELECT * INTO v_row FROM public.guest_invites
   WHERE id = _invite_id FOR UPDATE;

  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Invite not found'; END IF;
  IF v_row.estate_id <> v_estate THEN RAISE EXCEPTION 'Cross-estate action denied'; END IF;
  IF v_row.status = 'revoked' THEN RAISE EXCEPTION 'Pass revoked'; END IF;
  IF v_row.expires_at < now() THEN RAISE EXCEPTION 'Pass expired'; END IF;
  IF v_row.checked_in_at IS NOT NULL THEN RAISE EXCEPTION 'Already checked in'; END IF;

  UPDATE public.guest_invites SET
    checked_in_at = now(),
    validated_by = auth.uid(),
    vehicle_number = COALESCE(NULLIF(trim(_vehicle_number),''), vehicle_number),
    status = 'used'
  WHERE id = _invite_id
  RETURNING * INTO v_row;

  INSERT INTO public.audit_logs(estate_id, actor_id, action, entity, entity_id, metadata)
  VALUES (v_estate, auth.uid(), 'guest.check_in', 'guest_invites', _invite_id,
          jsonb_build_object('vehicle', v_row.vehicle_number));

  RETURN jsonb_build_object('ok', true, 'invite', to_jsonb(v_row));
END $$;

-- Secure RPC: record visitor exit
CREATE OR REPLACE FUNCTION public.guard_check_out(_invite_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_estate uuid;
  v_row public.guest_invites;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_role(auth.uid(),'guard') THEN RAISE EXCEPTION 'Only guards can record exits'; END IF;
  v_estate := public.current_estate_id();
  IF v_estate IS NULL THEN RAISE EXCEPTION 'No estate assignment'; END IF;

  SELECT * INTO v_row FROM public.guest_invites
   WHERE id = _invite_id FOR UPDATE;

  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Invite not found'; END IF;
  IF v_row.estate_id <> v_estate THEN RAISE EXCEPTION 'Cross-estate action denied'; END IF;
  IF v_row.checked_in_at IS NULL THEN RAISE EXCEPTION 'No entry recorded'; END IF;
  IF v_row.checked_out_at IS NOT NULL THEN RAISE EXCEPTION 'Already checked out'; END IF;

  UPDATE public.guest_invites SET
    checked_out_at = now(),
    exited_by = auth.uid()
  WHERE id = _invite_id
  RETURNING * INTO v_row;

  INSERT INTO public.audit_logs(estate_id, actor_id, action, entity, entity_id)
  VALUES (v_estate, auth.uid(), 'guest.check_out', 'guest_invites', _invite_id);

  RETURN jsonb_build_object('ok', true, 'invite', to_jsonb(v_row));
END $$;

GRANT EXECUTE ON FUNCTION public.validate_guest_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.guard_check_in(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.guard_check_out(uuid) TO authenticated;
