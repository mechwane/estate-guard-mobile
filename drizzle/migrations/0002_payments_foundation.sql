
CREATE TABLE public.bill_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estate_id uuid NOT NULL,
  title text NOT NULL,
  bill_type text NOT NULL DEFAULT 'service_charge',
  description text,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  due_date date NOT NULL,
  billing_period text,
  sub_account text,
  cycle text NOT NULL DEFAULT 'one_time',
  target_type text NOT NULL DEFAULT 'estate' CHECK (target_type IN ('estate','street','block','property','residents')),
  target_filter jsonb NOT NULL DEFAULT '{}'::jsonb,
  late_fee_amount numeric(14,2) NOT NULL DEFAULT 0,
  discount_percent numeric(5,2) NOT NULL DEFAULT 0 CHECK (discount_percent BETWEEN 0 AND 100),
  instructions text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','cancelled')),
  bill_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  published_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bill_batches TO authenticated;
GRANT ALL ON public.bill_batches TO service_role;
ALTER TABLE public.bill_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bill_batches admin read" ON public.bill_batches FOR SELECT TO authenticated
  USING (public.is_super_admin() OR (public.has_role(auth.uid(),'estate_admin') AND estate_id = public.current_estate_id()));

ALTER TABLE public.bills
  ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES public.bill_batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bill_type text,
  ADD COLUMN IF NOT EXISTS billing_period text,
  ADD COLUMN IF NOT EXISTS amount_paid numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reference text,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS bills_reference_key ON public.bills(reference) WHERE reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS bills_batch_idx ON public.bills(batch_id);

CREATE TABLE public.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estate_id uuid NOT NULL,
  bill_id uuid REFERENCES public.bills(id) ON DELETE SET NULL,
  resident_id uuid,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  provider text NOT NULL DEFAULT 'manual',
  channel text,
  provider_reference text,
  idempotency_key text,
  status text NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated','pending','processing','successful','failed','expired','reversed','refunded','partially_refunded','unmatched','under_review')),
  recorded_by uuid,
  note text,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX payment_tx_provider_ref_key ON public.payment_transactions(provider, provider_reference) WHERE provider_reference IS NOT NULL;
CREATE UNIQUE INDEX payment_tx_idem_key ON public.payment_transactions(idempotency_key) WHERE idempotency_key IS NOT NULL;
GRANT SELECT ON public.payment_transactions TO authenticated;
GRANT ALL ON public.payment_transactions TO service_role;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payment_tx read" ON public.payment_transactions FOR SELECT TO authenticated
  USING (resident_id = auth.uid() OR public.is_super_admin() OR (public.has_role(auth.uid(),'estate_admin') AND estate_id = public.current_estate_id()));

CREATE TABLE public.payment_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL UNIQUE REFERENCES public.payment_transactions(id) ON DELETE CASCADE,
  estate_id uuid NOT NULL,
  bill_id uuid,
  resident_id uuid,
  receipt_number text NOT NULL UNIQUE,
  amount numeric(14,2) NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payment_receipts TO authenticated;
GRANT ALL ON public.payment_receipts TO service_role;
ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "receipts read" ON public.payment_receipts FOR SELECT TO authenticated
  USING (resident_id = auth.uid() OR public.is_super_admin() OR (public.has_role(auth.uid(),'estate_admin') AND estate_id = public.current_estate_id()));

CREATE TABLE public.payment_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estate_id uuid NOT NULL,
  bill_id uuid REFERENCES public.bills(id) ON DELETE SET NULL,
  transaction_id uuid REFERENCES public.payment_transactions(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('waiver','reversal','refund','cancellation')),
  amount numeric(14,2) NOT NULL DEFAULT 0,
  reason text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payment_adjustments TO authenticated;
GRANT ALL ON public.payment_adjustments TO service_role;
ALTER TABLE public.payment_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "adjustments admin read" ON public.payment_adjustments FOR SELECT TO authenticated
  USING (public.is_super_admin() OR (public.has_role(auth.uid(),'estate_admin') AND estate_id = public.current_estate_id()));

-- Published bill amounts are immutable
CREATE OR REPLACE FUNCTION public.guard_bill_amount()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.amount IS DISTINCT FROM OLD.amount AND OLD.status::text <> 'draft' THEN
    RAISE EXCEPTION 'Published bill amounts cannot be changed. Cancel and reissue instead.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS bills_amount_immutable ON public.bills;
CREATE TRIGGER bills_amount_immutable BEFORE UPDATE ON public.bills FOR EACH ROW EXECUTE FUNCTION public.guard_bill_amount();

