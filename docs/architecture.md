# Architecture

Durable architectural decisions, module by module. This is memory for
future work on the repository — not a changelog and not a tutorial.

## Module 2A — Authentication + secure Supabase foundation

### Authentication identity is separate from business/workspace membership

`AuthenticatedUser` (`lib/auth/session.ts`) is `{ id, email }` only. It
does **not** carry a `businessId`. The tenant model is:

```
User → Membership → Business/Workspace → business-owned resources
```

A user's business context is resolved separately from who they are.
Module 2B (business/workspace + membership) must add that resolution
as its own step — e.g. `resolveActiveBusiness(user)` — rather than
adding a field to `AuthenticatedUser` or to the session. This keeps
"a user belongs to multiple businesses" possible without touching
authentication.

### Three Supabase clients, not one

| Client | File | Key | Respects RLS | Use for |
| --- | --- | --- | --- | --- |
| Browser | `lib/db/supabase/client.ts` | anon | yes | Client components |
| Authenticated server | `lib/db/supabase/server.ts` | anon | yes | Server components, route handlers, server actions acting on behalf of the current user |
| Service role | `lib/db/supabase/admin.ts` | service role | **no** | Trusted server-only infrastructure only (background jobs, ingestion) — never to serve a user's request |

The authenticated server client and the service-role client are
intentionally different functions in different files with different
names (`createSupabaseServerClient` vs. `createServiceRoleClient`), so
reaching for the privileged one takes a deliberate, visible choice
rather than being the path of least resistance. The service-role key
never reaches client code — enforced by `server-only` on both server
files.

### Session cookies, refreshed in `proxy.ts`

The browser and authenticated-server clients both use `@supabase/ssr`
so the session lives in cookies, not localStorage — that's what lets a
server component see the same session the browser has. Server
components can read cookies but not write them, so `proxy.ts` (root)
+ `lib/db/supabase/middleware.ts` refresh the session cookie on every
request. This only maintains the cookie; it does not gate access to
any route.

### Route protection lives next to the routes it protects

`lib/auth/guard.ts` (`requireUser()`) does the redirect. It's called
from `app/dashboard/layout.tsx`, not encoded as a URL pattern in
`proxy.ts` — protection stays visible at the route that needs it.
Because it runs server-side before the layout renders, an
unauthenticated request never receives dashboard markup; there's no
client-side redirect happening after the fact.

## Module boundaries

Later modules build on the contracts above rather than bypassing them:

- Business/workspace and membership (Module 2B) is a resolution step
  layered on top of `AuthenticatedUser`, not a change to it.
- Any code acting on a signed-in user's behalf goes through
  `lib/db/supabase/server.ts`. Reaching for `admin.ts` to "make RLS go
  away" for ordinary user-facing code is a reversal of this decision,
  not an extension of it.
