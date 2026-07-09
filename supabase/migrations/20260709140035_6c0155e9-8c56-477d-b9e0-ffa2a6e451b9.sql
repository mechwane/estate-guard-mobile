DROP POLICY IF EXISTS "user_roles: read self or super" ON public.user_roles;
CREATE POLICY "user_roles: read self, estate admin estate, or super"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_super_admin()
  OR (
    public.has_role(auth.uid(), 'estate_admin')
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = public.user_roles.user_id
        AND p.estate_id = public.current_estate_id()
    )
  )
);

CREATE OR REPLACE FUNCTION public.assign_guard_to_current_estate(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_estate uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_role(auth.uid(), 'estate_admin') THEN RAISE EXCEPTION 'Not authorised'; END IF;
  v_estate := public.current_estate_id();
  IF v_estate IS NULL THEN RAISE EXCEPTION 'No estate assignment'; END IF;

  UPDATE public.profiles
  SET estate_id = v_estate, approved = true
  WHERE id = _user_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'guard')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.audit_logs(estate_id, actor_id, action, entity, entity_id)
  VALUES (v_estate, auth.uid(), 'guard.assigned', 'profiles', _user_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.assign_guard_to_current_estate(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.assign_guard_to_current_estate(uuid) TO authenticated, service_role;