CREATE OR REPLACE FUNCTION public._assert_estate_admin(_estate uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.is_super_admin() OR (public.has_role(auth.uid(),'estate_admin') AND _estate = public.current_estate_id())) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.create_bill_batch(
  _title text, _bill_type text, _amount numeric, _due_date date,
  _target_type text DEFAULT 'estate', _target_filter jsonb DEFAULT '{}'::jsonb,
  _description text DEFAULT NULL, _billing_period text DEFAULT NULL, _sub_account text DEFAULT NULL,
  _cycle text DEFAULT 'one_time', _late_fee numeric DEFAULT 0, _discount numeric DEFAULT 0,
  _instructions text DEFAULT NULL, _publish boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _estate uuid := public.current_estate_id(); _batch uuid; _n int;
BEGIN
  PERFORM public._assert_estate_admin(_estate);
  IF coalesce(trim(_title),'') = '' THEN RAISE EXCEPTION 'Title required'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Amount must be greater than zero'; END IF;
  INSERT INTO bill_batches(estate_id,title,bill_type,description,amount,due_date,billing_period,sub_account,cycle,target_type,target_filter,late_fee_amount,discount_percent,instructions,status,created_by,published_at)
  VALUES (_estate,trim(_title),_bill_type,_description,_amount,_due_date,_billing_period,_sub_account,_cycle,_target_type,coalesce(_target_filter,'{}'),coalesce(_late_fee,0),coalesce(_discount,0),_instructions,
          CASE WHEN _publish THEN 'published' ELSE 'draft' END, auth.uid(), CASE WHEN _publish THEN now() END)
  RETURNING id INTO _batch;

  INSERT INTO bills(estate_id,resident_id,title,description,amount,due_date,status,created_by,batch_id,bill_type,billing_period,reference,published_at)
  SELECT _estate, p.id, trim(_title), _description, _amount, _due_date,
         (CASE WHEN _publish THEN 'unpaid' ELSE 'draft' END)::bill_status, auth.uid(), _batch, _bill_type, _billing_period,
         'BL-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)), CASE WHEN _publish THEN now() END
  FROM profiles p
  WHERE p.estate_id = _estate AND p.approved = true
    AND EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = p.id AND r.role = 'resident')
    AND CASE _target_type
      WHEN 'estate' THEN true
      WHEN 'street' THEN p.street = _target_filter->>'street'
      WHEN 'block' THEN p.block = _target_filter->>'block'
      WHEN 'property' THEN p.street = _target_filter->>'street' AND p.house_number = _target_filter->>'house_number'
      WHEN 'residents' THEN p.id::text IN (SELECT jsonb_array_elements_text(coalesce(_target_filter->'resident_ids','[]'::jsonb)))
      ELSE false END;
  GET DIAGNOSTICS _n = ROW_COUNT;
  IF _n = 0 THEN RAISE EXCEPTION 'No residents match this target'; END IF;
  UPDATE bill_batches SET bill_count = _n WHERE id = _batch;
  PERFORM public.log_activity(CASE WHEN _publish THEN 'bill.published' ELSE 'bill.drafted' END,'bill_batch',_batch,
    jsonb_build_object('title',_title,'amount',_amount,'count',_n,'target',_target_type));
  RETURN _batch;
END $$;

