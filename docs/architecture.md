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

## Module 2B — Business/workspace tenancy, roles, and RLS

### Tenant model, implemented for real

```
auth.users → memberships → businesses
```

A membership row ties one user to one business with one role
(`owner | admin | member`, a Postgres enum). `unique (user_id,
business_id)` prevents duplicate/conflicting membership rows. This
supports both directions the module requires: one user can hold
memberships in several businesses, and one business can have several
members — see `tests/rls/verify-rls.mjs` for both proven against real
Postgres.

`AuthenticatedUser` is unchanged — still `{ id, email }`, still no
tenant field. `lib/business/types.ts` holds the real domain types
(`Business`, `Membership`, `MembershipRole`, `ActiveBusinessContext`),
kept deliberately separate from identity.

### Database security: RLS + application authorization, both

Both `businesses` and `memberships` have RLS **enabled and forced**
(`force row level security`, so even the table owner can't
accidentally bypass it). Policies never reference `memberships` from
inside a policy *on* `memberships` (the recursive-RLS trap) — instead
they call two `SECURITY DEFINER` helpers in a private, non-exposed
`private` schema (`private.is_member_of`, `private.is_business_admin`),
each hard-coding `user_id = (select auth.uid())` internally, never a
caller-supplied id.

Neither table has an `INSERT` policy for client roles. There is no way
for a browser to create a business or a membership row directly —
`businesses` and `memberships` are both default-deny. `memberships`
also has no `UPDATE`/`DELETE` policy for client roles: nobody can
promote themselves, change anyone's role, or remove a member from the
client. Managing additional members (invitations, role changes,
removal) is explicitly future-module work; this module made that gap
a hard database guarantee rather than an unenforced assumption.

`lib/business/authorization.ts` is the application-layer half:
`requireBusinessAccess()` / `requireBusinessAdmin()`. It derives
identity from the authenticated session, not from a client-supplied
`businessId` — an explicit `businessId` argument is only ever used to
look up a membership row scoped to the caller, never trusted as proof
on its own. A non-member (or a member without admin/owner role, for
`requireBusinessAdmin`) gets `notFound()`, not a distinguishing 403 —
so the response can't be used to confirm a business ID exists or that
an admin-only surface exists for a non-admin. RLS is the backstop if
application authorization is ever missed; application authorization is
what gives callers a clean, testable API instead of hand-rolled SQL
checks scattered through routes.

### Business creation: one trusted function, not client-orchestrated inserts

`public.onboard_business(business_name)` (`SECURITY DEFINER`) is the
only way a business or its first membership gets created. It:

- fixes `user_id = (select auth.uid())` and `role = 'owner'` internally
  — never client-supplied, so it can't be used to spoof ownership of
  an arbitrary business or grant an arbitrary role;
- does both inserts as one function call, so there's no window where a
  business exists without an owner (a failure partway through rolls
  back the whole call);
- takes a `pg_advisory_xact_lock` keyed on the caller and, if the
  caller already has any membership, returns their existing business
  instead of creating a new one — a double-submitted onboarding form,
  a refresh after success, or a retried network failure resolves to
  the *same* business rather than `Business A`, `Business B`, `Business
  C`. This is scoped narrowly to the onboarding path, not a general
  idempotency framework.

### Active business context: a cookie is a hint, never proof

`lib/business/context.ts` (`resolveActiveBusiness(user)`) is the one
place that answers "which business is this request operating in?" —
future modules should call it (or the authorization helpers above)
rather than inventing their own resolution. The `signal_active_business`
cookie only records which business the user picked last; every
resolution re-verifies membership through the RLS-respecting server
client, so a tampered or stale cookie value can only ever resolve to a
business the user actually belongs to, or fail through to a safe
default (oldest membership), or `null` if the user has none — never an
arbitrary business the cookie happened to name. `lib/business/actions.ts`
(`setActiveBusinessAction`) is the only way the cookie changes, and it
re-verifies membership before writing it. No business-switcher UI is
built in this module — the mechanism exists so one can be added later
without touching authorization.

### Onboarding routing

A signed-up user with zero memberships is routed to `/onboarding`
(`app/dashboard/layout.tsx` checks `resolveActiveBusiness()` and
redirects if it's `null`; `signUpAction` also redirects new
immediately-confirmed accounts there directly instead of to a
dashboard that would just bounce them anyway). `/onboarding` itself
redirects an already-onboarded user straight to `/dashboard` instead
of re-showing the form — the common case for a refresh or stale
bookmark after a successful submit.

### Known limitation

Supabase's email-confirmation flow (when enabled on a project) needs a
callback route to exchange the confirmation link's token for a
session; this repository doesn't have one yet. That gap predates this
module and sits in the auth flow (Module 2A's area), not the tenancy
boundary this module built — noted here so it isn't lost, not fixed
here to keep this module's scope to business/membership/RLS.

## Module boundaries

Later modules build on the contracts above rather than bypassing them:

- Business/workspace and membership (Module 2B) is a resolution step
  layered on top of `AuthenticatedUser`, not a change to it.
- Any code acting on a signed-in user's behalf goes through
  `lib/db/supabase/server.ts`. Reaching for `admin.ts` to "make RLS go
  away" for ordinary user-facing code is a reversal of this decision,
  not an extension of it.
- Customer/conversation/channel data (Module 3+) is business-scoped
  data that lives *inside* the tenant boundary Module 2B built —
  new tables should get RLS policies following the same
  `private.is_member_of` pattern, not a new authorization scheme.
- Member management (invitations, role changes, removal) was left
  unimplemented on purpose — `memberships` has no client-facing
  `INSERT`/`UPDATE`/`DELETE` policy at all yet. Building that means
  adding narrowly-scoped policies (e.g. "an admin can insert a
  membership for a specific invited user"), not opening the table up
  broadly.
