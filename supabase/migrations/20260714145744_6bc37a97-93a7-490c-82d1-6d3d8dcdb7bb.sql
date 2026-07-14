
-- 1) BILLS: remove resident self mark-paid; add server-side pay_bill RPC
DROP POLICY IF EXISTS "bills: resident mark paid" ON public.bills;

CREATE OR REPLACE FUNCTION public.pay_bill(_bill_id uuid, _method text DEFAULT 'manual', _reference text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bill public.bills;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_bill FROM public.bills WHERE id = _bill_id FOR UPDATE;
  IF v_bill.id IS NULL THEN RAISE EXCEPTION 'Bill not found'; END IF;
  IF v_bill.resident_id <> auth.uid() THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF v_bill.status = 'paid' THEN RETURN; END IF;

  INSERT INTO public.payments (bill_id, estate_id, resident_id, amount, method, reference)
  VALUES (v_bill.id, v_bill.estate_id, v_bill.resident_id, v_bill.amount,
          COALESCE(NULLIF(trim(_method),''),'manual'), NULLIF(trim(_reference),''));

  UPDATE public.bills SET status = 'paid' WHERE id = _bill_id;

  INSERT INTO public.audit_logs(estate_id, actor_id, action, entity, entity_id, metadata)
  VALUES (v_bill.estate_id, auth.uid(), 'bill.paid', 'bills', v_bill.id,
          jsonb_build_object('amount', v_bill.amount, 'method', _method));
END;
$$;

GRANT EXECUTE ON FUNCTION public.pay_bill(uuid, text, text) TO authenticated;

-- 2) SHOP_ORDERS: block client-supplied price; add place_shop_order RPC
DROP POLICY IF EXISTS "resident manages own orders" ON public.shop_orders;

CREATE POLICY "resident reads own orders" ON public.shop_orders
  FOR SELECT USING (resident_id = auth.uid());

CREATE POLICY "resident cancels own pending orders" ON public.shop_orders
  FOR DELETE USING (resident_id = auth.uid() AND status = 'pending');

CREATE OR REPLACE FUNCTION public.place_shop_order(_item_id uuid, _quantity int DEFAULT 1)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_estate uuid;
  v_item public.shop_items;
  v_id uuid;
  v_qty int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  v_estate := public.current_estate_id();
  IF v_estate IS NULL THEN RAISE EXCEPTION 'No estate assignment'; END IF;
  v_qty := GREATEST(1, LEAST(COALESCE(_quantity,1), 999));

  SELECT * INTO v_item FROM public.shop_items
    WHERE id = _item_id AND estate_id = v_estate AND active = true;
  IF v_item.id IS NULL THEN RAISE EXCEPTION 'Item unavailable'; END IF;

  INSERT INTO public.shop_orders (estate_id, resident_id, item_id, item_name, amount_ngn, quantity, status)
  VALUES (v_estate, auth.uid(), v_item.id, v_item.name, v_item.price_ngn * v_qty, v_qty, 'pending')
  RETURNING id INTO v_id;

  INSERT INTO public.audit_logs(estate_id, actor_id, action, entity, entity_id, metadata)
  VALUES (v_estate, auth.uid(), 'shop_order.placed', 'shop_orders', v_id,
          jsonb_build_object('item_id', v_item.id, 'amount', v_item.price_ngn * v_qty));

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.place_shop_order(uuid, int) TO authenticated;

-- 3) RESIDENT_IDS: allow estate admins/super admins to read for verification
CREATE POLICY "estate admins read resident ids" ON public.resident_ids
  FOR SELECT USING (
    public.is_super_admin()
    OR (public.has_role(auth.uid(),'estate_admin')
        AND resident_id IN (SELECT id FROM public.profiles WHERE estate_id = public.current_estate_id()))
  );
