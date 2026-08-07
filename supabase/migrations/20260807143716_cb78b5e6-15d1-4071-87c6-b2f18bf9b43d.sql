CREATE TABLE IF NOT EXISTS public.collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estate_id uuid NOT NULL REFERENCES public.estates(id) ON DELETE CASCADE,
  created_by uuid,
  title text NOT NULL,
  description text,
  cover_image_url text,
  tag text,
  payment_type text NOT NULL DEFAULT 'one_time',
  payment_cycle text,
  sub_account text,
  amount numeric NOT NULL DEFAULT 0,
  due_date date NOT NULL,
  scope text NOT NULL DEFAULT 'general',
  target_address text,
  priority integer NOT NULL DEFAULT 0,
  is_utility boolean NOT NULL DEFAULT false,
  topup_allowed boolean NOT NULL DEFAULT false,
  is_periodic boolean NOT NULL DEFAULT false,
  is_optional boolean NOT NULL DEFAULT false,
  exclude_from_waiver boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.collections DROP CONSTRAINT IF EXISTS collections_scope_check;
ALTER TABLE public.collections ADD CONSTRAINT collections_scope_check CHECK (scope IN ('general','resident','address'));
ALTER TABLE public.collections DROP CONSTRAINT IF EXISTS collections_status_check;
ALTER TABLE public.collections ADD CONSTRAINT collections_status_check CHECK (status IN ('active','archived'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.collections TO authenticated;
GRANT ALL ON public.collections TO service_role;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "collections_read_estate" ON public.collections;
CREATE POLICY "collections_read_estate"
ON public.collections FOR SELECT TO authenticated
USING (public.is_super_admin() OR estate_id = public.current_estate_id());

DROP POLICY IF EXISTS "collections_write_admin" ON public.collections;
CREATE POLICY "collections_write_admin"
ON public.collections FOR ALL TO authenticated
USING (public.is_super_admin() OR (public.has_role(auth.uid(), 'estate_admin') AND estate_id = public.current_estate_id()))
WITH CHECK (public.is_super_admin() OR (public.has_role(auth.uid(), 'estate_admin') AND estate_id = public.current_estate_id()));

CREATE INDEX IF NOT EXISTS collections_estate_idx ON public.collections (estate_id, created_at DESC);

ALTER TABLE public.bills
  ADD COLUMN IF NOT EXISTS collection_id uuid REFERENCES public.collections(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS bills_collection_idx ON public.bills (collection_id);

CREATE OR REPLACE FUNCTION public.touch_collections_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_collections_updated_at ON public.collections;
CREATE TRIGGER update_collections_updated_at
BEFORE UPDATE ON public.collections
FOR EACH ROW EXECUTE FUNCTION public.touch_collections_updated_at();