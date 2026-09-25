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

## Module 3A — Customer / Conversation / Message foundation

### Five business-scoped tables, reusing Module 2B's tenant boundary as-is

`channel_connections`, `customers`, `customer_identities`,
`conversations`, `messages` (all `public`, migration
`20260924120000_customer_conversation_message_foundation.sql`). Every
table carries a direct, non-null `business_id`, forced RLS using the
same `private.is_member_of` / `private.is_business_admin` helpers from
Module 2B, and composite tenant-consistent foreign keys (`(id,
business_id)` on the parent side) rather than a second tenant
mechanism. `conversations` is strictly 1:1 with `customers` — one
thread per (customer, channel connection) — enforced by `UNIQUE
(channel_connection_id, external_conversation_id)`; this is also the
database backstop behind the "never misattribute a secondary thread
participant to the primary customer" rule — an inbound event with
unsupported multi-participant shape must be quarantined by the
ingestion layer (not built yet) rather than force-fit into this model.

### Two trust boundaries, enforced at both the RLS and SQL-privilege layers

- **`authenticated`** (ordinary signed-in member, via
  `lib/db/supabase/server.ts`): can read everything in their business,
  and can edit a narrow, explicitly column-granted set of metadata —
  `customers` (`display_name`, `primary_email`, `primary_phone`,
  `metadata`), `conversations` (`subject`, `status`),
  `channel_connections` (`display_label`, `status`, admin-only). No
  role has `DELETE` on any of the five tables.
- **`service_role`** (trusted backend ingestion/integration
  infrastructure, via `lib/db/supabase/admin.ts`): the *only* path
  that can create `messages` or `customer_identities` at all.
  `authenticated` has zero `INSERT`/`UPDATE` on `messages` and zero
  `INSERT` on `customer_identities` — enforced by explicit `REVOKE`
  statements in the migration, not RLS alone, so this holds even if an
  RLS policy were ever added or misconfigured later. There is
  deliberately no client-facing message-creation path in
  `lib/conversations/queries.ts` (§19 of the module design) — sending
  a message is future outbox-module work
  (`User Send Intent → Outbox Queue → Provider API → Provider
  Confirmation → service_role → canonical messages row`), not this
  module.

### `messages` is canonical, provider-confirmed history only

`external_message_id` is `text not null`, backed by `UNIQUE
(channel_connection_id, external_message_id)` — there is no
"pending/unconfirmed outbound" row shape mixed into this table.
`sequence` is a `bigint generated always as identity`, the allocation-
order tiebreaker; `(provider_sent_at, sequence)` is the total display/
pagination order. Both are represented as `string` at the TypeScript
boundary (`Message.sequence`, `Conversation.lastMessageSequence`) to
avoid `bigint` → `number` precision loss over JSON — see the row
mappers in `lib/conversations/queries.ts`.

A `CHECK` constraint is the direction/sender matrix: `inbound` implies
`sender_type = 'customer'`; `outbound` implies `business_member` or
`system`. Composite FKs additionally enforce that a `customer` sender
actually matches the message's own conversation
(`(conversation_id, business_id, sender_customer_id)` →
`conversations(id, business_id, customer_id)`) and that a
`business_member` sender actually holds a membership in the message's
business (`(sender_member_user_id, business_id)` →
`memberships(user_id, business_id)`) — a sender can't be spoofed into
the wrong conversation or the wrong business even by trusted-looking
service-role code with a bug.

### `conversations.last_message_*` is trigger-owned, with an explicit concurrency fix

