
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('resident','guard','estate_admin','super_admin');
CREATE TYPE public.estate_status AS ENUM ('active','suspended');
CREATE TYPE public.invite_status AS ENUM ('active','used','expired','revoked');
CREATE TYPE public.bill_status AS ENUM ('unpaid','paid','overdue');
CREATE TYPE public.issue_status AS ENUM ('open','in_progress','resolved');

-- ============ ESTATES ============
CREATE TABLE public.estates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  address text,
  status public.estate_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.estates TO authenticated;
GRANT ALL ON public.estates TO service_role;
ALTER TABLE public.estates ENABLE ROW LEVEL SECURITY;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  phone text,
  estate_id uuid REFERENCES public.estates(id) ON DELETE SET NULL,
  unit text,
  approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============ SECURITY DEFINER HELPERS ============
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role) $$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.has_role(auth.uid(), 'super_admin') $$;

CREATE OR REPLACE FUNCTION public.current_estate_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT estate_id FROM public.profiles WHERE id = auth.uid() $$;

CREATE OR REPLACE FUNCTION public.current_role_is(_role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.has_role(auth.uid(), _role) $$;

-- Updated at helper
CREATE OR REPLACE FUNCTION public.tg_set_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ PROFILE AUTO-CREATION ============
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_estate_id uuid;
  v_role public.app_role;
  v_code text;
BEGIN
  v_code := NEW.raw_user_meta_data->>'estate_code';
  IF v_code IS NOT NULL THEN
    SELECT id INTO v_estate_id FROM public.estates WHERE code = v_code;
  END IF;

  INSERT INTO public.profiles (id, full_name, phone, estate_id, unit, approved)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name',''),
    NEW.raw_user_meta_data->>'phone',
    v_estate_id,
    NEW.raw_user_meta_data->>'unit',
    false
  );

  v_role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'resident');
  -- prevent self-elevation to admin/super_admin via signup
  IF v_role NOT IN ('resident','guard') THEN v_role := 'resident'; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role);

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ RLS POLICIES ============

-- estates
CREATE POLICY "estates: read own or super" ON public.estates FOR SELECT TO authenticated
USING (id = public.current_estate_id() OR public.is_super_admin());
CREATE POLICY "estates: super insert" ON public.estates FOR INSERT TO authenticated
WITH CHECK (public.is_super_admin());
CREATE POLICY "estates: super update" ON public.estates FOR UPDATE TO authenticated
USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
-- Allow anon to look up an estate code during signup (name/code only via API? we allow read of row)
CREATE POLICY "estates: anon code lookup" ON public.estates FOR SELECT TO anon
USING (true);

-- profiles
CREATE POLICY "profiles: read self" ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid() OR public.is_super_admin() OR
       (estate_id = public.current_estate_id() AND public.has_role(auth.uid(),'estate_admin')));
CREATE POLICY "profiles: update self" ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles: admin update within estate" ON public.profiles FOR UPDATE TO authenticated
USING (estate_id = public.current_estate_id() AND public.has_role(auth.uid(),'estate_admin'))
WITH CHECK (estate_id = public.current_estate_id() AND public.has_role(auth.uid(),'estate_admin'));

-- user_roles
CREATE POLICY "user_roles: read self or super" ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_super_admin());

