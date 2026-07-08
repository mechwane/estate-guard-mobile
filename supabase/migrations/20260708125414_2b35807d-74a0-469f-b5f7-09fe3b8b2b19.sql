
-- Harden auth: remove email-based role bootstrapping. Only 'resident' or 'guard'
-- can be assigned from public signup. Estate admins are provisioned via a
-- super-admin-only invite flow. Super admins are seeded/managed out-of-band.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_estate_id uuid;
  v_role public.app_role;
  v_code text;
BEGIN
  v_code := NEW.raw_user_meta_data->>'estate_code';
  IF v_code IS NOT NULL THEN
    SELECT id INTO v_estate_id FROM public.estates WHERE code = v_code;
  END IF;

  -- Public signup can only ever create resident or guard. Any attempt to
  -- pass an admin role via metadata is ignored.
  v_role := COALESCE(NULLIF(NEW.raw_user_meta_data->>'role','')::public.app_role, 'resident');
  IF v_role NOT IN ('resident','guard') THEN
    v_role := 'resident';
  END IF;

  INSERT INTO public.profiles (id, full_name, phone, estate_id, unit, approved)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'phone',
    v_estate_id,
    NEW.raw_user_meta_data->>'unit',
    false
  );

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role);

  RETURN NEW;
END;
$function$;

-- Estate admin invitations: one-time tokens the super admin generates.
-- The invitee signs up as a normal user, then redeems the token to be
-- promoted to estate_admin and linked to the estate.
CREATE TABLE IF NOT EXISTS public.estate_admin_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estate_id uuid NOT NULL REFERENCES public.estates(id) ON DELETE CASCADE,
  email text NOT NULL,
  token text NOT NULL UNIQUE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at timestamptz,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT, INSERT, UPDATE ON public.estate_admin_invites TO authenticated;
GRANT ALL ON public.estate_admin_invites TO service_role;

ALTER TABLE public.estate_admin_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super admin manages invites"
ON public.estate_admin_invites
FOR ALL
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

CREATE POLICY "invitee can read own invite by email"
ON public.estate_admin_invites
FOR SELECT
TO authenticated
USING (lower(email) = lower(coalesce((auth.jwt() ->> 'email'), '')));

-- Super admin generates an invite. Returns the token.
CREATE OR REPLACE FUNCTION public.create_estate_admin_invite(_estate_id uuid, _email text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_token text;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF _email IS NULL OR length(trim(_email)) < 3 THEN RAISE EXCEPTION 'Email required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.estates WHERE id = _estate_id) THEN
    RAISE EXCEPTION 'Estate not found';
  END IF;
  v_token := encode(gen_random_bytes(24), 'hex');
  INSERT INTO public.estate_admin_invites (estate_id, email, token, created_by)
  VALUES (_estate_id, lower(trim(_email)), v_token, auth.uid());
  INSERT INTO public.audit_logs(estate_id, actor_id, action, entity, entity_id, metadata)
  VALUES (_estate_id, auth.uid(), 'estate_admin.invited', 'estate_admin_invites', _estate_id,
          jsonb_build_object('email', lower(trim(_email))));
  RETURN v_token;
END;
$function$;

-- Invitee redeems the token after signing up.
CREATE OR REPLACE FUNCTION public.redeem_estate_admin_invite(_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_inv public.estate_admin_invites;
  v_email text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  v_email := lower(coalesce((auth.jwt() ->> 'email'), ''));
  SELECT * INTO v_inv FROM public.estate_admin_invites
   WHERE token = _token AND accepted_at IS NULL AND expires_at > now();
  IF v_inv.id IS NULL THEN RAISE EXCEPTION 'Invite invalid or expired'; END IF;
  IF lower(v_inv.email) <> v_email THEN RAISE EXCEPTION 'Invite is for a different email'; END IF;

  UPDATE public.profiles SET estate_id = v_inv.estate_id, approved = true WHERE id = auth.uid();
  INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), 'estate_admin')
    ON CONFLICT DO NOTHING;
  UPDATE public.estates SET admin_user_id = auth.uid()
    WHERE id = v_inv.estate_id AND admin_user_id IS NULL;
  UPDATE public.estate_admin_invites SET accepted_at = now(), accepted_by = auth.uid()
    WHERE id = v_inv.id;

  INSERT INTO public.audit_logs(estate_id, actor_id, action, entity, entity_id)
  VALUES (v_inv.estate_id, auth.uid(), 'estate_admin.accepted', 'estate_admin_invites', v_inv.id);

  RETURN v_inv.estate_id;
END;
$function$;

-- Super admin can remove an estate admin.
CREATE OR REPLACE FUNCTION public.remove_estate_admin(_estate_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_admin uuid;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Not authorised'; END IF;
  SELECT admin_user_id INTO v_admin FROM public.estates WHERE id = _estate_id;
  IF v_admin IS NULL THEN RETURN; END IF;
  DELETE FROM public.user_roles WHERE user_id = v_admin AND role = 'estate_admin';
  INSERT INTO public.user_roles (user_id, role) VALUES (v_admin, 'resident')
    ON CONFLICT DO NOTHING;
  UPDATE public.estates SET admin_user_id = NULL WHERE id = _estate_id;
  INSERT INTO public.audit_logs(estate_id, actor_id, action, entity, entity_id, metadata)
  VALUES (_estate_id, auth.uid(), 'estate_admin.removed', 'estates', _estate_id,
          jsonb_build_object('previous_admin', v_admin));
END;
$function$;
