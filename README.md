# Signal

Signal is an AI customer-conversation intelligence platform. This
repository currently contains **Module 1: project foundation** and
**Module 1.5: design system**. The visual language is final; product
functionality (auth, database, AI, channel integrations, CRM, lead
scoring, follow-ups, billing) is still not implemented.

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS v4 · Geist Sans/Mono ·
Radix UI primitives · Supabase (planned backend/auth) · Vitest

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
  dashboard/           Dashboard shell + one page per nav item
components/
  brand/              Logo (wordmark)
  marketing/          Landing page sections + product preview mockup
  dashboard/          Sidebar, mobile nav, top bar, account menu, empty states
  ui/                 Design-system primitives (Button, Card, Select, Modal, ...)
lib/
  ai/                 AI provider adapter interface (not implemented)
  channels/           Channel connector interface + gmail/whatsapp/instagram/telegram placeholders
  db/supabase/        Browser + server Supabase clients
  auth/               Session placeholder
  crm/, scoring/      Draft types for future modules (not a final schema)
  security/           Env-var validation helpers
  ui/                 cn() class-name utility, greeting helper
types/                Cross-cutting foundation types
supabase/migrations/  Empty — schema is designed in the next module
tests/                Vitest unit tests
```

## Environment variables

See `.env.example` for the full list with placeholder values. Real
secrets belong in `.env.local`, which is git-ignored.

## Architecture notes

- **Channel independence** — channel-specific code lives only inside
  `lib/channels/<channel>`. Everything else depends on the
  `NormalizedMessage` / `ChannelConnector` contracts in
  `lib/channels/types.ts`.
- **AI provider independence** — application code should call
  `lib/ai/provider.ts` rather than importing a vendor SDK directly.
- **Multi-tenant** — shared types assume every business-scoped record
  carries a `businessId`; there is deliberately no schema assuming a
  single global customer list.
