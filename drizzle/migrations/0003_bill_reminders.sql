CREATE TABLE public.bill_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  estate_id uuid NOT NULL,
  resident_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('upcoming','due_today','overdue')),
  sent_on date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bill_id, kind, sent_on)
);
GRANT SELECT ON public.bill_reminders TO authenticated;
GRANT ALL ON public.bill_reminders TO service_role;
ALTER TABLE public.bill_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read estate reminders" ON public.bill_reminders FOR SELECT TO authenticated
  USING (public.is_super_admin() OR (public.has_role(auth.uid(),'estate_admin') AND estate_id = public.current_estate_id()));
CREATE POLICY "Residents read own reminders" ON public.bill_reminders FOR SELECT TO authenticated
  USING (resident_id = auth.uid());

CREATE OR REPLACE FUNCTION public.send_bill_reminders(_estate uuid DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _count integer := 0; r record; _kind text;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF _estate IS NULL THEN
      IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Not allowed'; END IF;
    ELSE
      IF NOT public.is_super_admin() THEN PERFORM public._assert_estate_admin(_estate); END IF;
    END IF;
  END IF;

  FOR r IN
    SELECT b.* FROM public.bills b
    WHERE b.status IN ('unpaid','partially_paid','overdue')
      AND (_estate IS NULL OR b.estate_id = _estate)
      AND (b.due_date <= current_date + 3)
  LOOP
    _kind := CASE WHEN r.due_date < current_date THEN 'overdue'
                  WHEN r.due_date = current_date THEN 'due_today' ELSE 'upcoming' END;
    -- overdue reminders at most once every 7 days
    IF _kind = 'overdue' AND EXISTS (SELECT 1 FROM public.bill_reminders x WHERE x.bill_id = r.id AND x.kind='overdue' AND x.sent_on > current_date - 7) THEN CONTINUE; END IF;
    IF _kind <> 'overdue' AND EXISTS (SELECT 1 FROM public.bill_reminders x WHERE x.bill_id = r.id AND x.kind=_kind) THEN CONTINUE; END IF;

    INSERT INTO public.bill_reminders(bill_id, estate_id, resident_id, kind) VALUES (r.id, r.estate_id, r.resident_id, _kind)
      ON CONFLICT DO NOTHING;
    INSERT INTO public.notifications(user_id, estate_id, title, body, link_to) VALUES (
      r.resident_id, r.estate_id,
      CASE _kind WHEN 'overdue' THEN 'Bill overdue: ' || r.title WHEN 'due_today' THEN 'Bill due today: ' || r.title ELSE 'Bill due soon: ' || r.title END,
      'Balance ₦' || to_char(r.amount - coalesce(r.amount_paid,0), 'FM999,999,999,990') || ' — due ' || to_char(r.due_date,'DD Mon YYYY'),
      '/app/resident/bills');
    _count := _count + 1;
  END LOOP;

  IF auth.uid() IS NOT NULL THEN
    PERFORM public.log_activity('bill_reminders_sent', 'bills', NULL, jsonb_build_object('count', _count, 'estate_id', _estate));
  END IF;
  RETURN _count;
END $$;
REVOKE ALL ON FUNCTION public.send_bill_reminders(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.send_bill_reminders(uuid) TO authenticated, service_role;