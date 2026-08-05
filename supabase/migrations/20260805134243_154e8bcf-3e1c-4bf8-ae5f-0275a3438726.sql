create or replace function public.admin_record_bill_payment(_bill_id uuid, _method text default 'cash', _reference text default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_bill public.bills;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into v_bill from public.bills where id = _bill_id for update;
  if v_bill.id is null then raise exception 'Bill not found'; end if;
  if not (public.is_super_admin() or (public.has_role(auth.uid(),'estate_admin') and v_bill.estate_id = public.current_estate_id())) then
    raise exception 'Not authorised';
  end if;
  if v_bill.status = 'paid' then return; end if;

  insert into public.payments (bill_id, estate_id, resident_id, amount, method)
  values (v_bill.id, v_bill.estate_id, v_bill.resident_id, v_bill.amount,
          coalesce(nullif(trim(_method),''),'cash'));

  update public.bills set status = 'paid' where id = _bill_id;

  insert into public.audit_logs(estate_id, actor_id, action, entity, entity_id, metadata)
  values (v_bill.estate_id, auth.uid(), 'bill.paid.offline', 'bills', v_bill.id,
          jsonb_build_object('amount', v_bill.amount, 'method', _method, 'reference', _reference));
end $$;

revoke all on function public.admin_record_bill_payment(uuid, text, text) from public;
grant execute on function public.admin_record_bill_payment(uuid, text, text) to authenticated;