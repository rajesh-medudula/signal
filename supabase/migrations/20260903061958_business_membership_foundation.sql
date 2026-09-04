-- Module 2B: business/workspace + membership tenant foundation.
--
-- Tenant model implemented here:
--   auth.users -> memberships -> businesses
-- A user has zero or more memberships; each membership ties one user to
-- one business with one role. This intentionally supports both
-- "one user, many businesses" and "one business, many users" — see
-- docs/architecture.md for the full rationale.

-- ---------------------------------------------------------------------
-- Schema for internal helper functions that must not be callable
-- directly by client roles (they're building blocks for RLS policies,
-- not a public API). Nothing in this schema is exposed via the Data API.
-- ---------------------------------------------------------------------
create schema if not exists private;

-- ---------------------------------------------------------------------
-- businesses
-- ---------------------------------------------------------------------
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.businesses is
  'The tenant root. One row per business/workspace. Ownership is established '
  'exclusively through public.onboard_business() — there is no client-facing '
  'INSERT policy, so a browser can never assert "I own this business" directly.';

create or replace function private.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger businesses_set_updated_at
  before update on public.businesses
  for each row
  execute function private.set_updated_at();

-- ---------------------------------------------------------------------
-- memberships
-- ---------------------------------------------------------------------
create type public.membership_role as enum ('owner', 'admin', 'member');

comment on type public.membership_role is
  'owner: full business administration. admin: business-level administration '
  'appropriate to the current product stage (same practical authority as '
  'owner today; kept distinct so finer-grained limits can be added later '
  'without a data migration). member: regular business access, no '
  'administrative actions.';

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  role public.membership_role not null default 'member',
  created_at timestamptz not null default now(),
  -- A user can only have one membership row per business. This is the
  -- database-enforced version of "no accidental duplicate/conflicting
  -- membership for the same (user, business) pair" — see item 9 of the
  -- module spec.
  unique (user_id, business_id)
);

comment on table public.memberships is
  'The user <-> business relationship, with the role that governs it. '
  'Security-sensitive: there is no client-facing INSERT/UPDATE/DELETE '
  'policy. Rows are created only by public.onboard_business() (initial '
  'owner membership); granting/changing roles for additional members is '
  'future-module work (invitations), not implemented here.';

-- The unique constraint above already indexes (user_id, business_id),
-- which covers user_id-only lookups via the leftmost-column rule, but
-- business_id-only lookups (e.g. "who is on this business") need their
-- own index.
create index memberships_business_id_idx on public.memberships (business_id);

-- ---------------------------------------------------------------------
-- RLS helper functions
--
-- Policies below deliberately do NOT reference public.memberships
-- directly inside a policy on public.memberships itself (or a policy
-- that would trigger it recursively) — instead they call these
-- SECURITY DEFINER helpers, which read the table once, directly,
-- bypassing RLS internally. This avoids the recursive-RLS trap and
-- keeps each policy a cheap indexed lookup rather than a correlated
-- subquery re-entering RLS evaluation.
--
-- Each function hard-codes `user_id = (select auth.uid())` internally,
-- not a caller-supplied user id, so it can never be used to check
-- someone else's access.
-- ---------------------------------------------------------------------
create or replace function private.is_member_of(target_business_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships
    where business_id = target_business_id
      and user_id = (select auth.uid())
  );
$$;

create or replace function private.is_business_admin(target_business_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships
    where business_id = target_business_id
      and user_id = (select auth.uid())
      and role in ('owner', 'admin')
  );
$$;

-- Functions get an automatic EXECUTE grant to PUBLIC on creation;
-- revoke that and grant only to the role that needs it. anon and
-- service_role never need to call these (anon isn't a member of
-- anything; service_role already bypasses RLS entirely).
revoke execute on function private.is_member_of(uuid) from public;
revoke execute on function private.is_business_admin(uuid) from public;
grant execute on function private.is_member_of(uuid) to authenticated;
grant execute on function private.is_business_admin(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- RLS: businesses
-- ---------------------------------------------------------------------
alter table public.businesses enable row level security;
alter table public.businesses force row level security;

create policy "members can view their business"
on public.businesses
for select
to authenticated
using (private.is_member_of(id));

create policy "admins can update their business"
on public.businesses
for update
to authenticated
using (private.is_business_admin(id))
with check (private.is_business_admin(id));

-- No INSERT or DELETE policy for authenticated/anon: both default to
-- deny. Business creation happens only through
-- public.onboard_business() (SECURITY DEFINER, below). Deletion isn't
-- implemented in this module at all (see docs/architecture.md).

-- ---------------------------------------------------------------------
-- RLS: memberships
-- ---------------------------------------------------------------------
alter table public.memberships enable row level security;
alter table public.memberships force row level security;

create policy "members can view memberships in their business"
on public.memberships
for select
to authenticated
using (private.is_member_of(business_id));

-- No INSERT, UPDATE, or DELETE policy for authenticated/anon: all
-- default to deny. This is intentional and important — see item 20 of
-- the module spec:
--   - a user cannot insert a membership row connecting themselves to
--     an arbitrary business
--   - a member cannot promote themselves (or anyone) to owner/admin
--   - nobody can remove another member's access from the client
-- The only way a membership row is created is public.onboard_business()
-- creating the initial owner membership. Managing additional members
-- (invitations, role changes, removal) is future-module work.

-- ---------------------------------------------------------------------
-- Onboarding: create the initial business + owner membership together.
--
-- SECURITY DEFINER so it can perform both inserts despite neither table
-- having a client-facing INSERT policy — but every value it writes is
-- either caller-fixed (auth.uid(), role = 'owner') or validated, so it
-- can't be used to spoof ownership of an arbitrary business or grant an
-- arbitrary role. Runs as a single statement, so if the membership
-- insert fails after the business insert (e.g. an unexpected
-- constraint violation), Postgres rolls back the whole call — no
-- business can be left ownerless.
--
-- Idempotent by design: an advisory lock keyed on the caller serializes
-- concurrent calls from the same user, and a caller who already has a
-- membership gets their existing business back instead of a new one.
-- This covers the realistic retry cases (double submit, refresh after
-- success, resubmitting a stale form) without a general-purpose
-- idempotency framework — see docs/architecture.md.
-- ---------------------------------------------------------------------
create or replace function public.onboard_business(business_name text)
returns public.businesses
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  existing_business_id uuid;
  result public.businesses;
begin
  if caller is null then
    raise exception 'not authenticated';
  end if;

  if business_name is null or length(btrim(business_name)) = 0 then
    raise exception 'business name is required';
  end if;

  perform pg_advisory_xact_lock(hashtext('onboard_business:' || caller::text));

  select business_id
  into existing_business_id
  from public.memberships
  where user_id = caller
  order by created_at asc
  limit 1;

  if existing_business_id is not null then
    select * into result from public.businesses where id = existing_business_id;
    return result;
  end if;

  insert into public.businesses (name)
  values (btrim(business_name))
  returning * into result;

  insert into public.memberships (user_id, business_id, role)
  values (caller, result.id, 'owner');

  return result;
end;
$$;

revoke execute on function public.onboard_business(text) from public;
grant execute on function public.onboard_business(text) to authenticated;
