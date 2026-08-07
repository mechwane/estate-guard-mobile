CREATE TABLE public.chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  estate_id uuid NOT NULL REFERENCES public.estates(id) ON DELETE CASCADE,
  resident_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX chat_messages_thread_idx ON public.chat_messages (estate_id, resident_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_select_resident" ON public.chat_messages
FOR SELECT TO authenticated USING (resident_id = auth.uid());

CREATE POLICY "chat_insert_resident" ON public.chat_messages
FOR INSERT TO authenticated
WITH CHECK (resident_id = auth.uid() AND sender_id = auth.uid() AND estate_id = public.current_estate_id());

CREATE POLICY "chat_update_resident" ON public.chat_messages
FOR UPDATE TO authenticated USING (resident_id = auth.uid()) WITH CHECK (resident_id = auth.uid());

CREATE POLICY "chat_select_admin" ON public.chat_messages
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'estate_admin') AND estate_id = public.current_estate_id());

CREATE POLICY "chat_insert_admin" ON public.chat_messages
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'estate_admin') AND estate_id = public.current_estate_id() AND sender_id = auth.uid());

CREATE POLICY "chat_update_admin" ON public.chat_messages
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'estate_admin') AND estate_id = public.current_estate_id())
WITH CHECK (public.has_role(auth.uid(), 'estate_admin') AND estate_id = public.current_estate_id());

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

ALTER TABLE public.estates
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS short_name text,
  ADD COLUMN IF NOT EXISTS automatic_billing boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS streets text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS house_numbers text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS unit_numbers text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS code_validity text[] NOT NULL DEFAULT ARRAY['1 Hour','6 Hours','1 Day'];