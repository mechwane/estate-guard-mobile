DROP POLICY "resident reads own orders" ON public.shop_orders;
CREATE POLICY "resident reads own orders" ON public.shop_orders
  FOR SELECT TO authenticated
  USING (resident_id = auth.uid());

DROP POLICY "resident cancels own pending orders" ON public.shop_orders;
CREATE POLICY "resident cancels own pending orders" ON public.shop_orders
  FOR DELETE TO authenticated
  USING ((resident_id = auth.uid()) AND (status = 'pending'::text));

DROP POLICY "estate admins read resident ids" ON public.resident_ids;
CREATE POLICY "estate admins read resident ids" ON public.resident_ids
  FOR SELECT TO authenticated
  USING (
    is_super_admin() OR (
      has_role(auth.uid(), 'estate_admin'::app_role)
      AND resident_id IN (SELECT profiles.id FROM public.profiles WHERE profiles.estate_id = current_estate_id())
    )
  );

DROP POLICY "issues: admin update" ON public.issues;
CREATE POLICY "issues: admin update" ON public.issues
  FOR UPDATE TO authenticated
  USING ((estate_id = current_estate_id()) AND has_role(auth.uid(), 'estate_admin'::app_role))
  WITH CHECK ((estate_id = current_estate_id()) AND has_role(auth.uid(), 'estate_admin'::app_role));

DROP POLICY "issues: guard update own" ON public.issues;
CREATE POLICY "issues: guard update own" ON public.issues
  FOR UPDATE TO authenticated
  USING ((estate_id = current_estate_id()) AND (reporter_id = auth.uid()) AND has_role(auth.uid(), 'guard'::app_role))
  WITH CHECK ((estate_id = current_estate_id()) AND (reporter_id = auth.uid()) AND has_role(auth.uid(), 'guard'::app_role));