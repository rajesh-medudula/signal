# Signal

Signal is an AI customer-conversation intelligence platform. This
repository currently contains **Module 1: project foundation**,
**Module 1.5: design system**, **Module 2A: authentication + secure
Supabase foundation**, **Module 2B: business/workspace tenancy, roles,
and RLS**, and **Module 3A: customer/conversation/message foundation**.
Sign-up, sign-in, sign-out, business onboarding, a protected,
tenant-scoped dashboard, and the canonical `channel_connections` /
`customers` / `customer_identities` / `conversations` / `messages`
schema (with its read/limited-update query layer) are implemented;
channel ingestion, AI processing, CRM, lead scoring, follow-ups, and
billing are still not implemented. Canonical message and verified
customer-identity creation is trusted-backend (`service_role`)
territory only — there is no client-facing way to send or fabricate a
message yet, by design (see `docs/architecture.md`).

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
  conversations/      Customer/conversation/message domain types + read/limited-update query layer (Module 3A)
  db/supabase/        Browser, authenticated-server, service-role Supabase clients + session-refresh helper
  auth/               Session abstraction, route guard, sign-up/in/out server actions
  business/           Business/membership types, queries, active-business context, authorization helpers, onboarding actions
  crm/, scoring/      Draft types for future modules (not a final schema)
  security/           Env-var validation helpers
  ui/                 cn() class-name utility, greeting helper
supabase/migrations/  businesses/memberships schema (2B); customer/conversation/message schema (3A) — roles, RLS policies, triggers
docs/architecture.md  Durable architecture decisions, by module
tests/                Vitest unit tests
tests/rls/            Real Postgres RLS verification harnesses (not part of `npm test` — see the usage note below)
```

## Environment variables

See `.env.example` for the full list with placeholder values. Real
secrets belong in `.env.local`, which is git-ignored.

## Verifying RLS against real Postgres

`tests/rls/verify-rls.mjs` exercises the Module 2B policies —
cross-tenant read/write denial, member-vs-admin authorization,
self-promotion denial, and idempotent onboarding. `tests/rls/verify-rls-conversations.mjs`
does the same for Module 3A, plus what a mocked client can't cover:
`service_role`-only message/identity provenance, the sender/direction
`CHECK` and composite-FK invariants, the `last_message_*` trigger's
concurrency fix (two genuinely concurrent connections), the
advisory-locked identity-resolution race, and bidirectional keyset
pagination. Both use genuine per-user (and, for 3A, per-role) Postgres
sessions — not mocks. They need a local Postgres with
`tests/rls/auth-shim.sql` applied first (a minimal stand-in for
Supabase's `auth.users`/`auth.uid()`/roles, plus the `service_role`
table grants real Supabase projects provide outside of any migration),
then each module's migration in order, and aren't wired into `npm
test` since most environments won't have a local Postgres available.
See the comments at the top of each file for exact setup.

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
