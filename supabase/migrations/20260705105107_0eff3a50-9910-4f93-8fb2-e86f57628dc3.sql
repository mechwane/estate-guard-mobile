
-- =====================================================================
-- Premium tier
-- =====================================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS premium_plan text DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS premium_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS address_code text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_address_code_unique_idx
  ON public.profiles(address_code) WHERE address_code IS NOT NULL;

-- =====================================================================
-- Estate contacts (directory)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.estate_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estate_id uuid NOT NULL REFERENCES public.estates(id) ON DELETE CASCADE,
  label text NOT NULL,
  role text,
  phone text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.estate_contacts TO authenticated;
GRANT ALL ON public.estate_contacts TO service_role;
ALTER TABLE public.estate_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "estate members read contacts" ON public.estate_contacts
  FOR SELECT TO authenticated USING (estate_id = public.current_estate_id() OR public.is_super_admin());
CREATE POLICY "admins manage contacts" ON public.estate_contacts
  FOR ALL TO authenticated
  USING ( (public.has_role(auth.uid(),'estate_admin') AND estate_id = public.current_estate_id())
          OR public.is_super_admin() )
  WITH CHECK ( (public.has_role(auth.uid(),'estate_admin') AND estate_id = public.current_estate_id())
               OR public.is_super_admin() );

