
-- Tighten guest_invites UPDATE policies: remove broad guard/resident update access.
DROP POLICY IF EXISTS "gi: guard/admin update in estate" ON public.guest_invites;

-- Residents may update their OWN invites (edit before use, revoke), but a trigger below
-- freezes all lifecycle/guard-only fields so they cannot self-check-in or reuse a pass.
CREATE POLICY "gi: resident update own"
ON public.guest_invites
FOR UPDATE
TO authenticated
USING (resident_id = auth.uid() AND estate_id = current_estate_id())
WITH CHECK (resident_id = auth.uid() AND estate_id = current_estate_id());

-- Estate admins may update within their estate (revoke, corrections). Guards get NO
-- direct UPDATE; guard_check_in / guard_check_out (SECURITY DEFINER) bypass RLS.
CREATE POLICY "gi: estate_admin update in estate"
ON public.guest_invites
FOR UPDATE
TO authenticated
USING (estate_id = current_estate_id() AND has_role(auth.uid(),'estate_admin'))
WITH CHECK (estate_id = current_estate_id() AND has_role(auth.uid(),'estate_admin'));

-- Trigger: freeze sensitive lifecycle fields for anyone who is not a SECURITY DEFINER
-- caller (RPCs run as postgres/definer). Residents keep purpose/guest_name/phone/etc.
CREATE OR REPLACE FUNCTION public.tg_guest_invites_freeze_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Immutable identity fields for everyone except super admin
  IF NOT public.is_super_admin() THEN
    NEW.estate_id   := OLD.estate_id;
    NEW.resident_id := OLD.resident_id;
    NEW.code        := OLD.code;
  END IF;

  -- Residents cannot touch lifecycle / guard fields at all
  IF OLD.resident_id = auth.uid()
     AND NOT public.has_role(auth.uid(),'estate_admin')
     AND NOT public.is_super_admin() THEN
    NEW.status         := OLD.status;
    NEW.validated_by   := OLD.validated_by;
    NEW.checked_in_at  := OLD.checked_in_at;
    NEW.checked_out_at := OLD.checked_out_at;
    NEW.exited_by      := OLD.exited_by;
    NEW.expires_at     := OLD.expires_at;
    NEW.vehicle_number := OLD.vehicle_number;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tg_guest_invites_freeze_lifecycle ON public.guest_invites;
CREATE TRIGGER tg_guest_invites_freeze_lifecycle
BEFORE UPDATE ON public.guest_invites
FOR EACH ROW EXECUTE FUNCTION public.tg_guest_invites_freeze_lifecycle();

-- Convenience RPC: estate metrics for super admin (single roundtrip).
CREATE OR REPLACE FUNCTION public.super_estate_overview(_estate_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r jsonb;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Not authorised'; END IF;

  SELECT jsonb_build_object(
    'estate', (SELECT to_jsonb(e) FROM public.estates e WHERE e.id = _estate_id),
    'admin',  (SELECT to_jsonb(p) FROM public.profiles p
               JOIN public.estates e ON e.admin_user_id = p.id WHERE e.id = _estate_id),
    'users', jsonb_build_object(
      'total',     (SELECT count(*) FROM public.profiles WHERE estate_id = _estate_id),
      'residents', (SELECT count(*) FROM public.profiles p JOIN public.user_roles ur ON ur.user_id=p.id
                    WHERE p.estate_id=_estate_id AND ur.role='resident'),
      'guards',    (SELECT count(*) FROM public.profiles p JOIN public.user_roles ur ON ur.user_id=p.id
                    WHERE p.estate_id=_estate_id AND ur.role='guard'),
      'admins',    (SELECT count(*) FROM public.profiles p JOIN public.user_roles ur ON ur.user_id=p.id
                    WHERE p.estate_id=_estate_id AND ur.role='estate_admin'),
      'approved',  (SELECT count(*) FROM public.profiles WHERE estate_id=_estate_id AND approved),
      'verif_pending',  (SELECT count(*) FROM public.profiles WHERE estate_id=_estate_id AND verification_status='pending'),
      'verif_approved', (SELECT count(*) FROM public.profiles WHERE estate_id=_estate_id AND verification_status='approved'),
      'verif_rejected', (SELECT count(*) FROM public.profiles WHERE estate_id=_estate_id AND verification_status='rejected')
    ),
    'guests', jsonb_build_object(
      'total',     (SELECT count(*) FROM public.guest_invites WHERE estate_id=_estate_id),
      'active',    (SELECT count(*) FROM public.guest_invites WHERE estate_id=_estate_id AND status='active' AND expires_at > now()),
      'used',      (SELECT count(*) FROM public.guest_invites WHERE estate_id=_estate_id AND status='used'),
      'expired',   (SELECT count(*) FROM public.guest_invites WHERE estate_id=_estate_id AND expires_at <= now() AND status <> 'revoked'),
      'revoked',   (SELECT count(*) FROM public.guest_invites WHERE estate_id=_estate_id AND status='revoked'),
      'inside',    (SELECT count(*) FROM public.guest_invites WHERE estate_id=_estate_id AND checked_in_at IS NOT NULL AND checked_out_at IS NULL),
      'entries',   (SELECT count(*) FROM public.guest_invites WHERE estate_id=_estate_id AND checked_in_at IS NOT NULL),
      'exits',     (SELECT count(*) FROM public.guest_invites WHERE estate_id=_estate_id AND checked_out_at IS NOT NULL),
      'missing_exit', (SELECT count(*) FROM public.guest_invites WHERE estate_id=_estate_id AND checked_in_at IS NOT NULL AND checked_out_at IS NULL AND expires_at < now())
    ),
    'incidents', jsonb_build_object(
      'open',        (SELECT count(*) FROM public.issues WHERE estate_id=_estate_id AND status='open'),
      'in_progress', (SELECT count(*) FROM public.issues WHERE estate_id=_estate_id AND status='in_progress'),
      'resolved',    (SELECT count(*) FROM public.issues WHERE estate_id=_estate_id AND status='resolved'),
      'by_severity', (SELECT jsonb_object_agg(coalesce(severity::text,'unspecified'), c)
                      FROM (SELECT severity, count(*) c FROM public.issues WHERE estate_id=_estate_id GROUP BY severity) s)
    ),
    'billing', jsonb_build_object(
      'billed',      (SELECT coalesce(sum(amount),0) FROM public.bills WHERE estate_id=_estate_id),
      'collected',   (SELECT coalesce(sum(amount),0) FROM public.payments p JOIN public.bills b ON b.id=p.bill_id WHERE b.estate_id=_estate_id),
      'payments',    (SELECT count(*) FROM public.payments p JOIN public.bills b ON b.id=p.bill_id WHERE b.estate_id=_estate_id),
      'vtu_total',   (SELECT coalesce(sum(amount),0) FROM public.vtu_transactions WHERE estate_id=_estate_id),
      'vtu_count',   (SELECT count(*) FROM public.vtu_transactions WHERE estate_id=_estate_id)
    ),
    'recent_activity', (
      SELECT coalesce(jsonb_agg(row_to_json(a) ORDER BY a.created_at DESC), '[]'::jsonb)
      FROM (SELECT id, action, entity, entity_id, actor_id, metadata, created_at
            FROM public.audit_logs WHERE estate_id=_estate_id
            ORDER BY created_at DESC LIMIT 25) a
    )
  ) INTO r;
  RETURN r;
END $$;

GRANT EXECUTE ON FUNCTION public.super_estate_overview(uuid) TO authenticated;
