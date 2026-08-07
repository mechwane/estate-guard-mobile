ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS attachment_url text,
  ADD COLUMN IF NOT EXISTS attachment_name text,
  ADD COLUMN IF NOT EXISTS attachment_type text;

ALTER TABLE public.chat_messages ALTER COLUMN body SET DEFAULT '';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'chat_messages'
      AND column_name = 'body' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.chat_messages ALTER COLUMN body DROP NOT NULL;
  END IF;
END $$;