-- ============ GUEST INVITES ============
CREATE TABLE public.guest_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estate_id uuid NOT NULL REFERENCES public.estates(id) ON DELETE CASCADE,
  resident_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  guest_name text NOT NULL,
  phone text,
  purpose text,
  visit_time timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  code text NOT NULL UNIQUE,
  status public.invite_status NOT NULL DEFAULT 'active',
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  validated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.guest_invites(estate_id);
CREATE INDEX ON public.guest_invites(resident_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.guest_invites TO authenticated;
GRANT ALL ON public.guest_invites TO service_role;
ALTER TABLE public.guest_invites ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER tg_gi_updated BEFORE UPDATE ON public.guest_invites
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE POLICY "gi: resident read own" ON public.guest_invites FOR SELECT TO authenticated
USING (
  resident_id = auth.uid()
  OR public.is_super_admin()
  OR (estate_id = public.current_estate_id() AND (
    public.has_role(auth.uid(),'guard') OR public.has_role(auth.uid(),'estate_admin')
  ))
);
CREATE POLICY "gi: resident insert own" ON public.guest_invites FOR INSERT TO authenticated
WITH CHECK (
  resident_id = auth.uid()
  AND estate_id = public.current_estate_id()
  AND public.has_role(auth.uid(),'resident')
);
CREATE POLICY "gi: guard/admin update in estate" ON public.guest_invites FOR UPDATE TO authenticated
USING (
  estate_id = public.current_estate_id() AND (
    public.has_role(auth.uid(),'guard') OR public.has_role(auth.uid(),'estate_admin')
    OR resident_id = auth.uid()
  )
) WITH CHECK (estate_id = public.current_estate_id());

-- ============ BILLS ============
CREATE TABLE public.bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estate_id uuid NOT NULL REFERENCES public.estates(id) ON DELETE CASCADE,
  resident_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  amount numeric(12,2) NOT NULL,
  due_date date NOT NULL,
  status public.bill_status NOT NULL DEFAULT 'unpaid',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.bills(estate_id);
CREATE INDEX ON public.bills(resident_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bills TO authenticated;
GRANT ALL ON public.bills TO service_role;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER tg_bills_updated BEFORE UPDATE ON public.bills
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE POLICY "bills: read scope" ON public.bills FOR SELECT TO authenticated
USING (
  public.is_super_admin()
  OR resident_id = auth.uid()
  OR (estate_id = public.current_estate_id() AND public.has_role(auth.uid(),'estate_admin'))
);
CREATE POLICY "bills: admin insert" ON public.bills FOR INSERT TO authenticated
WITH CHECK (estate_id = public.current_estate_id() AND public.has_role(auth.uid(),'estate_admin'));
CREATE POLICY "bills: admin update" ON public.bills FOR UPDATE TO authenticated
USING (estate_id = public.current_estate_id() AND public.has_role(auth.uid(),'estate_admin'))
WITH CHECK (estate_id = public.current_estate_id());
CREATE POLICY "bills: resident mark paid" ON public.bills FOR UPDATE TO authenticated
USING (resident_id = auth.uid())
WITH CHECK (resident_id = auth.uid());

-- ============ PAYMENTS ============
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  estate_id uuid NOT NULL REFERENCES public.estates(id) ON DELETE CASCADE,
  resident_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  method text NOT NULL DEFAULT 'manual',
  paid_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.payments(estate_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments: read scope" ON public.payments FOR SELECT TO authenticated
USING (
  public.is_super_admin()
  OR resident_id = auth.uid()
  OR (estate_id = public.current_estate_id() AND public.has_role(auth.uid(),'estate_admin'))
);
CREATE POLICY "payments: resident insert own" ON public.payments FOR INSERT TO authenticated
WITH CHECK (resident_id = auth.uid() AND estate_id = public.current_estate_id());

-- ============ ISSUES ============
CREATE TABLE public.issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estate_id uuid NOT NULL REFERENCES public.estates(id) ON DELETE CASCADE,
  resident_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  category text,
  status public.issue_status NOT NULL DEFAULT 'open',
  response text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.issues(estate_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.issues TO authenticated;
GRANT ALL ON public.issues TO service_role;
ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER tg_issues_updated BEFORE UPDATE ON public.issues
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE POLICY "issues: read scope" ON public.issues FOR SELECT TO authenticated
USING (
  public.is_super_admin()
  OR resident_id = auth.uid()
  OR (estate_id = public.current_estate_id() AND public.has_role(auth.uid(),'estate_admin'))
);
CREATE POLICY "issues: resident insert own" ON public.issues FOR INSERT TO authenticated
WITH CHECK (resident_id = auth.uid() AND estate_id = public.current_estate_id() AND public.has_role(auth.uid(),'resident'));
CREATE POLICY "issues: admin update" ON public.issues FOR UPDATE TO authenticated
USING (estate_id = public.current_estate_id() AND public.has_role(auth.uid(),'estate_admin'))
WITH CHECK (estate_id = public.current_estate_id());

-- ============ AUDIT LOGS ============
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estate_id uuid REFERENCES public.estates(id) ON DELETE SET NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity text,
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.audit_logs(estate_id);
CREATE INDEX ON public.audit_logs(created_at DESC);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit: super or estate_admin scope" ON public.audit_logs FOR SELECT TO authenticated
USING (
  public.is_super_admin()
  OR (estate_id = public.current_estate_id() AND public.has_role(auth.uid(),'estate_admin'))
);

-- ============ REALTIME ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.guest_invites;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bills;
ALTER PUBLICATION supabase_realtime ADD TABLE public.issues;
