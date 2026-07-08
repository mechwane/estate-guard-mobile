
-- 1. Meetings table
CREATE TABLE public.meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estate_id uuid NOT NULL REFERENCES public.estates(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  starts_at timestamptz NOT NULL,
  location text,
  join_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meetings TO authenticated;
GRANT ALL ON public.meetings TO service_role;

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meetings: read same estate"
  ON public.meetings FOR SELECT
  TO authenticated
  USING (estate_id = public.current_estate_id() OR public.is_super_admin());

CREATE POLICY "meetings: admin insert"
  ON public.meetings FOR INSERT
  TO authenticated
  WITH CHECK (
    (public.has_role(auth.uid(), 'estate_admin') AND estate_id = public.current_estate_id())
    OR public.is_super_admin()
  );

CREATE POLICY "meetings: admin update"
  ON public.meetings FOR UPDATE
  TO authenticated
  USING (
    (public.has_role(auth.uid(), 'estate_admin') AND estate_id = public.current_estate_id())
    OR public.is_super_admin()
  );

CREATE POLICY "meetings: admin delete"
  ON public.meetings FOR DELETE
  TO authenticated
  USING (
    (public.has_role(auth.uid(), 'estate_admin') AND estate_id = public.current_estate_id())
    OR public.is_super_admin()
  );

CREATE TRIGGER tg_meetings_updated
  BEFORE UPDATE ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX meetings_estate_starts_idx ON public.meetings (estate_id, starts_at DESC);

-- 2. Broadcast RPC: creates meeting + notifies every resident in the estate
CREATE OR REPLACE FUNCTION public.create_meeting_and_notify(
  _title text,
  _description text,
  _starts_at timestamptz,
  _location text,
  _join_url text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_estate uuid;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  v_estate := public.current_estate_id();
  IF NOT (public.is_super_admin() OR (public.has_role(auth.uid(),'estate_admin') AND v_estate IS NOT NULL)) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  IF v_estate IS NULL THEN RAISE EXCEPTION 'No estate assigned'; END IF;
  IF _title IS NULL OR length(trim(_title)) < 2 THEN RAISE EXCEPTION 'Title is required'; END IF;
  IF _starts_at IS NULL THEN RAISE EXCEPTION 'Start time is required'; END IF;

  INSERT INTO public.meetings (estate_id, created_by, title, description, starts_at, location, join_url)
  VALUES (v_estate, auth.uid(), trim(_title), NULLIF(trim(_description),''), _starts_at, NULLIF(trim(_location),''), NULLIF(trim(_join_url),''))
  RETURNING id INTO v_id;

  INSERT INTO public.notifications (user_id, estate_id, title, body, link_to)
  SELECT p.id, v_estate,
         'Estate meeting: ' || trim(_title),
         to_char(_starts_at at time zone 'UTC', 'Mon DD, HH24:MI') || ' UTC' ||
           COALESCE(' · ' || NULLIF(trim(_location),''), '') ||
           COALESCE(E'\n' || NULLIF(trim(_description),''), ''),
         '/app/resident/community'
  FROM public.profiles p
  WHERE p.estate_id = v_estate AND p.id <> auth.uid();

  INSERT INTO public.audit_logs(estate_id, actor_id, action, entity, entity_id)
  VALUES (v_estate, auth.uid(), 'meeting.created', 'meetings', v_id);

  RETURN v_id;
END $$;

-- 3. Bootstrap demo estate + auto-role assignment for demo accounts
INSERT INTO public.estates (name, code, status, address, city, state)
VALUES ('Demo Estate', 'DEMO01', 'active', '1 Demo Avenue', 'Lagos', 'Lagos')
ON CONFLICT (code) DO NOTHING;

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
  v_demo_estate uuid;
BEGIN
  v_code := NEW.raw_user_meta_data->>'estate_code';

  SELECT id INTO v_demo_estate FROM public.estates WHERE code = 'DEMO01';

  -- Demo bootstrap accounts
  IF lower(NEW.email) = 'super@estateguard.demo' THEN
    v_role := 'super_admin';
    v_estate_id := NULL;
  ELSIF lower(NEW.email) = 'admin@estateguard.demo' THEN
    v_role := 'estate_admin';
    v_estate_id := v_demo_estate;
  ELSE
    IF v_code IS NOT NULL THEN
      SELECT id INTO v_estate_id FROM public.estates WHERE code = v_code;
    END IF;
    v_role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'resident');
    IF v_role NOT IN ('resident','guard') THEN v_role := 'resident'; END IF;
  END IF;

  INSERT INTO public.profiles (id, full_name, phone, estate_id, unit, approved)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name',
             CASE WHEN v_role IN ('super_admin','estate_admin') THEN 'Estate Guard Admin' ELSE '' END),
    NEW.raw_user_meta_data->>'phone',
    v_estate_id,
    NEW.raw_user_meta_data->>'unit',
    v_role IN ('super_admin','estate_admin')
  );

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role);

  -- Link estate_admin to the demo estate as admin_user_id
  IF v_role = 'estate_admin' AND v_estate_id IS NOT NULL THEN
    UPDATE public.estates SET admin_user_id = NEW.id WHERE id = v_estate_id AND admin_user_id IS NULL;
  END IF;

  RETURN NEW;
END; $function$;
