
ALTER TABLE public.guest_invites ADD COLUMN IF NOT EXISTS num_guests smallint NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_audit_logs_estate_created ON public.audit_logs(estate_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);

-- Super admin can create/manage estates (in addition to existing policies)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='estates' AND policyname='Super admin manages estates') THEN
    CREATE POLICY "Super admin manages estates" ON public.estates FOR ALL TO authenticated
      USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
  END IF;
END $$;
