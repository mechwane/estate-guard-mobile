
-- 1) bills: replace broad resident UPDATE with trigger-frozen fields
DROP POLICY IF EXISTS "bills: resident mark paid" ON public.bills;
CREATE POLICY "bills: resident mark paid" ON public.bills
  FOR UPDATE TO authenticated
  USING (resident_id = auth.uid())
  WITH CHECK (resident_id = auth.uid());

CREATE OR REPLACE FUNCTION public.tg_bills_freeze_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_super_admin() THEN RETURN NEW; END IF;
  IF public.has_role(auth.uid(),'estate_admin') AND OLD.estate_id = public.current_estate_id() THEN
    RETURN NEW;
  END IF;
  -- Resident self-update: freeze everything except status transition to 'paid'
  NEW.amount := OLD.amount;
  NEW.due_date := OLD.due_date;
  NEW.title := OLD.title;
  NEW.description := OLD.description;
  NEW.estate_id := OLD.estate_id;
  NEW.resident_id := OLD.resident_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tg_bills_freeze_fields ON public.bills;
CREATE TRIGGER tg_bills_freeze_fields
  BEFORE UPDATE ON public.bills
  FOR EACH ROW EXECUTE FUNCTION public.tg_bills_freeze_fields();

-- 2) post_comments: enforce estate scope on INSERT
DROP POLICY IF EXISTS "author writes comments" ON public.post_comments;
CREATE POLICY "author writes comments" ON public.post_comments
  FOR ALL TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.community_posts p
      WHERE p.id = post_id
        AND (p.estate_id = public.current_estate_id() OR public.is_super_admin())
    )
  );

-- 3) notifications: restrict admin inserts to residents of their estate
DROP POLICY IF EXISTS "admins insert notifications" ON public.notifications;
CREATE POLICY "admins insert notifications" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR (
      public.has_role(auth.uid(),'estate_admin')
      AND estate_id = public.current_estate_id()
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = user_id AND p.estate_id = public.current_estate_id()
      )
    )
    OR user_id = auth.uid()
  );

-- 4) resident_requests + shop_orders: freeze admin-workflow fields on self-update
CREATE OR REPLACE FUNCTION public.tg_resident_requests_freeze()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_super_admin() THEN RETURN NEW; END IF;
  IF public.has_role(auth.uid(),'estate_admin') AND OLD.estate_id = public.current_estate_id() THEN
    RETURN NEW;
  END IF;
  NEW.status := OLD.status;
  NEW.admin_notes := OLD.admin_notes;
  NEW.estate_id := OLD.estate_id;
  NEW.resident_id := OLD.resident_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tg_resident_requests_freeze ON public.resident_requests;
CREATE TRIGGER tg_resident_requests_freeze
  BEFORE UPDATE ON public.resident_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_resident_requests_freeze();

CREATE OR REPLACE FUNCTION public.tg_shop_orders_freeze()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_super_admin() THEN RETURN NEW; END IF;
  IF public.has_role(auth.uid(),'estate_admin') AND OLD.estate_id = public.current_estate_id() THEN
    RETURN NEW;
  END IF;
  NEW.status := OLD.status;
  NEW.amount_ngn := OLD.amount_ngn;
  NEW.estate_id := OLD.estate_id;
  NEW.resident_id := OLD.resident_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tg_shop_orders_freeze ON public.shop_orders;
CREATE TRIGGER tg_shop_orders_freeze
  BEFORE UPDATE ON public.shop_orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_shop_orders_freeze();
