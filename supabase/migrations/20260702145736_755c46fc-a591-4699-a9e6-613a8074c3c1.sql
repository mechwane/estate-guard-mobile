
-- Verification status enum
DO $$ BEGIN
  CREATE TYPE public.verification_status AS ENUM ('not_submitted','incomplete','pending','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.occupant_type AS ENUM ('resident','commercial');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Profiles: add avatar, contact, address, verification
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS house_number text,
  ADD COLUMN IF NOT EXISTS block text,
  ADD COLUMN IF NOT EXISTS street text,
  ADD COLUMN IF NOT EXISTS occupant_type public.occupant_type,
  ADD COLUMN IF NOT EXISTS verification_status public.verification_status NOT NULL DEFAULT 'not_submitted',
  ADD COLUMN IF NOT EXISTS verification_notes text,
  ADD COLUMN IF NOT EXISTS verification_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verification_doc_path text;

-- Backfill email from auth.users where missing
UPDATE public.profiles p SET email = u.email
FROM auth.users u WHERE u.id = p.id AND (p.email IS NULL OR p.email = '');

CREATE INDEX IF NOT EXISTS idx_profiles_verification_status ON public.profiles(estate_id, verification_status);

-- Estates: contact + admin assignment
ALTER TABLE public.estates
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS admin_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Prevent residents from self-approving via profiles UPDATE.
-- Drop the wide-open self-update policy and add a narrow one that forbids
-- writing verification/estate columns from the client. Verification changes
-- must go through submit_verification / review_verification RPCs.
DROP POLICY IF EXISTS "profiles: update self" ON public.profiles;
CREATE POLICY "profiles: update self safe" ON public.profiles
FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
);

-- Trigger to freeze protected columns on self update
CREATE OR REPLACE FUNCTION public.tg_profiles_freeze_admin_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Super admin or estate admin in same estate may change anything (their policies apply).
  IF public.is_super_admin() THEN RETURN NEW; END IF;
  IF public.has_role(auth.uid(),'estate_admin') AND OLD.estate_id IS NOT NULL
     AND OLD.estate_id = public.current_estate_id() THEN
    RETURN NEW;
  END IF;
  -- Otherwise (self update): keep admin-controlled fields frozen
  NEW.approved := OLD.approved;
  NEW.estate_id := OLD.estate_id;
  NEW.verification_status := OLD.verification_status;
  NEW.verification_notes := OLD.verification_notes;
  NEW.verification_submitted_at := OLD.verification_submitted_at;
  NEW.verification_reviewed_at := OLD.verification_reviewed_at;
  NEW.verification_reviewed_by := OLD.verification_reviewed_by;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS profiles_freeze_admin_fields ON public.profiles;
CREATE TRIGGER profiles_freeze_admin_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_profiles_freeze_admin_fields();

-- Unique estate-code generator
CREATE OR REPLACE FUNCTION public.generate_unique_estate_code()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  i int;
  tries int := 0;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..6 LOOP
      code := code || substr(chars, 1 + floor(random()*length(chars))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.estates WHERE estates.code = code);
    tries := tries + 1;
    IF tries > 20 THEN RAISE EXCEPTION 'Could not generate unique estate code'; END IF;
  END LOOP;
  RETURN code;
END $$;

REVOKE ALL ON FUNCTION public.generate_unique_estate_code() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_unique_estate_code() TO authenticated;

