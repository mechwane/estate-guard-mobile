ALTER TABLE public.discounts
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS code_type text NOT NULL DEFAULT 'percent',
  ADD COLUMN IF NOT EXISTS value numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS usage_type text NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS usage_limit integer,
  ADD COLUMN IF NOT EXISTS used_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_purchase_amount numeric,
  ADD COLUMN IF NOT EXISTS min_payment_count integer;

ALTER TABLE public.discounts
  ADD CONSTRAINT discounts_code_type_chk CHECK (code_type IN ('fixed','percent')) NOT VALID;
ALTER TABLE public.discounts
  ADD CONSTRAINT discounts_usage_type_chk CHECK (usage_type IN ('all','dues','products')) NOT VALID;

UPDATE public.discounts SET code = upper(replace(name,' ','')) WHERE code IS NULL;
UPDATE public.discounts SET value = percent WHERE value = 0 AND percent IS NOT NULL;