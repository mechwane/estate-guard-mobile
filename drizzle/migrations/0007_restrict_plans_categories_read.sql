DROP POLICY IF EXISTS "plans read" ON public.platform_plans;
CREATE POLICY "plans read super" ON public.platform_plans FOR SELECT TO authenticated USING (public.is_super_admin());
DROP POLICY IF EXISTS "cats readable" ON public.event_categories;
CREATE POLICY "cats readable by members" ON public.event_categories FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL AND public.current_estate_id() IS NOT NULL OR public.is_super_admin());