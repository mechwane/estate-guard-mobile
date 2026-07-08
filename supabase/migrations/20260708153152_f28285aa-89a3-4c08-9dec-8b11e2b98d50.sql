
-- 1) bills: admin update — re-check role + freeze estate/resident in WITH CHECK
DROP POLICY IF EXISTS "bills: admin update" ON public.bills;
CREATE POLICY "bills: admin update"
ON public.bills
FOR UPDATE
TO authenticated
USING (
  public.is_super_admin()
  OR (public.has_role(auth.uid(),'estate_admin') AND estate_id = public.current_estate_id())
)
WITH CHECK (
  public.is_super_admin()
  OR (public.has_role(auth.uid(),'estate_admin') AND estate_id = public.current_estate_id())
);

-- 2) bills: resident mark paid — restrict USING/WITH CHECK to status='paid'
DROP POLICY IF EXISTS "bills: resident mark paid" ON public.bills;
CREATE POLICY "bills: resident mark paid"
ON public.bills
FOR UPDATE
TO authenticated
USING (resident_id = auth.uid())
WITH CHECK (resident_id = auth.uid() AND status = 'paid');

-- 3) payments: remove resident self-insert; only admins (same estate) + service role may insert
DROP POLICY IF EXISTS "payments: resident insert own" ON public.payments;

CREATE POLICY "payments: admin insert"
ON public.payments
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_super_admin()
  OR (
    public.has_role(auth.uid(),'estate_admin')
    AND EXISTS (
      SELECT 1 FROM public.bills b
      WHERE b.id = payments.bill_id
        AND b.estate_id = public.current_estate_id()
    )
  )
);
