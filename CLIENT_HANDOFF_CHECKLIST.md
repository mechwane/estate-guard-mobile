# Client Handoff Checklist

Short version of `HANDOVER.md` for the receiving developer.

## Backend (Supabase)

- [ ] Create new Supabase project; note URL, ref, anon key, service role key.
- [ ] `supabase login && supabase link --project-ref <ref>`
- [ ] `supabase db push` — applies all migrations in `supabase/migrations/`.
- [ ] Run `supabase/storage.sql` in SQL Editor to create `avatars` + `verification-docs` buckets and their RLS policies.
- [ ] (Optional) Run `supabase/seed.sql` for the default platform plans.
- [ ] Enable Email auth. Enable Google OAuth if the client wants it.
- [ ] Set **Site URL** and **Additional Redirect URLs** in Auth settings.

## App

- [ ] Update `.env` (see `ENVIRONMENT.md`).
- [ ] Set `SUPABASE_SERVICE_ROLE_KEY` as a secret on the hosting platform (never in the repo).
- [ ] Regenerate types:
      `supabase gen types typescript --project-id <ref> --schema public > src/integrations/supabase/types.ts`
- [ ] `bun install && bun run build` — must succeed with 0 errors.

## First accounts

- [ ] Invite the Super Admin via **Auth → Users** in the dashboard.
- [ ] In SQL Editor, insert their `user_roles` row (see HANDOVER.md §10).
- [ ] Super Admin creates the first estate + estate admin invite from `/app/super`.

## Smoke tests

- [ ] Super Admin dashboard loads with real counts.
- [ ] Estate Admin invite → redeem → land on `/app/admin`.
- [ ] Resident signup with estate code → verification submit → admin approves.
- [ ] Guard validates a guest code → check-in → check-out.
- [ ] Avatar upload works (private bucket + signed URL).
- [ ] Verification doc upload works.

## Do not

- Do not commit `SUPABASE_SERVICE_ROLE_KEY`.
- Do not disable RLS on any table.
- Do not grant `super_admin` through the app UI — SQL only.
- Do not edit `src/integrations/supabase/{client,client.server,auth-middleware,auth-attacher,types}.ts` — they are regenerated.
