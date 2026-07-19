
-- === Fix 1: Ensure profile self-update trigger is attached and strict ===
CREATE OR REPLACE FUNCTION public.tg_profiles_freeze_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_super_admin() THEN RETURN NEW; END IF;
  IF public.has_role(auth.uid(),'estate_admin') AND OLD.estate_id IS NOT NULL
     AND OLD.estate_id = public.current_estate_id() THEN
    RETURN NEW;
  END IF;
  -- Self update: freeze all admin/tenant-scoping/verification/premium fields
  NEW.id := OLD.id;
  NEW.approved := OLD.approved;
  NEW.estate_id := OLD.estate_id;
  NEW.verification_status := OLD.verification_status;
  NEW.verification_notes := OLD.verification_notes;
  NEW.verification_submitted_at := OLD.verification_submitted_at;
  NEW.verification_reviewed_at := OLD.verification_reviewed_at;
  NEW.verification_reviewed_by := OLD.verification_reviewed_by;
  NEW.premium_plan := OLD.premium_plan;
  NEW.premium_expires_at := OLD.premium_expires_at;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS profiles_freeze_admin_fields ON public.profiles;
CREATE TRIGGER profiles_freeze_admin_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_profiles_freeze_admin_fields();

-- === Fix 2: Server-verified biometric step-up for gate passes ===

-- Challenge table for WebAuthn assertion verification
CREATE TABLE IF NOT EXISTS public.webauthn_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge text NOT NULL,
  purpose text NOT NULL,
  credential_id text,
  consumed_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '5 minutes'),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.webauthn_challenges TO service_role;
ALTER TABLE public.webauthn_challenges ENABLE ROW LEVEL SECURITY;
-- No policies: only service_role touches this table.

-- Mint a fresh challenge for the current user. Returns id + challenge (base64url).
CREATE OR REPLACE FUNCTION public.begin_pass_challenge(_credential_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_challenge text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.resident_biometric_credentials
                 WHERE user_id = auth.uid() AND credential_id = _credential_id) THEN
    RAISE EXCEPTION 'Unknown credential';
  END IF;
  v_challenge := replace(replace(replace(encode(gen_random_bytes(32),'base64'),'+','-'),'/','_'),'=','');
  INSERT INTO public.webauthn_challenges(user_id, challenge, purpose, credential_id)
  VALUES (auth.uid(), v_challenge, 'issue_pass', _credential_id)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id, 'challenge', v_challenge);
END $$;
GRANT EXECUTE ON FUNCTION public.begin_pass_challenge(text) TO authenticated;

-- Lock down the old client-callable RPC; only server (service_role) may issue passes now.
REVOKE EXECUTE ON FUNCTION public.issue_resident_pass(public.resident_pass_kind, text, integer, text) FROM authenticated, anon, public;

-- Server-side issuance: called by server function after WebAuthn signature verified.
CREATE OR REPLACE FUNCTION public.issue_resident_pass_verified(
  _user_id uuid,
  _kind public.resident_pass_kind,
  _guest_name text,
  _ttl_minutes integer,
  _credential_id text,
  _challenge_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_estate uuid;
  v_code text;
  v_id uuid;
  v_expires timestamptz;
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i int;
  v_chal public.webauthn_challenges;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'user required'; END IF;
  SELECT estate_id INTO v_estate FROM public.profiles WHERE id = _user_id;
  IF v_estate IS NULL THEN RAISE EXCEPTION 'No estate assignment'; END IF;

  -- Consume the challenge atomically
  UPDATE public.webauthn_challenges
     SET consumed_at = now()
   WHERE id = _challenge_id
     AND user_id = _user_id
     AND credential_id = _credential_id
     AND purpose = 'issue_pass'
     AND consumed_at IS NULL
     AND expires_at > now()
  RETURNING * INTO v_chal;
  IF v_chal.id IS NULL THEN RAISE EXCEPTION 'Challenge invalid or already used'; END IF;

  v_expires := now() + make_interval(mins => GREATEST(5, LEAST(COALESCE(_ttl_minutes,30), 24*60)));
  LOOP
    v_code := '';
    FOR i IN 1..8 LOOP
      v_code := v_code || substr(v_chars, 1 + floor(random()*length(v_chars))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.resident_passes WHERE estate_id = v_estate AND code = v_code);
  END LOOP;

  INSERT INTO public.resident_passes(estate_id, resident_id, kind, guest_name, code, credential_id, expires_at)
  VALUES (v_estate, _user_id, COALESCE(_kind,'self'), NULLIF(trim(_guest_name),''), v_code, _credential_id, v_expires)
  RETURNING id INTO v_id;

  UPDATE public.resident_biometric_credentials SET last_used_at = now()
    WHERE user_id = _user_id AND credential_id = _credential_id;

  INSERT INTO public.audit_logs(estate_id, actor_id, action, entity, entity_id, metadata)
  VALUES (v_estate, _user_id, 'pass.issued', 'resident_passes', v_id,
          jsonb_build_object('kind', _kind, 'expires_at', v_expires, 'verified', true));

  RETURN jsonb_build_object('id', v_id, 'code', v_code, 'expires_at', v_expires, 'kind', COALESCE(_kind,'self'));
END $$;
REVOKE EXECUTE ON FUNCTION public.issue_resident_pass_verified(uuid, public.resident_pass_kind, text, integer, text, uuid) FROM authenticated, anon, public;
GRANT EXECUTE ON FUNCTION public.issue_resident_pass_verified(uuid, public.resident_pass_kind, text, integer, text, uuid) TO service_role;
