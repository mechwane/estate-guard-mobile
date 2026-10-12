ALTER TABLE public.estates ADD COLUMN IF NOT EXISTS payment_only_mode boolean NOT NULL DEFAULT false;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS invoice_path text;

CREATE OR REPLACE FUNCTION public.set_payment_only_mode(_on boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _e uuid := public.current_estate_id();
BEGIN
  PERFORM public._assert_estate_admin(_e);
  UPDATE estates SET payment_only_mode = _on WHERE id = _e;
  PERFORM public.log_activity('estate.payment_only_mode', 'estate', _e, jsonb_build_object('enabled', _on));
END $$;

CREATE OR REPLACE FUNCTION public.resident_is_restricted(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p JOIN estates e ON e.id = p.estate_id
    WHERE p.id = _uid AND e.payment_only_mode
      AND EXISTS (SELECT 1 FROM bills b WHERE b.resident_id = _uid
                  AND b.status IN ('unpaid','partially_paid','overdue') AND b.due_date < current_date)
  )
$$;

CREATE OR REPLACE FUNCTION public.tg_block_restricted_resident()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.resident_is_restricted(NEW.resident_id) THEN
    RAISE EXCEPTION 'Your account is in payment-only mode. Please settle overdue bills first.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS block_restricted_guest_invites ON public.guest_invites;
CREATE TRIGGER block_restricted_guest_invites BEFORE INSERT ON public.guest_invites
  FOR EACH ROW EXECUTE FUNCTION public.tg_block_restricted_resident();
DROP TRIGGER IF EXISTS block_restricted_resident_passes ON public.resident_passes;
CREATE TRIGGER block_restricted_resident_passes BEFORE INSERT ON public.resident_passes
  FOR EACH ROW EXECUTE FUNCTION public.tg_block_restricted_resident();
DROP TRIGGER IF EXISTS block_restricted_shop_orders ON public.shop_orders;
CREATE TRIGGER block_restricted_shop_orders BEFORE INSERT ON public.shop_orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_block_restricted_resident();

CREATE OR REPLACE FUNCTION public.admin_set_bill_invoice(_bill uuid, _path text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE bl bills;
BEGIN
  SELECT * INTO bl FROM bills WHERE id=_bill;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bill not found'; END IF;
  PERFORM public._assert_estate_admin(bl.estate_id);
  IF _path IS NOT NULL AND _path NOT LIKE bl.estate_id::text || '/%' THEN RAISE EXCEPTION 'Invalid file path'; END IF;
  UPDATE bills SET invoice_path=_path, updated_at=now() WHERE id=bl.id;
  PERFORM public.log_activity('bill.invoice_attached','bill',bl.id,jsonb_build_object('path',_path));
END $$;

CREATE POLICY "invoices: admin upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='invoices' AND public.has_role(auth.uid(),'estate_admin')
    AND (storage.foldername(name))[1] = public.current_estate_id()::text);
CREATE POLICY "invoices: admin update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id='invoices' AND public.has_role(auth.uid(),'estate_admin')
    AND (storage.foldername(name))[1] = public.current_estate_id()::text);
CREATE POLICY "invoices: read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='invoices' AND (
    public.is_super_admin()
    OR (public.has_role(auth.uid(),'estate_admin') AND (storage.foldername(name))[1] = public.current_estate_id()::text)
    OR EXISTS (SELECT 1 FROM public.bills b WHERE b.invoice_path = name AND b.resident_id = auth.uid())
  ));

-- Provider-verified payment application (server only)
CREATE OR REPLACE FUNCTION public.apply_provider_payment(_reference text, _amount numeric, _channel text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t payment_transactions; bl bills; _paid numeric;
BEGIN
  SELECT * INTO t FROM payment_transactions WHERE provider='paystack' AND provider_reference=_reference FOR UPDATE;
  IF NOT FOUND THEN RETURN 'unknown_reference'; END IF;
  IF t.status = 'successful' THEN RETURN 'already_applied'; END IF;
  IF _amount <> t.amount THEN
    UPDATE payment_transactions SET status='under_review', note=coalesce(note,'')||' amount mismatch: '||_amount, updated_at=now() WHERE id=t.id;
    RETURN 'amount_mismatch';
  END IF;
  SELECT * INTO bl FROM bills WHERE id=t.bill_id FOR UPDATE;
  IF NOT FOUND OR bl.status::text IN ('draft','cancelled','waived','paid') OR t.amount > bl.amount - bl.amount_paid THEN
    UPDATE payment_transactions SET status='under_review', channel=_channel, verified_at=now(), updated_at=now() WHERE id=t.id;
    RETURN 'needs_review';
  END IF;
  UPDATE payment_transactions SET status='successful', channel=_channel, verified_at=now(), updated_at=now() WHERE id=t.id;
  _paid := bl.amount_paid + t.amount;
  UPDATE bills SET amount_paid=_paid, status=(CASE WHEN _paid >= bl.amount THEN 'paid' ELSE 'partially_paid' END)::bill_status, updated_at=now() WHERE id=bl.id;
  INSERT INTO payments(estate_id,bill_id,resident_id,amount,method) VALUES (bl.estate_id,bl.id,bl.resident_id,t.amount,'paystack:'||coalesce(_channel,'card'));
  INSERT INTO payment_receipts(transaction_id,estate_id,bill_id,resident_id,receipt_number,amount)
  VALUES (t.id,bl.estate_id,bl.id,bl.resident_id,'RC-'||to_char(now(),'YYMMDD')||'-'||upper(substr(replace(t.id::text,'-',''),1,8)),t.amount);
  INSERT INTO notifications(user_id,estate_id,title,body,link_to)
  VALUES (bl.resident_id,bl.estate_id,'Payment received','₦'||to_char(t.amount,'FM999,999,999,990')||' for '||bl.title,'/app/resident/bills');
  INSERT INTO audit_logs(estate_id,actor_id,action,entity,entity_id,metadata)
  VALUES (bl.estate_id,bl.resident_id,'payment.provider_verified','bill',bl.id,jsonb_build_object('reference',_reference,'amount',t.amount,'channel',_channel));
  RETURN 'applied';
END $$;
REVOKE ALL ON FUNCTION public.apply_provider_payment(text,numeric,text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_provider_payment(text,numeric,text) TO service_role;

-- Residents can no longer self-declare payments
REVOKE EXECUTE ON FUNCTION public.pay_bill(uuid,text,text) FROM authenticated, anon, public;

REVOKE ALL ON FUNCTION public.set_payment_only_mode(boolean) FROM public, anon;
REVOKE ALL ON FUNCTION public.admin_set_bill_invoice(uuid,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_payment_only_mode(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_bill_invoice(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resident_is_restricted(uuid) TO authenticated;