-- Submit verification RPC
CREATE OR REPLACE FUNCTION public.submit_verification(
  _full_name text,
  _phone text,
  _house_number text,
  _block text,
  _street text,
  _occupant_type public.occupant_type,
  _doc_path text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _full_name IS NULL OR length(trim(_full_name)) < 2 THEN
    RAISE EXCEPTION 'Full name is required';
  END IF;
  IF _house_number IS NULL OR length(trim(_house_number)) < 1 THEN
    RAISE EXCEPTION 'House / unit number is required';
  END IF;
  IF _street IS NULL OR length(trim(_street)) < 2 THEN
    RAISE EXCEPTION 'Street is required';
  END IF;
  IF _occupant_type IS NULL THEN
    RAISE EXCEPTION 'Occupant type is required';
  END IF;

  UPDATE public.profiles SET
    full_name = _full_name,
    phone = _phone,
    house_number = _house_number,
    block = _block,
    street = _street,
    occupant_type = _occupant_type,
    verification_doc_path = COALESCE(_doc_path, verification_doc_path),
    verification_status = 'pending',
    verification_submitted_at = now(),
    verification_notes = NULL
  WHERE id = auth.uid();

  INSERT INTO public.audit_logs (estate_id, action, entity, entity_id, actor_id)
  SELECT estate_id, 'verification.submitted', 'profiles', auth.uid(), auth.uid()
  FROM public.profiles WHERE id = auth.uid();
END $$;

REVOKE ALL ON FUNCTION public.submit_verification(text,text,text,text,text,public.occupant_type,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_verification(text,text,text,text,text,public.occupant_type,text) TO authenticated;

-- Review verification RPC (estate admin)
CREATE OR REPLACE FUNCTION public.review_verification(
  _user_id uuid,
  _approve boolean,
  _notes text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_estate uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT estate_id INTO v_estate FROM public.profiles WHERE id = _user_id;
  IF v_estate IS NULL THEN RAISE EXCEPTION 'Resident has no estate'; END IF;
  IF NOT (public.is_super_admin()
          OR (public.has_role(auth.uid(),'estate_admin') AND v_estate = public.current_estate_id())) THEN
    RAISE EXCEPTION 'Not authorised to review this profile';
  END IF;

  UPDATE public.profiles SET
    verification_status = CASE WHEN _approve THEN 'approved'::public.verification_status
                               ELSE 'rejected'::public.verification_status END,
    verification_reviewed_at = now(),
    verification_reviewed_by = auth.uid(),
    verification_notes = _notes,
    approved = CASE WHEN _approve THEN true ELSE approved END
  WHERE id = _user_id;

  INSERT INTO public.audit_logs (estate_id, action, entity, entity_id, actor_id, metadata)
  VALUES (v_estate, CASE WHEN _approve THEN 'verification.approved' ELSE 'verification.rejected' END,
          'profiles', _user_id, auth.uid(),
          jsonb_build_object('notes', _notes));
END $$;

REVOKE ALL ON FUNCTION public.review_verification(uuid,boolean,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_verification(uuid,boolean,text) TO authenticated;

-- Set estate access (approve/revoke) RPC
CREATE OR REPLACE FUNCTION public.set_estate_access(_user_id uuid, _approved boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_estate uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT estate_id INTO v_estate FROM public.profiles WHERE id = _user_id;
  IF NOT (public.is_super_admin()
          OR (public.has_role(auth.uid(),'estate_admin') AND v_estate = public.current_estate_id())) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  UPDATE public.profiles SET approved = _approved WHERE id = _user_id;
  INSERT INTO public.audit_logs (estate_id, action, entity, entity_id, actor_id)
  VALUES (v_estate, CASE WHEN _approved THEN 'access.granted' ELSE 'access.revoked' END,
          'profiles', _user_id, auth.uid());
END $$;

REVOKE ALL ON FUNCTION public.set_estate_access(uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_estate_access(uuid,boolean) TO authenticated;

-- Assign an estate admin (super admin only)
CREATE OR REPLACE FUNCTION public.assign_estate_admin(_estate_id uuid, _user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Not authorised'; END IF;
  UPDATE public.estates SET admin_user_id = _user_id WHERE id = _estate_id;
  UPDATE public.profiles SET estate_id = _estate_id, approved = true WHERE id = _user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, 'estate_admin')
  ON CONFLICT DO NOTHING;
  INSERT INTO public.audit_logs (estate_id, action, entity, entity_id, actor_id)
  VALUES (_estate_id, 'estate.admin_assigned', 'estates', _estate_id, auth.uid());
END $$;

REVOKE ALL ON FUNCTION public.assign_estate_admin(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_estate_admin(uuid,uuid) TO authenticated;

-- Storage policies: verification-docs (private)
-- Path convention: <user_id>/<filename>
DROP POLICY IF EXISTS "verif docs: owner write" ON storage.objects;
CREATE POLICY "verif docs: owner write" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'verification-docs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "verif docs: owner update" ON storage.objects;
CREATE POLICY "verif docs: owner update" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'verification-docs' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'verification-docs' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "verif docs: read own or estate admin" ON storage.objects;
CREATE POLICY "verif docs: read own or estate admin" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'verification-docs' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_super_admin()
    OR (public.has_role(auth.uid(),'estate_admin')
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id::text = (storage.foldername(name))[1]
            AND p.estate_id = public.current_estate_id()
        ))
  )
);

-- Storage policies: avatars (private bucket, signed URLs)
DROP POLICY IF EXISTS "avatars: owner write" ON storage.objects;
CREATE POLICY "avatars: owner write" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars: owner update" ON storage.objects;
CREATE POLICY "avatars: owner update" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars: read authenticated" ON storage.objects;
CREATE POLICY "avatars: read authenticated" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'avatars');
