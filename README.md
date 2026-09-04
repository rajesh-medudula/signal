# Signal

Signal is an AI customer-conversation intelligence platform. This
repository currently contains **Module 1: project foundation**,
**Module 1.5: design system**, **Module 2A: authentication + secure
Supabase foundation**, and **Module 2B: business/workspace tenancy,
roles, and RLS**. Sign-up, sign-in, sign-out, business onboarding, and
a protected, tenant-scoped dashboard are implemented; the rest of the
product (database schema for customer/conversation data, AI, channel
integrations, CRM, lead scoring, follow-ups, billing) is still not
implemented.

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS v4 · Geist Sans/Mono ·
Radix UI primitives · Supabase (Auth + Postgres, with RLS) · Vitest

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in real values later; not required to run the UI
npm run dev
```

Open http://localhost:3000 for the landing page, or
http://localhost:3000/dashboard for the dashboard shell.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Production build |
| `npm start` | Run the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |
| `npm test` | Vitest unit tests |

## Project structure

```
app/                  Routes (App Router)
  page.tsx            Landing page (nav, hero, product preview, roadmap sections)
  sign-in/, sign-up/  Auth routes
  onboarding/         First-business creation (redirect target for users with no business yet)
  dashboard/          Dashboard shell + one page per nav item (protected, tenant-scoped)
proxy.ts               Refreshes the Supabase session cookie on each request
components/
  brand/              Logo (wordmark)
  marketing/          Landing page sections + product preview mockup
  dashboard/          Sidebar, mobile nav, top bar, account menu, empty states
  auth/               Sign-in/sign-up forms + shared auth page shell
  business/           Onboarding form
  ui/                 Design-system primitives (Button, Card, Select, Modal, ...)
lib/
  ai/                 AI provider adapter interface (not implemented)
  channels/           Channel connector interface + gmail/whatsapp/instagram/telegram placeholders
  db/supabase/        Browser, authenticated-server, service-role Supabase clients + session-refresh helper
  auth/               Session abstraction, route guard, sign-up/in/out server actions
  business/           Business/membership types, queries, active-business context, authorization helpers, onboarding actions
  crm/, scoring/      Draft types for future modules (not a final schema)
  security/           Env-var validation helpers
  ui/                 cn() class-name utility, greeting helper
supabase/migrations/  businesses/memberships schema, roles, RLS policies, onboarding function
docs/architecture.md  Durable architecture decisions, by module
tests/                Vitest unit tests
tests/rls/            Real Postgres RLS verification harness (not part of `npm test` — see its usage note below)
```

## Environment variables

See `.env.example` for the full list with placeholder values. Real
secrets belong in `.env.local`, which is git-ignored.

## Verifying RLS against real Postgres

`tests/rls/verify-rls.mjs` exercises the actual policies in
`supabase/migrations/` against a real Postgres instance — cross-tenant
read/write denial, member-vs-admin authorization, self-promotion
denial, and idempotent onboarding — using genuine per-user sessions
(not mocks). It needs a local Postgres with `tests/rls/auth-shim.sql`
applied first (a minimal stand-in for Supabase's `auth.users`/
`auth.uid()`/roles) and isn't wired into `npm test` since most
environments won't have a local Postgres available. See the comments
at the top of both files for exact setup.

## Architecture notes

- **Channel independence** — channel-specific code lives only inside
  `lib/channels/<channel>`. Everything else depends on the
  `NormalizedMessage` / `ChannelConnector` contracts in
  `lib/channels/types.ts`.
- **AI provider independence** — application code should call
  `lib/ai/provider.ts` rather than importing a vendor SDK directly.
- **Multi-tenant, for real** — `businesses` and `memberships` (with a
  `role` enum) implement `User → Membership → Business`; every
  business-scoped table added in later modules should follow the same
  pattern rather than assuming a single global customer list.
  Authenticated user identity stays separate from business/workspace
  membership — see `docs/architecture.md`.
- **Supabase client separation** — the authenticated server client
  (`lib/db/supabase/server.ts`, RLS-respecting) and the service-role
  client (`lib/db/supabase/admin.ts`, RLS-bypassing) are deliberately
  different functions. See `docs/architecture.md` for when to use
  which.
- **RLS + application authorization, both** — database policies are
  the backstop; `lib/business/authorization.ts` is what routes
  actually call. See `docs/architecture.md` for the full model.
