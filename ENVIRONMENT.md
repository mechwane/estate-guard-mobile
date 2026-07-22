# Environment Variables

The app reads Supabase config from two sets of variables: `VITE_*` for
the browser build and unprefixed for server code.

## Client (browser) — required

Placed in `.env` and inlined at build time by Vite. Safe to expose:
these are publishable keys.

| Variable | Example | Purpose |
| -------- | ------- | ------- |
| `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` | REST + Auth endpoint |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` or legacy `eyJ…` (anon) | Anon API key used by the browser |
| `VITE_SUPABASE_PROJECT_ID` | `<ref>` | Used by tooling |

## Server — required (SSR / server functions)

Set on the host (Vercel/Cloudflare/etc.) **and** in local `.env` for
`bun run dev`.

| Variable | Purpose |
| -------- | ------- |
| `SUPABASE_URL` | Same as `VITE_SUPABASE_URL` |
| `SUPABASE_PUBLISHABLE_KEY` | Same as `VITE_SUPABASE_PUBLISHABLE_KEY` |
| `SUPABASE_PROJECT_ID` | Same as `VITE_SUPABASE_PROJECT_ID` |

## Server — optional (privileged operations)

| Variable | Purpose |
| -------- | ------- |
| `SUPABASE_SERVICE_ROLE_KEY` | Only used by `src/integrations/supabase/client.server.ts` for trusted admin operations. NEVER expose to the browser and NEVER prefix with `VITE_`. Store as a secret on the hosting platform. |

## Notes

- After changing any `.env` variable, restart `bun run dev`.
- The `sb_publishable_…` / `sb_secret_…` key format is opaque, not a JWT. The generated Supabase clients in this repo (`client.ts`, `client.server.ts`) already handle both formats — do not edit those files.
- No other secrets are required by the app itself. If you add a
  third-party integration later (Stripe, Paystack, email provider),
  store its key via your hosting platform's secret manager.
