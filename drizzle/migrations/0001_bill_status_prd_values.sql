ALTER TYPE public.bill_status ADD VALUE IF NOT EXISTS 'draft';
ALTER TYPE public.bill_status ADD VALUE IF NOT EXISTS 'partially_paid';
ALTER TYPE public.bill_status ADD VALUE IF NOT EXISTS 'cancelled';