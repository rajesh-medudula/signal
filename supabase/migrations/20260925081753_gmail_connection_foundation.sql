-- Module 4: Gmail OAuth connection lifecycle — credential storage.
--
-- Reuses Module 2B/3A's tenant boundary and channel_connections table
-- as-is (private.is_member_of / private.is_business_admin,
-- requireBusinessAccess/requireBusinessAdmin at the application layer,
-- channel_connections' existing RLS policies) — no second tenant
-- mechanism, no generic credentials table, no new channel-management
-- subsystem. See docs/architecture.md and the Module 4 specification
-- for the full rationale.
--
-- This migration adds exactly one new table plus one trusted-backend
-- persistence function:
--
--   public.gmail_connection_credentials
--     The encrypted Gmail refresh-token record for one
--     channel_connections row. RLS enabled AND forced, with NO
--     policies at all for `authenticated`/`anon` (default-deny for
--     every operation) and an explicit REVOKE of table-level grants
--     as a statement-level backstop — the same defense-in-depth
--     pattern Module 3A already uses for `messages` and
--     `customer_identities`. Only `service_role` (application code
--     behind lib/channels/gmail/credentials.ts, itself gated on
--     requireBusinessAdmin() having already run) can read or write
--     this table. The stored value is ciphertext produced by
--     application-level AES-256-GCM — this table is a second layer of
--     defense on top of that encryption, not a substitute for it.
--
--   public.persist_gmail_connection(...)
--     The only trusted Module 4 path for establishing a *verified*
--     Gmail connection: it upserts a channel_connections row and its
--     gmail_connection_credentials row together, so a call through
--     this function never leaves a `connected` channel_connections row
--     without a credential (or vice versa) — see item 6 and item 37 of
--     the module specification. SECURITY DEFINER, callable only by
--     service_role (never authenticated/anon); application code only
--     reaches it after full OAuth + Google identity + Gmail mailbox
--     verification succeeds.
--
--     This does NOT change Module 3A's existing
--     "admins can create/update channel connections" policies — an
--     authenticated business admin can still INSERT/UPDATE
--     channel_connections directly (including setting
--     status = 'connected') through the ordinary Data API, exactly as
--     Module 3A already allowed, and this migration deliberately does
--     not touch that. What this function guarantees is narrower and
--     still sufficient: it is the only thing that can make a
--     `connected` row and a real, decryptable credential exist
--     together, so a row created or edited outside it is never treated
--     as a working connection anywhere it matters for correctness —
--     see lib/channels/gmail/queries.ts, which verifies that the stored
--     refresh token decrypts successfully before showing a
--     `connected`-looking row to a user as "Connected".
--
-- Explicitly NOT in this migration: Gmail message/thread/history
-- tables, an OAuth-attempt table, access-token storage, generic
-- provider-credential abstraction, AI/CRM/scoring state. See the
-- Module 4 specification, sections 4, 19, 48, 77-80.

-- ---------------------------------------------------------------------
-- gmail_connection_credentials
-- ---------------------------------------------------------------------
create table public.gmail_connection_credentials (
  channel_connection_id uuid primary key,
  business_id uuid not null,
  refresh_token_ciphertext text not null check (btrim(refresh_token_ciphertext) <> ''),
  encryption_key_version smallint not null default 1,
  granted_scopes text[] not null default '{}',
  authenticated_email text not null check (btrim(authenticated_email) <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (channel_connection_id, business_id)
    references public.channel_connections (id, business_id) on delete cascade
);

comment on table public.gmail_connection_credentials is
  'Encrypted Gmail refresh-token record for one channel_connections '
  'row (channel = ''gmail''). The composite foreign key guarantees a '
  'credential can never point at a connection belonging to another '
  'business. refresh_token_ciphertext is application-level '
  'AES-256-GCM ciphertext (see lib/channels/gmail/crypto.ts) — this '
  'table is never readable by authenticated/anon; only service_role, '
  'via lib/channels/gmail/credentials.ts, reads or writes it. '
  'access_token is deliberately not a column here — access tokens are '
  'ephemeral and are refreshed from the durable refresh token, never '
  'persisted (Module 4 spec, item 77).';

comment on column public.gmail_connection_credentials.authenticated_email is
  'The verified Gmail mailbox address from users.getProfile. Kept '
  'here (not just on channel_connections.display_label) so credential '
  '/connection reconciliation doesn''t depend on mutable, '
  'user-editable display text.';

comment on column public.gmail_connection_credentials.granted_scopes is
  'The actual OAuth scope set Google confirmed at token-exchange time '
  '— not inferred from what Signal requested. Lets a future module '
  'check for incremental-consent scopes (e.g. gmail.readonly) without '
  'assuming they were granted.';

create trigger gmail_connection_credentials_set_updated_at
  before update on public.gmail_connection_credentials
  for each row
  execute function private.set_updated_at();

-- No business_id-only index: the primary key on channel_connection_id
-- already covers the only real lookup pattern this module needs
-- (direct credential lookup by connection). Do not add an index this
-- module has no query pattern for (spec item 43).

-- ---------------------------------------------------------------------
-- RLS: gmail_connection_credentials — forced, zero policies.
--
-- Deliberately no SELECT/INSERT/UPDATE/DELETE policy for
-- `authenticated` or `anon` at all: with RLS enabled and forced and no
-- permissive policy for a given command, Postgres denies that command
-- outright for every role except the table owner and service_role
-- (which bypasses RLS by role attribute, not by any policy here).
-- ---------------------------------------------------------------------
alter table public.gmail_connection_credentials enable row level security;
alter table public.gmail_connection_credentials force row level security;

-- Statement-level backstop, same defense-in-depth pattern as Module
-- 3A's messages/customer_identities: even if this table's default
-- privileges ever granted authenticated/anon table-level access, an
-- explicit revoke closes that path independently of RLS.
revoke all on public.gmail_connection_credentials from authenticated, anon;

-- ---------------------------------------------------------------------
-- persist_gmail_connection: the only trusted Module 4 path for
-- establishing a verified Gmail connection. Module 3A's own
-- "admins can create/update channel connections" policies still let an
-- authenticated admin write channel_connections (including
-- status = 'connected') directly through the Data API, exactly as
-- before — this function's guarantee is narrower: only it can make a
-- `connected` row and a real credential exist together.
--
-- Upserts channel_connections (keyed by the existing
-- unique(business_id, channel, external_account_id) constraint) and
-- gmail_connection_credentials (keyed by the primary key) in a single
-- function call, so both writes commit or neither does.
--
-- Reconnect semantics (spec items 25, 84-87):
--   - display_label is set only when the row is first created; an
--     existing row's display_label is never overwritten here, so a
--     user-customized label survives reconnect even if Google returns
--     a different email address.
--   - p_refresh_token_ciphertext may be NULL, meaning "Google did not
--     return a new refresh token this time" — on an existing row the
--     prior ciphertext/key version are retained via COALESCE; on a
--     brand-new row this is impossible to satisfy (there is nothing
--     to fall back to), so the NOT NULL column constraint fails the
--     whole call and rolls back — the database-level backstop for
--     "no refresh token and no existing credential -> failure"
--     (application code in lib/channels/gmail/connection.ts already
--     checks this case explicitly beforehand for a clean user-facing
--     error, but the constraint is what actually enforces it).
--   - authenticated_email and granted_scopes always reflect the most
--     recently verified values.
--   - status is always set to 'connected' — this function is only
--     ever called after full OAuth + identity + mailbox verification
--     succeeds; it is never called for a failed attempt.
-- ---------------------------------------------------------------------
create or replace function public.persist_gmail_connection(
  p_business_id uuid,
  p_external_account_id text,
  p_display_label text,
  p_authenticated_email text,
  p_granted_scopes text[],
  p_refresh_token_ciphertext text,
  p_encryption_key_version smallint
)
returns table (result_channel_connection_id uuid, result_was_reconnect boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_existed boolean;
begin
  if p_business_id is null then
    raise exception 'persist_gmail_connection: business_id is required';
  end if;
  if p_external_account_id is null or btrim(p_external_account_id) = '' then
    raise exception 'persist_gmail_connection: external_account_id is required';
  end if;
  if p_display_label is null or btrim(p_display_label) = '' then
    raise exception 'persist_gmail_connection: display_label is required';
  end if;
  if p_authenticated_email is null or btrim(p_authenticated_email) = '' then
    raise exception 'persist_gmail_connection: authenticated_email is required';
  end if;

  select exists (
    select 1
    from public.channel_connections
    where business_id = p_business_id
      and channel = 'gmail'
      and external_account_id = p_external_account_id
  ) into v_existed;

  insert into public.channel_connections
    (business_id, channel, display_label, external_account_id, status)
  values
    (p_business_id, 'gmail', p_display_label, p_external_account_id, 'connected')
  on conflict (business_id, channel, external_account_id)
  do update set
    status = 'connected',
    updated_at = now()
  returning id into v_id;

  -- NOT a plain upsert: Postgres validates a candidate row's NOT NULL
  -- constraints before ON CONFLICT resolution even runs, so an
  -- `INSERT ... ON CONFLICT DO UPDATE` with a NULL
  -- refresh_token_ciphertext would fail even on the legitimate
  -- "reconnect without a new refresh token, keep the old one" path,
  -- before ever reaching the COALESCE that was meant to retain it.
  -- Branching explicitly on existence (locking the row first to
  -- serialize concurrent calls for the same connection) avoids that
  -- pitfall while preserving the same fail-closed guarantee: a brand
  -- new row with a NULL ciphertext still hits the column's NOT NULL
  -- constraint on the INSERT branch below and rolls back the whole
  -- call, including the channel_connections upsert above.
  perform 1
  from public.gmail_connection_credentials
  where channel_connection_id = v_id
  for update;

  if found then
    update public.gmail_connection_credentials
    set
      refresh_token_ciphertext = coalesce(
        p_refresh_token_ciphertext, refresh_token_ciphertext
      ),
      encryption_key_version = case
        when p_refresh_token_ciphertext is not null
          then coalesce(p_encryption_key_version, 1)
        else encryption_key_version
      end,
      granted_scopes = coalesce(p_granted_scopes, '{}'),
      authenticated_email = p_authenticated_email,
      updated_at = now()
    where channel_connection_id = v_id;
  else
    insert into public.gmail_connection_credentials
      (channel_connection_id, business_id, refresh_token_ciphertext,
       encryption_key_version, granted_scopes, authenticated_email)
    values
      (v_id, p_business_id, p_refresh_token_ciphertext,
       coalesce(p_encryption_key_version, 1), coalesce(p_granted_scopes, '{}'),
       p_authenticated_email);
  end if;

  return query select v_id, v_existed;
end;
$$;

comment on function public.persist_gmail_connection is
  'The only trusted Module 4 path for establishing a verified Gmail '
  'connection (a channel_connections row with a real credential behind '
  'it) — not the only way channel_connections itself can be written; '
  'Module 3A''s admin INSERT/UPDATE policies on that table are '
  'unchanged. Callable only by service_role — never authenticated or '
  'anon — and only ever invoked by lib/channels/gmail/credentials.ts '
  'after full OAuth + Google identity + Gmail mailbox verification has '
  'already succeeded in application code. See the Module 4 '
  'specification, items 6 and 37.';

revoke execute on function public.persist_gmail_connection(
  uuid, text, text, text, text[], text, smallint
) from public;
grant execute on function public.persist_gmail_connection(
  uuid, text, text, text, text[], text, smallint
) to service_role;

-- ---------------------------------------------------------------------
-- disconnect_gmail_connection: commit local disconnect state together.
-- Google revocation remains an application-layer, best-effort operation;
-- these two local writes either both commit or both roll back.
-- ---------------------------------------------------------------------
create or replace function public.disconnect_gmail_connection(
  p_business_id uuid,
  p_channel_connection_id uuid
)
returns table (result_disconnected boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  update public.channel_connections
  set status = 'disconnected'
  where id = p_channel_connection_id
    and business_id = p_business_id
    and channel = 'gmail'
  returning id into v_id;

  if v_id is null then
    return query select false;
    return;
  end if;

  delete from public.gmail_connection_credentials
  where channel_connection_id = v_id;

  return query select true;
end;
$$;

comment on function public.disconnect_gmail_connection(uuid, uuid) is
  'Atomically marks one business-scoped Gmail channel connection as '
  'disconnected and removes its encrypted credential. Google token '
  'revocation is best-effort and happens in the application layer.';

revoke execute on function public.disconnect_gmail_connection(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.disconnect_gmail_connection(uuid, uuid) to service_role;
