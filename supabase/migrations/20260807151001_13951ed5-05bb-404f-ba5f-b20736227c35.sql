-- 1. Remove estate-wide visibility of individual votes and likes
DROP POLICY IF EXISTS "read votes in own estate" ON public.poll_votes;
DROP POLICY IF EXISTS "read likes in own estate" ON public.post_likes;

-- Own-row read access (the existing ALL policies already scope to auth.uid(),
-- these make the read intent explicit and durable).
DROP POLICY IF EXISTS "read own vote" ON public.poll_votes;
CREATE POLICY "read own vote"
  ON public.poll_votes
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "read own like" ON public.post_likes;
CREATE POLICY "read own like"
  ON public.post_likes
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 2. Aggregate-only tallies (no user identities exposed)
CREATE OR REPLACE FUNCTION public.poll_vote_tallies()
RETURNS TABLE(poll_id uuid, item_id uuid, option_key text, votes bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.poll_id, v.item_id, v.option_key, count(*)::bigint AS votes
  FROM public.poll_votes v
  JOIN public.polls p ON p.id = v.poll_id
  WHERE p.estate_id = public.current_estate_id() OR public.is_super_admin()
  GROUP BY v.poll_id, v.item_id, v.option_key
$$;

REVOKE ALL ON FUNCTION public.poll_vote_tallies() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.poll_vote_tallies() TO authenticated;

CREATE OR REPLACE FUNCTION public.post_like_counts()
RETURNS TABLE(post_id uuid, likes bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.post_id, count(*)::bigint AS likes
  FROM public.post_likes l
  JOIN public.community_posts cp ON cp.id = l.post_id
  WHERE cp.estate_id = public.current_estate_id() OR public.is_super_admin()
  GROUP BY l.post_id
$$;

REVOKE ALL ON FUNCTION public.post_like_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.post_like_counts() TO authenticated;