
# Production Readiness & Auth Hardening Plan

Goal: make the app safe to submit. Keep visual design, dark-green/gold palette, working routes/features. VTU stays removed. No changes to `vite.config.ts`, `nitro()` config, or the `build` script.

## 1. Fix admin authentication (highest priority)

**Problem:** `handle_new_user` currently grants `super_admin` / `estate_admin` when the email matches `super@estateguard.demo` or `admin@estateguard.demo`. `auth.sign-up.tsx` also bypasses the estate-code requirement for those emails. Global auto-confirm is on. All of this is a production risk.

**Migration `harden_auth_roles`:**
- Rewrite `public.handle_new_user`: only ever assign `resident` or `guard` from public sign-up. Ignore any `role`/email that would grant `estate_admin` or `super_admin`. Estate is resolved only via `estate_code`.
- Add `public.invite_estate_admin(_email, _estate_id)` (SECURITY DEFINER, super-admin only): creates the auth user via `auth.admin` is not available in SQL, so instead insert a pending row into a new `public.estate_admin_invites` table `(email, estate_id, token, expires_at, accepted_at)` with RLS + GRANTs. Super admin generates an invite link; the invitee signs up normally as resident, then on first login a `redeem_estate_admin_invite(_token)` RPC promotes them to `estate_admin` and links their estate. This keeps role assignment server-side and gated by a one-time token.
- Add `public.remove_estate_admin(_estate_id)` (super-admin only): clears `admin_user_id`, revokes `estate_admin` role from that user.
- Keep existing `assign_estate_admin` / `reassign_estate_admin` for direct super-admin actions on an existing user.
- Seed a single super admin only if none exists yet, using a check against `user_roles` — no email-based hardcoding.

**Frontend `src/routes/auth.sign-up.tsx`:**
- Remove `isDemoAdmin` bypass entirely. Estate code required for all public sign-ups. Role limited to `resident` | `guard`.
- If URL has `?admin_invite=<token>`, show a distinct "Accept admin invitation" flow: email + password only, then call `redeem_estate_admin_invite`.

**Auth config:** turn OFF global `auto_confirm_email`. Document that Supabase email confirmation should be enabled for production; invited admins are confirmed via the invite acceptance flow which runs after normal signup.

## 2. Super Admin → Estate Admin invite UI

New route `src/routes/app.super.estates.$estateId.tsx` already exists — add an "Estate admins" section with:
- Current admin (name/email, active status, remove button)
- "Invite estate admin" form → calls `invite_estate_admin`, shows generated link `/auth/sign-up?admin_invite=<token>` to copy.
- "Reassign to existing user" (existing RPC).

## 3. Role routing & guard verification

- Confirm `src/lib/session.ts` `roleHome()` covers all four roles and `_authenticated` layout redirects unknown users to `/auth`.
- Add a top-level role-guard helper in each `app.<role>.*` route via the existing `app.tsx` layout: if `role` mismatch → `/app/denied`.
- Verify RLS: spot-check policies on `profiles`, `estates`, `guest_invites`, `bills`, `meetings`, `notifications` are scoped by `estate_id` and role.

## 4. Feature audit sweep

Walk each Resident/Guard/Admin/Super route file listed in the request. For each, either:
- Confirm it works end-to-end, OR
- Replace non-functional buttons with clear "Coming soon" state, OR
- Hide from nav.

Specifically check: Rate App, Share App, Premium/upgrade, checkout — mark as "Coming soon" (no fake payment success). No fake testimonials/stats/logos.

## 5. Mobile & polish

- Verify Guard Validate page, bottom nav clearance, dialog fit on small screens.
- Respect `prefers-reduced-motion` in splash and framer-motion usage (wrap heavy animations).
- No design changes beyond fixes.

## 6. Secrets / VTU / branding scan

Grep for: `service_role`, hardcoded passwords, `VTU`, `Arkcess`, fake app-store links. Fix or remove.

## 7. Verify

- `tsgo` typecheck
- Build check via the sandbox
- Playwright smoke: sign in as each seeded role, hit each dashboard, attempt cross-role URL → expect `/app/denied`.

## 8. Final report

Return the 22-section report as specified.

---

**Note on scope:** this is a large multi-file pass. I'll batch edits aggressively (parallel writes) and only stop for confirmation if a decision is genuinely ambiguous. The one place I want your OK before starting:

**The Estate Admin invite flow requires the invitee to sign up as a normal user first, then accept the invite token to be promoted.** I'm doing it this way because Supabase's `auth.admin.createUser` isn't available from SQL RPC and adding a server function that uses the service-role admin client is a bigger surface. If you'd rather I add a `createServerFn` that uses `supabaseAdmin.auth.admin.inviteUserByEmail` to send a real Supabase invite email (requires the service role, still safe because it's gated by `has_role(super_admin)`), say so and I'll do that instead.

Approve and I'll execute.
