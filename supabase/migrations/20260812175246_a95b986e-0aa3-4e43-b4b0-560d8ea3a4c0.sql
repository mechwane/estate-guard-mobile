revoke select (token) on public.estate_admin_invites from authenticated;
revoke select (token) on public.estate_admin_invites from anon;

create or replace function public.super_admin_invite_link(_invite_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _token text;
begin
  if not public.is_super_admin() then
    raise exception 'Not authorized';
  end if;
  select token into _token from public.estate_admin_invites where id = _invite_id;
  if _token is null then
    raise exception 'Invite not found';
  end if;
  return _token;
end;
$$;

revoke all on function public.super_admin_invite_link(uuid) from public;
revoke all on function public.super_admin_invite_link(uuid) from anon;
grant execute on function public.super_admin_invite_link(uuid) to authenticated;

drop policy if exists "elogs insert self" on public.event_logs;
create policy "elogs insert authorized actor"
on public.event_logs
for insert
to authenticated
with check (
  actor_id = auth.uid()
  and (
    public.is_super_admin()
    or exists (
      select 1 from public.events e
      where e.id = event_logs.event_id
        and (
          e.organizer_id = auth.uid()
          or (public.has_role(auth.uid(), 'estate_admin'::app_role) and e.estate_id = public.current_estate_id())
        )
    )
    or exists (
      select 1 from public.registrations r
      where r.event_id = event_logs.event_id and r.user_id = auth.uid()
    )
  )
);

drop policy if exists "vtu own insert" on public.vtu_transactions;
create policy "vtu own insert"
on public.vtu_transactions
for insert
to authenticated
with check (
  user_id = auth.uid()
  and (estate_id is null or estate_id = public.current_estate_id())
);