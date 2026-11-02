CREATE TABLE public.settlement_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estate_id uuid NOT NULL REFERENCES public.estates(id) ON DELETE CASCADE,
  label text NOT NULL,
  purpose text,
  provider text NOT NULL DEFAULT 'paystack',
  bank_name text NOT NULL,
  bank_code text NOT NULL,
  account_number text NOT NULL,
  account_name text,
  subaccount_code text,
  percentage_charge numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.settlement_accounts TO authenticated;
GRANT ALL ON public.settlement_accounts TO service_role;
ALTER TABLE public.settlement_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settlement read" ON public.settlement_accounts FOR SELECT TO authenticated
  USING (public.is_super_admin() OR (public.has_role(auth.uid(),'estate_admin') AND estate_id = public.current_estate_id()));
CREATE POLICY "settlement super insert" ON public.settlement_accounts FOR INSERT TO authenticated WITH CHECK (public.is_super_admin());
CREATE POLICY "settlement super update" ON public.settlement_accounts FOR UPDATE TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE TRIGGER settlement_accounts_updated BEFORE UPDATE ON public.settlement_accounts FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.estate_payment_config (
  estate_id uuid PRIMARY KEY REFERENCES public.estates(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'paystack',
  enabled boolean NOT NULL DEFAULT true,
  default_settlement_account_id uuid REFERENCES public.settlement_accounts(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.estate_payment_config TO authenticated;
GRANT ALL ON public.estate_payment_config TO service_role;
ALTER TABLE public.estate_payment_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "epc read" ON public.estate_payment_config FOR SELECT TO authenticated
  USING (public.is_super_admin() OR estate_id = public.current_estate_id());
CREATE POLICY "epc super insert" ON public.estate_payment_config FOR INSERT TO authenticated WITH CHECK (public.is_super_admin());
CREATE POLICY "epc super update" ON public.estate_payment_config FOR UPDATE TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE TABLE public.payment_provider_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid REFERENCES public.payment_transactions(id) ON DELETE CASCADE,
  estate_id uuid,
  reference text NOT NULL,
  source text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payment_provider_events TO authenticated;
GRANT ALL ON public.payment_provider_events TO service_role;
ALTER TABLE public.payment_provider_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "provider events super read" ON public.payment_provider_events FOR SELECT TO authenticated USING (public.is_super_admin());

ALTER TABLE public.collections ADD COLUMN settlement_account_id uuid REFERENCES public.settlement_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.bill_batches ADD COLUMN settlement_account_id uuid REFERENCES public.settlement_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.payment_transactions ADD COLUMN settlement_account_id uuid REFERENCES public.settlement_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.payment_transactions ADD COLUMN fees numeric NOT NULL DEFAULT 0;
ALTER TABLE public.payment_transactions ADD COLUMN paid_at timestamptz;

-- A collection may only point at a settlement account of its own estate.
CREATE OR REPLACE FUNCTION public.tg_collections_settlement_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.settlement_account_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM settlement_accounts s WHERE s.id = NEW.settlement_account_id AND s.estate_id = NEW.estate_id AND s.active) THEN
    RAISE EXCEPTION 'Choose a settlement account set up for this estate';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER collections_settlement_guard BEFORE INSERT OR UPDATE OF settlement_account_id, estate_id ON public.collections
  FOR EACH ROW EXECUTE FUNCTION public.tg_collections_settlement_guard();

CREATE OR REPLACE FUNCTION public.create_bill_batch(_title text, _bill_type text, _amount numeric, _due_date date, _target_type text DEFAULT 'estate'::text, _target_filter jsonb DEFAULT '{}'::jsonb, _description text DEFAULT NULL::text, _billing_period text DEFAULT NULL::text, _sub_account text DEFAULT NULL::text, _cycle text DEFAULT 'one_time'::text, _late_fee numeric DEFAULT 0, _discount numeric DEFAULT 0, _instructions text DEFAULT NULL::text, _publish boolean DEFAULT false)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _estate uuid := public.current_estate_id(); _batch uuid; _n int; _acct uuid; _acct_label text;
BEGIN
  PERFORM public._assert_estate_admin(_estate);
  IF coalesce(trim(_title),'') = '' THEN RAISE EXCEPTION 'Title required'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Amount must be greater than zero'; END IF;
  IF _sub_account IS NOT NULL AND _sub_account ~* '^[0-9a-f-]{36}$' THEN
    SELECT id, label INTO _acct, _acct_label FROM settlement_accounts WHERE id = _sub_account::uuid AND estate_id = _estate AND active;
    IF _acct IS NULL THEN RAISE EXCEPTION 'Choose a settlement account set up for this estate'; END IF;
  END IF;
  INSERT INTO bill_batches(estate_id,title,bill_type,description,amount,due_date,billing_period,sub_account,settlement_account_id,cycle,target_type,target_filter,late_fee_amount,discount_percent,instructions,status,created_by,published_at)
  VALUES (_estate,trim(_title),_bill_type,_description,_amount,_due_date,_billing_period,coalesce(_acct_label,_sub_account),_acct,_cycle,_target_type,coalesce(_target_filter,'{}'),coalesce(_late_fee,0),coalesce(_discount,0),_instructions,
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
    jsonb_build_object('title',_title,'amount',_amount,'count',_n,'target',_target_type,'settlement_account',_acct));
  RETURN _batch;
END $function$;

-- Provider payments: also confirms to estate admins and platform (super) admins.
CREATE OR REPLACE FUNCTION public.apply_provider_payment(_reference text, _amount numeric, _channel text)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE t payment_transactions; bl bills; _paid numeric; _who text; _msg text;
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
    UPDATE payment_transactions SET status='under_review', channel=_channel, verified_at=now(), updated_at=now(),
      note=coalesce(note,'')||' bill already settled or changed' WHERE id=t.id;
    RETURN 'needs_review';
  END IF;
  UPDATE payment_transactions SET status='successful', channel=_channel, verified_at=now(), paid_at=coalesce(paid_at,now()), updated_at=now() WHERE id=t.id;
  _paid := bl.amount_paid + t.amount;
  UPDATE bills SET amount_paid=_paid, status=(CASE WHEN _paid >= bl.amount THEN 'paid' ELSE 'partially_paid' END)::bill_status, updated_at=now() WHERE id=bl.id;
  INSERT INTO payments(estate_id,bill_id,resident_id,amount,method) VALUES (bl.estate_id,bl.id,bl.resident_id,t.amount,'paystack:'||coalesce(_channel,'card'));
  INSERT INTO payment_receipts(transaction_id,estate_id,bill_id,resident_id,receipt_number,amount)
  VALUES (t.id,bl.estate_id,bl.id,bl.resident_id,'RC-'||to_char(now(),'YYMMDD')||'-'||upper(substr(replace(t.id::text,'-',''),1,8)),t.amount);
  INSERT INTO notifications(user_id,estate_id,title,body,link_to)
  VALUES (bl.resident_id,bl.estate_id,'Payment received','₦'||to_char(t.amount,'FM999,999,999,990.00')||' for '||bl.title||' — receipt issued','/app/resident/bills');
  SELECT coalesce(full_name,'A resident') INTO _who FROM profiles WHERE id = bl.resident_id;
  _msg := coalesce(_who,'A resident')||' paid ₦'||to_char(t.amount,'FM999,999,999,990.00')||' for '||bl.title||' (ref '||_reference||')';
  INSERT INTO notifications(user_id,estate_id,title,body,link_to)
  SELECT DISTINCT u, bl.estate_id, 'Payment received', _msg, '/app/admin/billing' FROM (
    SELECT p.id AS u FROM profiles p JOIN user_roles r ON r.user_id=p.id AND r.role='estate_admin' WHERE p.estate_id=bl.estate_id
    UNION SELECT admin_user_id FROM estates WHERE id=bl.estate_id AND admin_user_id IS NOT NULL) a WHERE u IS NOT NULL;
  INSERT INTO notifications(user_id,estate_id,title,body,link_to)
  SELECT DISTINCT r.user_id, bl.estate_id, 'Payment received', _msg, '/app/super/payments' FROM user_roles r WHERE r.role='super_admin';
  INSERT INTO audit_logs(estate_id,actor_id,action,entity,entity_id,metadata)
  VALUES (bl.estate_id,bl.resident_id,'payment.provider_verified','bill',bl.id,jsonb_build_object('reference',_reference,'amount',t.amount,'channel',_channel));
  RETURN 'applied';
END $function$;
REVOKE EXECUTE ON FUNCTION public.apply_provider_payment(text,numeric,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_provider_payment(text,numeric,text) TO service_role;