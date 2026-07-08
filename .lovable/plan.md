
# Final submission pass

Focused, sequential, one preview at the end. No new backend tables except `meetings` (community meetings) and a seed migration for demo admin/super accounts.

## 1. Resident Home (`app.resident.index.tsx`)
- Show profile photo (already on More) in the header avatar — same source, with initials fallback.
- Turn the "LG2RA" estate chip into an **Estate Switcher**: tap → bottom sheet listing estates the user has access to (from `profiles.estate_id` + memberships); switching updates `profiles.estate_id`. If only one estate, show read-only chip with a copy-code action.
- Floating action button (bottom-right, above tab bar): shield/logo + live clock. Tap → sheet showing the user's active guest invite codes + "Create invite" shortcut. Uses `guest_invites` where `resident_id = me AND status='active' AND expires_at > now()`.
- Keep the existing quick-action tiles (Single Invite, Multiple Invite, Estate Shop, Manage Invites, Submit Request, Report Issue).

## 2. Inbox (`app.resident.inbox.tsx`)
- Sectioned list: Unread / Earlier.
- Row actions: mark read, mark all read, delete.
- Empty state with illustration.
- Tap notification → deep-link via `notifications.link` when present.

## 3. Guard Validate (`app.guard.validate.tsx`)
- Replace search field with a dedicated **code input**: large monospaced input + big "Validate" primary button + optional scan icon (uses camera on mobile if available; otherwise manual entry).
- After validate, show host card + Check-in / Check-out buttons.
- Fully responsive: single-column, safe-area padding, tap targets ≥ 44px, no horizontal scroll on 360px width.

## 4. Community meetings (new)
- New table `public.meetings` (title, description, starts_at, location or link, created_by, estate_id).
- Admin can create meetings from `/app/admin/community` (new tab).
- Resident community page gets a **Meetings** tab showing upcoming meetings; creating a meeting inserts a `notifications` row for every resident in the estate so it also lands in the inbox.

## 5. Super admin & Estate admin
- Complete `/app/super` and `/app/admin` overviews with real counts from existing tables (already partially built — verify counts, add empty-state guards, wire "Assign admin" flow end-to-end).
- Seed migration creates a demo estate + two accounts:
  - `super@estateguard.demo` / `SuperAdmin!2026`
  - `admin@estateguard.demo` / `EstateAdmin!2026`
  - Roles inserted into `user_roles`; admin linked to the demo estate.
- Report credentials in the closing message.

## 6. Splash + auth polish
- `src/routes/index.tsx`: replace static splash with animated logo (spring scale-in + gold ring pulse + tagline fade), 900ms minimum before route resolution.
- `auth.sign-in.tsx` + `auth.sign-up.tsx` + `auth.tsx` layout: premium dark-green gradient background, glass card, gold accents, animated logo header, better field styling, show/hide password toggle. Keep all form logic identical.

## 7. Verification
- Build must pass.
- Manual smoke via Playwright: sign-in page renders new design; resident home shows avatar + estate switcher + FAB; guard validate has code input; admin community has Meetings tab.

## Technical notes
- All new UI uses existing `motion-kit` + tokens (`--primary` dark green, `--accent` gold). No hardcoded colors.
- Meetings table: `GRANT` to authenticated + service_role, RLS by `estate_id = current_estate_id()`, admin/super insert-only.
- Estate switcher only lists estates where the current user is a member or an admin — for now that is just their `estate_id`; UI still built so multi-estate works if backend grows.
- No changes to auto-generated files (`client.ts`, `types.ts`, `routeTree.gen.ts`) except regeneration after migration.

## Out of scope for this pass
- Rebuilding shop / dependents / IDs / requests flows (already shipped in prior turns).
- Guard incident deep-redesign (only validate page).
- Push notifications infra.
