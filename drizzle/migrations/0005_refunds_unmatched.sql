ALTER TABLE public.payment_transactions ADD COLUMN IF NOT EXISTS refunded_amount numeric NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.admin_refund_transaction(_tx uuid, _amount numeric, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t payment_transactions; bl bills; _left numeric;
BEGIN
  SELECT * INTO t FROM payment_transactions WHERE id=_tx FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transaction not found'; END IF;
  PERFORM public._assert_estate_admin(t.estate_id);
  IF coalesce(trim(_reason),'')='' THEN RAISE EXCEPTION 'Reason required'; END IF;
  IF t.status NOT IN ('successful','partially_refunded') THEN RAISE EXCEPTION 'Only successful payments can be refunded'; END IF;
  _left := t.amount - t.refunded_amount;
  IF _amount IS NULL OR _amount <= 0 OR _amount > _left THEN RAISE EXCEPTION 'Refund must be between 1 and %', _left; END IF;
  UPDATE payment_transactions SET refunded_amount = refunded_amount + _amount,
    status = CASE WHEN refunded_amount + _amount >= amount THEN 'refunded' ELSE 'partially_refunded' END,
    updated_at = now() WHERE id=t.id;
  INSERT INTO payment_adjustments(estate_id,bill_id,transaction_id,kind,amount,reason,created_by)
    VALUES (t.estate_id,t.bill_id,t.id,'refund',_amount,_reason,auth.uid());
  IF t.bill_id IS NOT NULL THEN
    SELECT * INTO bl FROM bills WHERE id=t.bill_id FOR UPDATE;
    UPDATE bills SET amount_paid = greatest(0, amount_paid - _amount),
      status = (CASE WHEN status::text IN ('waived','cancelled') THEN status::text
                     WHEN amount_paid - _amount <= 0 THEN (CASE WHEN due_date < current_date THEN 'overdue' ELSE 'unpaid' END)
                     ELSE 'partially_paid' END)::bill_status,
      updated_at = now() WHERE id = bl.id;
  END IF;
  PERFORM public.log_activity('payment.refunded','payment_transaction',t.id,jsonb_build_object('amount',_amount,'reason',_reason,'bill',t.bill_id));
END $$;

CREATE OR REPLACE FUNCTION public.admin_record_unmatched(_amount numeric, _channel text, _reference text, _note text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _estate uuid := public.current_estate_id(); _tx uuid;
BEGIN
  PERFORM public._assert_estate_admin(_estate);
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  IF coalesce(trim(_reference),'')='' THEN RAISE EXCEPTION 'Reference required'; END IF;
  INSERT INTO payment_transactions(estate_id,amount,provider,channel,provider_reference,idempotency_key,status,recorded_by,note)
  VALUES (_estate,_amount,'manual',_channel,trim(_reference),'unmatched:'||_estate||':'||trim(_reference),'unmatched',auth.uid(),_note)
  RETURNING id INTO _tx;
  PERFORM public.log_activity('payment.unmatched_recorded','payment_transaction',_tx,jsonb_build_object('amount',_amount,'reference',_reference));
  RETURN _tx;
END $$;

CREATE OR REPLACE FUNCTION public.admin_match_transaction(_tx uuid, _bill uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t payment_transactions; bl bills; _paid numeric;
BEGIN
  SELECT * INTO t FROM payment_transactions WHERE id=_tx FOR UPDATE;
  IF NOT FOUND OR t.status <> 'unmatched' THEN RAISE EXCEPTION 'Only unmatched payments can be matched'; END IF;
  PERFORM public._assert_estate_admin(t.estate_id);
  SELECT * INTO bl FROM bills WHERE id=_bill FOR UPDATE;
  IF NOT FOUND OR bl.estate_id <> t.estate_id THEN RAISE EXCEPTION 'Bill not found'; END IF;
  IF bl.status::text IN ('draft','cancelled','waived','paid') THEN RAISE EXCEPTION 'Bill cannot accept payment (%).', bl.status; END IF;
  IF t.amount <> bl.amount - bl.amount_paid AND t.amount > bl.amount - bl.amount_paid THEN
    RAISE EXCEPTION 'Payment (%) is more than the bill balance (%)', t.amount, bl.amount - bl.amount_paid; END IF;
  UPDATE payment_transactions SET bill_id=bl.id, resident_id=bl.resident_id, status='successful', verified_at=now(), updated_at=now() WHERE id=t.id;
  _paid := bl.amount_paid + t.amount;
  UPDATE bills SET amount_paid=_paid, status=(CASE WHEN _paid >= bl.amount THEN 'paid' ELSE 'partially_paid' END)::bill_status, updated_at=now() WHERE id=bl.id;
  INSERT INTO payments(estate_id,bill_id,resident_id,amount,method) VALUES (bl.estate_id,bl.id,bl.resident_id,t.amount,coalesce(t.channel,'manual'));
  INSERT INTO payment_receipts(transaction_id,estate_id,bill_id,resident_id,receipt_number,amount)
  VALUES (t.id,bl.estate_id,bl.id,bl.resident_id,'RC-'||to_char(now(),'YYMMDD')||'-'||upper(substr(replace(t.id::text,'-',''),1,8)),t.amount);
  PERFORM public.log_activity('payment.matched','bill',bl.id,jsonb_build_object('tx',t.id,'amount',t.amount));
END $$;

REVOKE ALL ON FUNCTION public.admin_refund_transaction(uuid,numeric,text) FROM public, anon;
REVOKE ALL ON FUNCTION public.admin_record_unmatched(numeric,text,text,text) FROM public, anon;
REVOKE ALL ON FUNCTION public.admin_match_transaction(uuid,uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_refund_transaction(uuid,numeric,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_record_unmatched(numeric,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_match_transaction(uuid,uuid) TO authenticated;