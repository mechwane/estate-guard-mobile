-- Extend polls into full voting sessions (polls + elections)
ALTER TABLE public.polls
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'poll',
  ADD COLUMN IF NOT EXISTS promo_image_url text,
  ADD COLUMN IF NOT EXISTS how_to_win text NOT NULL DEFAULT 'residents',
  ADD COLUMN IF NOT EXISTS starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS allow_anonymous boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_by uuid;

ALTER TABLE public.polls DROP CONSTRAINT IF EXISTS polls_kind_check;
ALTER TABLE public.polls ADD CONSTRAINT polls_kind_check CHECK (kind IN ('poll','election'));
ALTER TABLE public.polls DROP CONSTRAINT IF EXISTS polls_how_to_win_check;
ALTER TABLE public.polls ADD CONSTRAINT polls_how_to_win_check CHECK (how_to_win IN ('residents','address'));

-- Individual questions (poll) / posts (election) inside a voting session
CREATE TABLE IF NOT EXISTS public.poll_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  title text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.poll_items TO authenticated;
GRANT ALL ON public.poll_items TO service_role;
ALTER TABLE public.poll_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "poll_items_read_estate" ON public.poll_items;
CREATE POLICY "poll_items_read_estate"
ON public.poll_items FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.polls p
  WHERE p.id = poll_items.poll_id
    AND (public.is_super_admin() OR p.estate_id = public.current_estate_id())
));

DROP POLICY IF EXISTS "poll_items_write_admin" ON public.poll_items;
CREATE POLICY "poll_items_write_admin"
ON public.poll_items FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.polls p
  WHERE p.id = poll_items.poll_id
    AND (public.is_super_admin()
      OR (public.has_role(auth.uid(), 'estate_admin') AND p.estate_id = public.current_estate_id()))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.polls p
  WHERE p.id = poll_items.poll_id
    AND (public.is_super_admin()
      OR (public.has_role(auth.uid(), 'estate_admin') AND p.estate_id = public.current_estate_id()))
));

-- Votes can now target a specific item within the session
ALTER TABLE public.poll_votes
  ADD COLUMN IF NOT EXISTS item_id uuid REFERENCES public.poll_items(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS poll_votes_unique_item
  ON public.poll_votes (poll_id, user_id, coalesce(item_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Estate admins and super admins may read resident avatars for their estate
DROP POLICY IF EXISTS "avatars_read_admin" ON storage.objects;
CREATE POLICY "avatars_read_admin"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'avatars'
  AND (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id::text = (storage.foldername(storage.objects.name))[1]
        AND public.has_role(auth.uid(), 'estate_admin')
        AND p.estate_id = public.current_estate_id()
    )
  )
);