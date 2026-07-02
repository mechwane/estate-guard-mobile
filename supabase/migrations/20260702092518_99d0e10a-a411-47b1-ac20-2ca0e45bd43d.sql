
REVOKE EXECUTE ON FUNCTION public.current_estate_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_role_is(public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_set_updated_at() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.current_estate_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_role_is(public.app_role) TO authenticated;

CREATE INDEX IF NOT EXISTS idx_profiles_estate ON public.profiles(estate_id);
CREATE INDEX IF NOT EXISTS idx_guest_invites_estate_created ON public.guest_invites(estate_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_guest_invites_resident ON public.guest_invites(resident_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_guest_invites_status ON public.guest_invites(status);
CREATE INDEX IF NOT EXISTS idx_guest_invites_code ON public.guest_invites(code);
CREATE INDEX IF NOT EXISTS idx_bills_estate_status ON public.bills(estate_id, status);
CREATE INDEX IF NOT EXISTS idx_bills_resident ON public.bills(resident_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_issues_estate_status ON public.issues(estate_id, status);
CREATE INDEX IF NOT EXISTS idx_issues_resident ON public.issues(resident_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_bill ON public.payments(bill_id);
CREATE INDEX IF NOT EXISTS idx_audit_estate_created ON public.audit_logs(estate_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON public.audit_logs(action);

CREATE UNIQUE INDEX IF NOT EXISTS uq_guest_invites_active_code
  ON public.guest_invites(estate_id, code)
  WHERE status = 'active';
