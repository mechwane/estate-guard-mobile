
-- 1) Estates: remove broad anon SELECT, expose only a narrow lookup RPC
DROP POLICY IF EXISTS "estates: anon code lookup" ON public.estates;

CREATE OR REPLACE FUNCTION public.lookup_estate_by_code(_code text)
RETURNS TABLE(id uuid, code text, name text, status public.estate_status)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id, e.code, e.name, e.status
  FROM public.estates e
  WHERE e.code = trim(_code)
  LIMIT 1;
$$;

-- 2) poll_votes: scope reads to the caller's estate
DROP POLICY IF EXISTS "authenticated read votes" ON public.poll_votes;
CREATE POLICY "read votes in own estate"
ON public.poll_votes FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.polls p
    WHERE p.id = poll_votes.poll_id
      AND (p.estate_id = public.current_estate_id() OR public.is_super_admin())
  )
);

-- 3) post_likes: scope reads to the caller's estate
DROP POLICY IF EXISTS "authenticated read likes" ON public.post_likes;
CREATE POLICY "read likes in own estate"
ON public.post_likes FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.community_posts cp
    WHERE cp.id = post_likes.post_id
      AND (cp.estate_id = public.current_estate_id() OR public.is_super_admin())
  )
);

-- 4) Lock down SECURITY DEFINER functions: revoke public/anon/authenticated
--    execute, then re-grant only where clients actually call them.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated;', r.proname, r.args);
  END LOOP;
END $$;

-- Anon-callable (sign-up estate code lookup)
GRANT EXECUTE ON FUNCTION public.lookup_estate_by_code(text) TO anon, authenticated;

-- Authenticated-callable RPCs the client actually invokes
GRANT EXECUTE ON FUNCTION public.validate_guest_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.guard_check_in(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.guard_check_out(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_estate_admin_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_meeting_and_notify(text, text, timestamptz, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_verification(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_estate_access(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_verification(text, text, text, text, text, public.occupant_type, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_unique_estate_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_estate_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_estate_admin_invite(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reassign_estate_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_estate_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_estate(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.suspend_estate(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_estate(uuid, text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_estate_overview(uuid) TO authenticated;

-- Helper functions used by RLS policies stay callable by authenticated so
-- policies referenced from queries evaluate correctly.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_role_is(public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_estate_id() TO authenticated;
