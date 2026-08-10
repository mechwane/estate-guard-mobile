create or replace function public.post_comment_thread(_post_id uuid)
returns table (
  id uuid,
  post_id uuid,
  body text,
  created_at timestamptz,
  author_id uuid,
  author_name text,
  author_avatar_url text,
  author_is_admin boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id,
         c.post_id,
         c.body,
         c.created_at,
         c.author_id,
         coalesce(p.full_name, 'Member') as author_name,
         p.avatar_url as author_avatar_url,
         public.has_role(c.author_id, 'estate_admin'::app_role) as author_is_admin
  from public.post_comments c
  join public.community_posts cp on cp.id = c.post_id
  left join public.profiles p on p.id = c.author_id
  where c.post_id = _post_id
    and (cp.estate_id = public.current_estate_id() or public.is_super_admin())
  order by c.created_at asc
$$;

revoke all on function public.post_comment_thread(uuid) from public;
grant execute on function public.post_comment_thread(uuid) to authenticated;

create or replace function public.post_comment_counts()
returns table (post_id uuid, comments bigint)
language sql
stable
security definer
set search_path = public
as $$
  select c.post_id, count(*)::bigint
  from public.post_comments c
  join public.community_posts cp on cp.id = c.post_id
  where cp.estate_id = public.current_estate_id() or public.is_super_admin()
  group by c.post_id
$$;

revoke all on function public.post_comment_counts() from public;
grant execute on function public.post_comment_counts() to authenticated;