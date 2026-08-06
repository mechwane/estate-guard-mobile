REVOKE SELECT ON public.access_devices FROM authenticated;
GRANT SELECT (id, estate_id, name, device_type, location, status, last_seen_at, last_sync_at, notes, created_at, updated_at) ON public.access_devices TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.access_devices TO authenticated;
GRANT ALL ON public.access_devices TO service_role;

DROP POLICY IF EXISTS "Estate members can view devices" ON public.access_devices;
CREATE POLICY "Estate members can view devices"
ON public.access_devices FOR SELECT TO authenticated
USING (estate_id = current_estate_id());