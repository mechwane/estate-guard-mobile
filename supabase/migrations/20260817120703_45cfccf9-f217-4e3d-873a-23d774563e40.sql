GRANT DELETE ON public.user_device_sessions TO authenticated;

DROP POLICY IF EXISTS "own device session removable" ON public.user_device_sessions;
CREATE POLICY "own device session removable"
ON public.user_device_sessions FOR DELETE TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "staff can remove estate device sessions" ON public.user_device_sessions;
CREATE POLICY "staff can remove estate device sessions"
ON public.user_device_sessions FOR DELETE TO authenticated
USING (
  is_super_admin()
  OR (
    current_role_is('estate_admin'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = user_device_sessions.user_id
        AND p.estate_id = current_estate_id()
    )
  )
);