CREATE OR REPLACE FUNCTION public.publish_bill_batch(_batch uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b bill_batches;
BEGIN
  SELECT * INTO b FROM bill_batches WHERE id = _batch FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not found'; END IF;
  PERFORM public._assert_estate_admin(b.estate_id);
  IF b.status <> 'draft' THEN RAISE EXCEPTION 'Only drafts can be published'; END IF;
  UPDATE bill_batches SET status='published', published_at=now(), updated_at=now() WHERE id=_batch;
  UPDATE bills SET status='unpaid', published_at=now(), updated_at=now() WHERE batch_id=_batch AND status::text='draft';
  PERFORM public.log_activity('bill.published','bill_batch',_batch,jsonb_build_object('title',b.title));
END $$;

CREATE OR REPLACE FUNCTION public.cancel_bill_batch(_batch uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b bill_batches;
BEGIN
  SELECT * INTO b FROM bill_batches WHERE id = _batch FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not found'; END IF;
  PERFORM public._assert_estate_admin(b.estate_id);
  IF coalesce(trim(_reason),'') = '' THEN RAISE EXCEPTION 'Reason required'; END IF;
  UPDATE bill_batches SET status='cancelled', cancelled_at=now(), cancel_reason=_reason, updated_at=now() WHERE id=_batch;
  UPDATE bills SET status='cancelled', cancelled_at=now(), updated_at=now()
    WHERE batch_id=_batch AND amount_paid = 0 AND status::text IN ('draft','unpaid','overdue');
  PERFORM public.log_activity('bill.cancelled','bill_batch',_batch,jsonb_build_object('title',b.title,'reason',_reason));
END $$;

-- Admin records a verified offline payment (cash / bank transfer confirmed by admin)
CREATE OR REPLACE FUNCTION public.admin_record_payment(_bill uuid, _amount numeric, _channel text, _reference text, _note text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE bl bills; _tx uuid; _paid numeric; _st text;
BEGIN
  SELECT * INTO bl FROM bills WHERE id=_bill FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bill not found'; END IF;
  PERFORM public._assert_estate_admin(bl.estate_id);
  IF bl.status::text IN ('draft','cancelled','waived','paid') THEN RAISE EXCEPTION 'Bill cannot accept payment (%).', bl.status; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  IF _amount > bl.amount - bl.amount_paid THEN RAISE EXCEPTION 'Amount exceeds outstanding balance'; END IF;
  IF coalesce(trim(_reference),'') = '' THEN RAISE EXCEPTION 'Reference required'; END IF;
  INSERT INTO payment_transactions(estate_id,bill_id,resident_id,amount,provider,channel,provider_reference,idempotency_key,status,recorded_by,note,verified_at)
  VALUES (bl.estate_id,bl.id,bl.resident_id,_amount,'manual',_channel,trim(_reference),'manual:'||bl.id||':'||trim(_reference),'successful',auth.uid(),_note,now())
  RETURNING id INTO _tx;
  _paid := bl.amount_paid + _amount;
  _st := CASE WHEN _paid >= bl.amount THEN 'paid' ELSE 'partially_paid' END;
  UPDATE bills SET amount_paid=_paid, status=_st::bill_status, updated_at=now() WHERE id=bl.id;
  INSERT INTO payments(estate_id,bill_id,resident_id,amount,method) VALUES (bl.estate_id,bl.id,bl.resident_id,_amount,coalesce(_channel,'manual'));
  INSERT INTO payment_receipts(transaction_id,estate_id,bill_id,resident_id,receipt_number,amount)
  VALUES (_tx,bl.estate_id,bl.id,bl.resident_id,'RC-'||to_char(now(),'YYMMDD')||'-'||upper(substr(replace(_tx::text,'-',''),1,8)),_amount);
  PERFORM public.log_activity('payment.recorded','bill',bl.id,jsonb_build_object('amount',_amount,'reference',_reference,'channel',_channel));
  RETURN _tx;
END $$;

CREATE OR REPLACE FUNCTION public.admin_adjust_bill(_bill uuid, _kind text, _reason text, _tx uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE bl bills; t payment_transactions;
BEGIN
  SELECT * INTO bl FROM bills WHERE id=_bill FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bill not found'; END IF;
  PERFORM public._assert_estate_admin(bl.estate_id);
  IF coalesce(trim(_reason),'') = '' THEN RAISE EXCEPTION 'Reason required'; END IF;
  IF _kind = 'waiver' THEN
    IF bl.status::text IN ('paid','cancelled','waived') THEN RAISE EXCEPTION 'Bill cannot be waived'; END IF;
    INSERT INTO payment_adjustments(estate_id,bill_id,kind,amount,reason,created_by) VALUES (bl.estate_id,bl.id,'waiver',bl.amount-bl.amount_paid,_reason,auth.uid());
    UPDATE bills SET status='waived', updated_at=now() WHERE id=bl.id;
  ELSIF _kind = 'reversal' THEN
    SELECT * INTO t FROM payment_transactions WHERE id=_tx AND bill_id=bl.id FOR UPDATE;
    IF NOT FOUND OR t.status <> 'successful' THEN RAISE EXCEPTION 'Only successful transactions can be reversed'; END IF;
    UPDATE payment_transactions SET status='reversed', updated_at=now() WHERE id=t.id;
    INSERT INTO payment_adjustments(estate_id,bill_id,transaction_id,kind,amount,reason,created_by) VALUES (bl.estate_id,bl.id,t.id,'reversal',t.amount,_reason,auth.uid());
    UPDATE bills SET amount_paid = greatest(0, amount_paid - t.amount),
      status = (CASE WHEN amount_paid - t.amount <= 0 THEN (CASE WHEN due_date < current_date THEN 'overdue' ELSE 'unpaid' END) ELSE 'partially_paid' END)::bill_status,
      updated_at=now() WHERE id=bl.id;
  ELSE RAISE EXCEPTION 'Unknown adjustment'; END IF;
  PERFORM public.log_activity('bill.'||_kind,'bill',bl.id,jsonb_build_object('reason',_reason,'tx',_tx));
END $$;

REVOKE ALL ON FUNCTION public._assert_estate_admin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_bill_batch(text,text,numeric,date,text,jsonb,text,text,text,text,numeric,numeric,text,boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.publish_bill_batch(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_bill_batch(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_record_payment(uuid,numeric,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_adjust_bill(uuid,text,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._assert_estate_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_bill_batch(text,text,numeric,date,text,jsonb,text,text,text,text,numeric,numeric,text,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_bill_batch(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_bill_batch(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_record_payment(uuid,numeric,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_adjust_bill(uuid,text,text,uuid) TO authenticated;
