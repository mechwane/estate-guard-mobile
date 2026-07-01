# Estate Guard — MVP Build Plan

A mobile-first, premium estate operations app. Supabase (Lovable Cloud) backend with strict per‑estate data isolation via RLS. Four roles: Resident, Guard, Estate Admin, Super Admin.

## 1. Foundation
- Enable Lovable Cloud (Supabase: DB, Auth, Storage, Realtime, server functions).
- Design system in `src/styles.css` using the provided palette as `oklch` tokens (`--background #F7F5F2`, `--primary #2C6E63`, `--primary-dark #1F4D38`, `--accent #C89B3C`, etc.), rounded-xl radii, subtle shadow tokens.
- Load Inter via `<link>` in `__root.tsx`. Set app title/description/OG.
- Reusable primitives: `AppShell`, `MobileNav`, `TopBar`, `Card`, `StatCard`, `EmptyState`, `StatusBadge`, `FormField`, `Section`.
- Subtle motion: fade/slide only (framer‑motion, small durations).

## 2. Data model & security
Tables (all in `public`, RLS on, GRANTs to `authenticated`/`service_role`):
- `estates` (id, name, code unique, address, status)
- `profiles` (id=auth uid, full_name, phone, estate_id, unit, approved bool)
- `user_roles` (user_id, role enum: resident|guard|estate_admin|super_admin) + `has_role()` SECURITY DEFINER
- `guest_invites` (id, estate_id, resident_id, guest_name, phone, purpose, visit_time, expires_at, code unique, status: active|used|expired|revoked, checked_in_at, checked_out_at, validated_by)
- `bills` (id, estate_id, resident_id, title, amount, due_date, status: unpaid|paid|overdue, created_by)
- `payments` (id, bill_id, estate_id, resident_id, amount, method, paid_at)
- `issues` (id, estate_id, resident_id, title, description, category, status: open|in_progress|resolved, response, updated_at)
- `audit_logs` (id, estate_id nullable, actor_id, action, entity, entity_id, metadata jsonb, created_at)

Helper functions (SECURITY DEFINER): `has_role(uid, role)`, `current_estate_id()`, `is_super_admin()`.

RLS pattern (per table): rows visible only when `estate_id = current_estate_id()` OR `is_super_admin()`. Residents restricted to their own rows on `guest_invites`, `bills`, `payments`, `issues`. Guards can `SELECT`/`UPDATE` `guest_invites` in their estate for validation/check‑in/out. Estate admins full within their estate. Super admin bypass on all.

Trigger: on `auth.users` insert → create `profiles` row (estate joined via signup form's estate code). Trigger: guest invite `expires_at` past → status computed via view/function.

## 3. Auth & routing (TanStack Start)
- Public routes: `/` splash, `/auth/sign-in`, `/auth/sign-up` (with role + estate code).
- `_authenticated/` layout (integration‑managed) gates the rest.
- After sign‑in, redirect by role:
  - resident → `/app/resident`
  - guard → `/app/guard`
  - estate_admin → `/app/admin`
  - super_admin → `/app/super`
- Bottom mobile nav per role.

## 4. Screens (MVP)
1. Splash — logo, brand tagline, auto‑forward.
2. Sign in — email + password.
3. Sign up — full name, phone, role (resident/guard), estate code, password. Admins/super are seeded/promoted.
4. Resident dashboard — greeting, quick actions (Invite Guest, Report Issue, Pay Bill), summary cards (active invites, unpaid bills, open issues).
5. Guest invite create — form (name, phone, purpose, visit time, expiry) → generates 6‑digit code + shareable text.
6. My guests — tabs Active / Used / Expired; card list with code, guest, time.
7. Bills — tabs Unpaid / Paid / Overdue; card list with amount + due date + action.
8. Issues — list + create form; status chips; response thread.
9. Guard validation — manual code entry (scan stub); on match, show guest details + Check‑in / Check‑out; recent validations list.
10. Estate admin dashboard — stats (residents, invites today, unpaid bills, open issues); tabs: Residents (approve), Bills (create/manage), Guests (log), Issues (respond), Staff, Export.
11. Super admin dashboard — estates table (status toggle), platform stats, audit link, global settings.
12. Audit logs — filterable list (super admin; estate admin sees own estate).

## 5. Server logic (createServerFn)
- `createGuestInvite` (resident) — generates unique 6‑digit code, writes audit log.
- `validateGuestCode` (guard) — verifies code within estate, returns invite, marks used on check‑in.
- `checkInGuest` / `checkOutGuest`.
- `createBill` (estate_admin) — bulk or per resident.
- `markBillPaid` (resident stub or admin).
- `respondIssue` (estate_admin).
- `approveResident` (estate_admin).
- `setEstateStatus` (super_admin).
All protected via `requireSupabaseAuth` + role check via `has_role`; every mutation writes an `audit_logs` row.

## 6. Realtime
- Subscribe to `guest_invites` (resident/guard views), `issues`, `bills` in the active user's estate.

## 7. Out of scope (explicitly not built)
- VTU, events, marketing pages, actual payment processor, SMS delivery, QR camera scan (manual entry only; scan is a stub button).
- Heavy animation/decoration.

## Technical notes
- Storage bucket `estate-assets` (private) for future logo uploads — created but unused screens.
- Every table gets `GRANT SELECT, INSERT, UPDATE, DELETE ... TO authenticated; GRANT ALL ... TO service_role;` in the same migration.
- Roles enforced server‑side; UI hides controls but is not the security boundary.
- Seed: one demo estate + super admin promotion instructions in a migration.

## Deliverable
A working MVP where a resident can sign up with an estate code, create a guest invite, a guard (in same estate) can validate that code, admins can manage bills/issues/residents, and super admin can oversee estates and audit logs — with strict per‑estate isolation.
