
-- Add event_organizer role
DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'event_organizer';
EXCEPTION WHEN others THEN NULL; END $$;

-- =========================
-- VTU
-- =========================
CREATE TABLE IF NOT EXISTS public.vtu_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type text NOT NULL CHECK (service_type IN ('airtime','data','electricity','cable')),
  name text NOT NULL,
  code text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (service_type, code)
);
GRANT SELECT ON public.vtu_providers TO authenticated;
GRANT ALL ON public.vtu_providers TO service_role;
ALTER TABLE public.vtu_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vtu_providers read all authenticated" ON public.vtu_providers FOR SELECT TO authenticated USING (active = true OR public.is_super_admin());
CREATE POLICY "vtu_providers super manage" ON public.vtu_providers FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE TABLE IF NOT EXISTS public.vtu_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  estate_id uuid REFERENCES public.estates(id) ON DELETE SET NULL,
  service_type text NOT NULL CHECK (service_type IN ('airtime','data','electricity','cable')),
  provider_code text NOT NULL,
  provider_name text NOT NULL,
  recipient text NOT NULL,
  package_label text,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','success','failed')),
  reference text NOT NULL UNIQUE,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.vtu_transactions TO authenticated;
GRANT ALL ON public.vtu_transactions TO service_role;
ALTER TABLE public.vtu_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vtu own read" ON public.vtu_transactions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin() OR (estate_id = public.current_estate_id() AND public.has_role(auth.uid(),'estate_admin')));
CREATE POLICY "vtu own insert" ON public.vtu_transactions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "vtu own update" ON public.vtu_transactions FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS vtu_tx_user_idx ON public.vtu_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS vtu_tx_estate_idx ON public.vtu_transactions(estate_id, created_at DESC);

CREATE TRIGGER vtu_tx_updated BEFORE UPDATE ON public.vtu_transactions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Seed a few providers
INSERT INTO public.vtu_providers (service_type, name, code) VALUES
  ('airtime','MTN','mtn'),('airtime','Airtel','airtel'),('airtime','Glo','glo'),('airtime','9mobile','9mobile'),
  ('data','MTN Data','mtn'),('data','Airtel Data','airtel'),('data','Glo Data','glo'),('data','9mobile Data','9mobile'),
  ('electricity','Ikeja Electric','ikedc'),('electricity','Eko Electric','ekedc'),('electricity','Abuja Electric','aedc'),
  ('cable','DStv','dstv'),('cable','GOtv','gotv'),('cable','Startimes','startimes')
ON CONFLICT DO NOTHING;

-- =========================
-- EVENTS
-- =========================
CREATE TABLE IF NOT EXISTS public.event_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.event_categories TO authenticated, anon;
GRANT ALL ON public.event_categories TO service_role;
ALTER TABLE public.event_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cats readable" ON public.event_categories FOR SELECT USING (true);
CREATE POLICY "cats super manage" ON public.event_categories FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

INSERT INTO public.event_categories (name, slug) VALUES
  ('Community','community'),('Fitness','fitness'),('Kids','kids'),('Social','social'),('Business','business')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  estate_id uuid REFERENCES public.estates(id) ON DELETE SET NULL,
  category_id uuid REFERENCES public.event_categories(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  venue text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  price numeric(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  capacity int,
  cover_url text,
  visibility text NOT NULL DEFAULT 'estate' CHECK (visibility IN ('estate','public')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','suspended','cancelled','completed')),
  faqs jsonb NOT NULL DEFAULT '[]'::jsonb,
  schedule jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT SELECT ON public.events TO anon;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "events read public"    ON public.events FOR SELECT USING (visibility='public' AND status='published');
CREATE POLICY "events read estate"    ON public.events FOR SELECT TO authenticated
  USING (status='published' AND estate_id = public.current_estate_id());
CREATE POLICY "events read own"       ON public.events FOR SELECT TO authenticated USING (organizer_id = auth.uid());
CREATE POLICY "events read admin"     ON public.events FOR SELECT TO authenticated
  USING (public.is_super_admin() OR (public.has_role(auth.uid(),'estate_admin') AND estate_id = public.current_estate_id()));
CREATE POLICY "events insert own"     ON public.events FOR INSERT TO authenticated
  WITH CHECK (organizer_id = auth.uid());
CREATE POLICY "events update own"     ON public.events FOR UPDATE TO authenticated
  USING (organizer_id = auth.uid()) WITH CHECK (organizer_id = auth.uid());
CREATE POLICY "events admin manage"   ON public.events FOR ALL TO authenticated
  USING (public.is_super_admin() OR (public.has_role(auth.uid(),'estate_admin') AND estate_id = public.current_estate_id()))
  WITH CHECK (public.is_super_admin() OR (public.has_role(auth.uid(),'estate_admin') AND estate_id = public.current_estate_id()));

CREATE INDEX IF NOT EXISTS events_estate_idx ON public.events(estate_id, starts_at DESC);
CREATE INDEX IF NOT EXISTS events_org_idx ON public.events(organizer_id, starts_at DESC);
CREATE TRIGGER events_updated BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE IF NOT EXISTS public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  price numeric(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  quantity int,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets TO authenticated;
GRANT SELECT ON public.tickets TO anon;
GRANT ALL ON public.tickets TO service_role;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tickets read" ON public.tickets FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND (
    (e.visibility='public' AND e.status='published')
    OR (auth.uid() IS NOT NULL AND (e.organizer_id = auth.uid() OR e.estate_id = public.current_estate_id() OR public.is_super_admin()))
  ))
);
CREATE POLICY "tickets manage organizer" ON public.tickets FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.organizer_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.organizer_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attendee_name text NOT NULL,
  attendee_phone text,
  validation_code text NOT NULL UNIQUE,
  checked_in_at timestamptz,
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','cancelled','checked_in')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id, ticket_id)
);
GRANT SELECT, INSERT, UPDATE ON public.registrations TO authenticated;
GRANT ALL ON public.registrations TO service_role;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "regs own read" ON public.registrations FOR SELECT TO authenticated
  USING (user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.organizer_id = auth.uid())
    OR public.is_super_admin());
CREATE POLICY "regs insert own" ON public.registrations FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "regs update own or organizer" ON public.registrations FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.organizer_id = auth.uid()))
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS regs_user_idx ON public.registrations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS regs_event_idx ON public.registrations(event_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.event_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.event_logs TO authenticated;
GRANT ALL ON public.event_logs TO service_role;
ALTER TABLE public.event_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "elogs read organizer/admin" ON public.event_logs FOR SELECT TO authenticated
  USING (public.is_super_admin()
    OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND (e.organizer_id = auth.uid() OR (public.has_role(auth.uid(),'estate_admin') AND e.estate_id = public.current_estate_id()))));
CREATE POLICY "elogs insert self" ON public.event_logs FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid());