-- =====================================================================
-- Dependents
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.dependents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  estate_id uuid NOT NULL REFERENCES public.estates(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  relationship text,
  phone text,
  age int,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dependents TO authenticated;
GRANT ALL ON public.dependents TO service_role;
ALTER TABLE public.dependents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "resident manages own dependents" ON public.dependents
  FOR ALL TO authenticated
  USING (resident_id = auth.uid())
  WITH CHECK (resident_id = auth.uid() AND estate_id = public.current_estate_id());
CREATE POLICY "estate admins read dependents" ON public.dependents
  FOR SELECT TO authenticated
  USING ( (public.has_role(auth.uid(),'estate_admin') AND estate_id = public.current_estate_id())
          OR public.is_super_admin() );

-- =====================================================================
-- Government IDs (Manage IDs)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.resident_ids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id_type text NOT NULL,
  id_number text NOT NULL,
  doc_path text,
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.resident_ids TO authenticated;
GRANT ALL ON public.resident_ids TO service_role;
ALTER TABLE public.resident_ids ENABLE ROW LEVEL SECURITY;
CREATE POLICY "resident manages own ids" ON public.resident_ids
  FOR ALL TO authenticated
  USING (resident_id = auth.uid())
  WITH CHECK (resident_id = auth.uid());

-- =====================================================================
-- Estate shop
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.shop_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estate_id uuid NOT NULL REFERENCES public.estates(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'service',
  price_ngn numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_items TO authenticated;
GRANT ALL ON public.shop_items TO service_role;
ALTER TABLE public.shop_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "estate members read shop" ON public.shop_items
  FOR SELECT TO authenticated
  USING (estate_id = public.current_estate_id() OR public.is_super_admin());
CREATE POLICY "admins manage shop" ON public.shop_items
  FOR ALL TO authenticated
  USING ( (public.has_role(auth.uid(),'estate_admin') AND estate_id = public.current_estate_id())
          OR public.is_super_admin() )
  WITH CHECK ( (public.has_role(auth.uid(),'estate_admin') AND estate_id = public.current_estate_id())
               OR public.is_super_admin() );

CREATE TABLE IF NOT EXISTS public.shop_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estate_id uuid NOT NULL REFERENCES public.estates(id) ON DELETE CASCADE,
  resident_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.shop_items(id) ON DELETE SET NULL,
  item_name text NOT NULL,
  quantity int NOT NULL DEFAULT 1,
  amount_ngn numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_orders TO authenticated;
GRANT ALL ON public.shop_orders TO service_role;
ALTER TABLE public.shop_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "resident manages own orders" ON public.shop_orders
  FOR ALL TO authenticated
  USING (resident_id = auth.uid())
  WITH CHECK (resident_id = auth.uid() AND estate_id = public.current_estate_id());
CREATE POLICY "estate admins read orders" ON public.shop_orders
  FOR SELECT TO authenticated
  USING ( (public.has_role(auth.uid(),'estate_admin') AND estate_id = public.current_estate_id())
          OR public.is_super_admin() );
CREATE POLICY "estate admins update orders" ON public.shop_orders
  FOR UPDATE TO authenticated
  USING ( (public.has_role(auth.uid(),'estate_admin') AND estate_id = public.current_estate_id())
          OR public.is_super_admin() )
  WITH CHECK ( (public.has_role(auth.uid(),'estate_admin') AND estate_id = public.current_estate_id())
               OR public.is_super_admin() );

-- =====================================================================
-- Requests (Submit a Request)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.resident_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estate_id uuid NOT NULL REFERENCES public.estates(id) ON DELETE CASCADE,
  resident_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL,
  title text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'pending',
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.resident_requests TO authenticated;
GRANT ALL ON public.resident_requests TO service_role;
ALTER TABLE public.resident_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "resident manages own requests" ON public.resident_requests
  FOR ALL TO authenticated
  USING (resident_id = auth.uid())
  WITH CHECK (resident_id = auth.uid() AND estate_id = public.current_estate_id());
CREATE POLICY "estate admins read requests" ON public.resident_requests
  FOR SELECT TO authenticated
  USING ( (public.has_role(auth.uid(),'estate_admin') AND estate_id = public.current_estate_id())
          OR public.is_super_admin() );
CREATE POLICY "estate admins update requests" ON public.resident_requests
  FOR UPDATE TO authenticated
  USING ( (public.has_role(auth.uid(),'estate_admin') AND estate_id = public.current_estate_id())
          OR public.is_super_admin() )
  WITH CHECK ( (public.has_role(auth.uid(),'estate_admin') AND estate_id = public.current_estate_id())
               OR public.is_super_admin() );

CREATE TRIGGER trg_requests_updated_at BEFORE UPDATE ON public.resident_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =====================================================================
-- Community: posts, comments, likes
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estate_id uuid NOT NULL REFERENCES public.estates(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  post_type text NOT NULL DEFAULT 'blog',
  title text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_posts TO authenticated;
GRANT ALL ON public.community_posts TO service_role;
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "estate members read posts" ON public.community_posts
  FOR SELECT TO authenticated
  USING (estate_id = public.current_estate_id() OR public.is_super_admin());
CREATE POLICY "estate admins write posts" ON public.community_posts
  FOR ALL TO authenticated
  USING ( (public.has_role(auth.uid(),'estate_admin') AND estate_id = public.current_estate_id())
          OR public.is_super_admin() )
  WITH CHECK ( (public.has_role(auth.uid(),'estate_admin') AND estate_id = public.current_estate_id())
               OR public.is_super_admin() );

CREATE TABLE IF NOT EXISTS public.post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_comments TO authenticated;
GRANT ALL ON public.post_comments TO service_role;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read comments" ON public.post_comments
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.community_posts p WHERE p.id = post_id
                 AND (p.estate_id = public.current_estate_id() OR public.is_super_admin())));
CREATE POLICY "author writes comments" ON public.post_comments
  FOR ALL TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.post_likes (
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_likes TO authenticated;
GRANT ALL ON public.post_likes TO service_role;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read likes" ON public.post_likes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "user manages own likes" ON public.post_likes
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- =====================================================================
-- Polls
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estate_id uuid NOT NULL REFERENCES public.estates(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  closes_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.polls TO authenticated;
GRANT ALL ON public.polls TO service_role;
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "estate members read polls" ON public.polls
  FOR SELECT TO authenticated
  USING (estate_id = public.current_estate_id() OR public.is_super_admin());
CREATE POLICY "admins manage polls" ON public.polls
  FOR ALL TO authenticated
  USING ( (public.has_role(auth.uid(),'estate_admin') AND estate_id = public.current_estate_id())
          OR public.is_super_admin() )
  WITH CHECK ( (public.has_role(auth.uid(),'estate_admin') AND estate_id = public.current_estate_id())
               OR public.is_super_admin() );

CREATE TABLE IF NOT EXISTS public.poll_votes (
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  option_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (poll_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.poll_votes TO authenticated;
GRANT ALL ON public.poll_votes TO service_role;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read votes" ON public.poll_votes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "user manages own vote" ON public.poll_votes
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- =====================================================================
-- Notifications (Inbox)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  estate_id uuid REFERENCES public.estates(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  link_to text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user reads own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "user marks own notifications" ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "admins insert notifications" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK ( public.is_super_admin()
               OR (public.has_role(auth.uid(),'estate_admin') AND estate_id = public.current_estate_id())
               OR user_id = auth.uid() );

-- =====================================================================
-- Support tickets & replies
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estate_id uuid NOT NULL REFERENCES public.estates(id) ON DELETE CASCADE,
  resident_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "resident manages own tickets" ON public.support_tickets
  FOR ALL TO authenticated
  USING (resident_id = auth.uid())
  WITH CHECK (resident_id = auth.uid() AND estate_id = public.current_estate_id());
CREATE POLICY "estate admins manage tickets" ON public.support_tickets
  FOR ALL TO authenticated
  USING ( (public.has_role(auth.uid(),'estate_admin') AND estate_id = public.current_estate_id())
          OR public.is_super_admin() )
  WITH CHECK ( (public.has_role(auth.uid(),'estate_admin') AND estate_id = public.current_estate_id())
               OR public.is_super_admin() );

CREATE TRIGGER trg_tickets_updated_at BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