`private.update_conversation_last_message()` keeps
`last_message_at`/`last_message_sequence`/`last_message_preview`
tracking the message with the maximum `(provider_sent_at, sequence)`
tuple. A cheap conditional `UPDATE` (fast path) handles the common
case. The slow path only runs when an `UPDATE` on `messages` moves
*the row that was currently cached as leader* backward in time; under
`READ COMMITTED`, recomputing "what's actually latest" without care
here can race a concurrent `INSERT` of a genuinely newer message and
overwrite it with stale data. The fix: the slow path takes an explicit
`SELECT ... FOR UPDATE` on the `conversations` row before recomputing,
re-checks (under that lock) whether the edited row is still the cached
leader, and — only if so — recomputes from a fresh scan of `messages`
and writes it back under the same non-regression predicate the fast
path uses. `tests/rls/verify-rls-conversations.mjs` exercises this
with two genuinely concurrent connections and — as a sanity check
during implementation — was confirmed to fail against a
deliberately-unlocked version of the trigger, so the row lock is doing
real work, not just documenting an assumption.

### Identity resolution is an ingestion-worker algorithm, not a stored procedure

`customer_identities` maps a normalized external identity value (e.g.
a lowercased email, an E.164 phone number) to a `customer_id` on a
given `channel_connection_id`, `UNIQUE (channel_connection_id,
external_identity_value)`. The race-safe resolution algorithm
(normalize → `pg_advisory_xact_lock(hashtextextended(channel_connection_id
|| ':' || normalized_value, 0))` → re-query → reuse-or-create
`Customer` + `CustomerIdentity`) is documented for future ingestion
workers to follow — there is no ingestion worker in this repository
yet (explicitly out of scope; see below), so nothing calls it. The
primitive itself (advisory lock + uniqueness constraint) is verified
directly in `tests/rls/verify-rls-conversations.mjs` by running two
concurrent `service_role` sessions through the algorithm by hand.

### Bidirectional keyset pagination over `(provider_sent_at, sequence)`

`listMessages` in `lib/conversations/queries.ts` supports
`direction: 'before'` (historical, descending, strictly older than the
cursor) and `direction: 'after'` (forward-tailing, ascending, strictly
newer). The strict tuple comparison is expressed through PostgREST's
`or()` as `a < x OR (a = x AND b < y)` (or `>`/`>` for `after`), backed
by `messages_conversation_display_idx (conversation_id,
provider_sent_at, sequence)`. `listConversations` uses a simpler
single-column keyset over `last_message_at`
(`conversations_business_last_message_idx`), since the design left its
exact pagination shape open — this is an implementation choice within
the module, not part of the authoritative design's `§19` interface.

### What's deliberately not here

Outbox/pending-send queues, provider send APIs, ingestion workers,
webhooks, Gmail OAuth, AI processing, opportunity scoring, CRM stages,
attachment storage, and multi-participant thread engines are all
future-module work. No UI was built for these tables in this module —
Module 3A is schema, TypeScript contracts
(`lib/conversations/types.ts`), and the read/limited-update query
layer only.

## Module boundaries

Later modules build on the contracts above rather than bypassing them:

- Business/workspace and membership (Module 2B) is a resolution step
  layered on top of `AuthenticatedUser`, not a change to it.
- Any code acting on a signed-in user's behalf goes through
  `lib/db/supabase/server.ts`. Reaching for `admin.ts` to "make RLS go
  away" for ordinary user-facing code is a reversal of this decision,
  not an extension of it.
- Customer/conversation/channel data (Module 3A) is business-scoped
  data that lives *inside* the tenant boundary Module 2B built, using
  the same `private.is_member_of` / `private.is_business_admin`
  pattern — no new authorization scheme. Later modules (ingestion,
  outbox, AI, CRM, scoring) build on Module 3A's five tables and
  trust boundary rather than adding parallel ones; in particular,
  nothing outside trusted `service_role` ingestion code should ever
  gain a client-facing path to `INSERT`/`UPDATE` `messages` or
  `INSERT` `customer_identities` — that boundary is intentional, not
  a gap to "fix" later.
- Member management (invitations, role changes, removal) was left
  unimplemented on purpose — `memberships` has no client-facing
  `INSERT`/`UPDATE`/`DELETE` policy at all yet. Building that means
  adding narrowly-scoped policies (e.g. "an admin can insert a
  membership for a specific invited user"), not opening the table up
  broadly.
