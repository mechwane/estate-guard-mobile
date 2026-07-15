
-- Tighten issues UPDATE WITH CHECK to mirror USING role conditions
DROP POLICY IF EXISTS "issues: admin update" ON public.issues;
CREATE POLICY "issues: admin update" ON public.issues
FOR UPDATE
USING ((estate_id = current_estate_id()) AND has_role(auth.uid(), 'estate_admin'::app_role))
WITH CHECK ((estate_id = current_estate_id()) AND has_role(auth.uid(), 'estate_admin'::app_role));

DROP POLICY IF EXISTS "issues: guard update own" ON public.issues;
CREATE POLICY "issues: guard update own" ON public.issues
FOR UPDATE
USING ((estate_id = current_estate_id()) AND (reporter_id = auth.uid()) AND has_role(auth.uid(), 'guard'::app_role))
WITH CHECK ((estate_id = current_estate_id()) AND (reporter_id = auth.uid()) AND has_role(auth.uid(), 'guard'::app_role));

-- Defense-in-depth: recompute shop_orders.amount_ngn from shop_items on insert
-- for any non-admin caller, so a client-supplied amount cannot be trusted.
CREATE OR REPLACE FUNCTION public.tg_shop_orders_recompute_amount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_price numeric;
  v_name text;
  v_qty int;
BEGIN
  IF public.is_super_admin()
     OR (public.has_role(auth.uid(),'estate_admin') AND NEW.estate_id = public.current_estate_id()) THEN
    RETURN NEW;
  END IF;

  IF NEW.item_id IS NULL THEN
    RAISE EXCEPTION 'item_id is required';
  END IF;

  SELECT price_ngn, name INTO v_price, v_name
    FROM public.shop_items
    WHERE id = NEW.item_id AND estate_id = NEW.estate_id AND active = true;
  IF v_price IS NULL THEN
    RAISE EXCEPTION 'Item unavailable';
  END IF;

  v_qty := GREATEST(1, LEAST(COALESCE(NEW.quantity,1), 999));
  NEW.quantity   := v_qty;
  NEW.item_name  := v_name;
  NEW.amount_ngn := v_price * v_qty;
  NEW.status     := COALESCE(NEW.status, 'pending');
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS shop_orders_recompute_amount ON public.shop_orders;
CREATE TRIGGER shop_orders_recompute_amount
BEFORE INSERT ON public.shop_orders
FOR EACH ROW EXECUTE FUNCTION public.tg_shop_orders_recompute_amount();
