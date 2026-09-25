-- Module 3A: Customer / Conversation / Message foundation.
--
-- Reuses Module 2B's tenant boundary as-is (private.is_member_of /
-- private.is_business_admin, requireBusinessAccess/requireBusinessAdmin
-- at the application layer) — no second tenant mechanism is introduced.
-- Every table below is business-scoped with a direct, non-null
-- business_id column, forced RLS, and database-enforced tenant- and
-- domain-consistent foreign keys. See docs/architecture.md for the
-- full rationale.
--
-- Trust boundary this migration hard-codes at the database level:
--   - `authenticated` (ordinary client requests): can view business
--     data and edit a narrow, explicitly column-granted set of
--     customer/conversation/channel-connection metadata. Cannot ever
--     create or update canonical `messages`, and cannot create
--     `customer_identities`.
--   - `service_role` (trusted backend ingestion/integration
--     infrastructure): bypasses RLS entirely and is the only path that
--     persists provider-confirmed `messages` and `customer_identities`.
--
-- Explicitly out of scope here (see docs/architecture.md and
-- prd.md's module list): outbox/pending-send queues, provider send
-- APIs, ingestion workers, webhooks, Gmail OAuth, AI processing,
-- opportunity scoring, CRM stages, attachment storage, and
-- multi-participant thread engines.

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
create type public.channel_connection_status as enum
  ('connected', 'disconnected', 'error');

create type public.conversation_status as enum
  ('open', 'closed', 'archived');

create type public.message_direction as enum
  ('inbound', 'outbound');

create type public.message_sender_type as enum
  ('customer', 'business_member', 'system');

-- ---------------------------------------------------------------------
-- channel_connections
--
-- A business's connection to one external channel account (e.g. one
-- Gmail mailbox, one WhatsApp Business number). `channel` stays `text`
-- at the database layer — the strongly-typed `ChannelType` union lives
-- only in the application contract (lib/channels/types.ts) so adding a
-- channel never requires a migration to widen an enum.
-- ---------------------------------------------------------------------
create table public.channel_connections (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  channel text not null,
  display_label text not null,
  external_account_id text not null,
  status public.channel_connection_status not null default 'connected',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, channel, external_account_id),
  unique (id, business_id)
);

comment on table public.channel_connections is
  'A business''s connection to one external channel account. '
  'id/business_id/channel/external_account_id are immutable after '
  'insert; only display_label and status are client-editable, and only '
  'by a business admin/owner.';

create trigger channel_connections_set_updated_at
  before update of display_label, status
  on public.channel_connections
  for each row
  execute function private.set_updated_at();

-- ---------------------------------------------------------------------
-- customers
--
-- primary_email/primary_phone are display/lookup conveniences, not
-- unique identity keys — actual external-channel identity mapping
-- lives in customer_identities below.
-- ---------------------------------------------------------------------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  display_name text,
  primary_email text,
  primary_phone text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, business_id)
);

comment on table public.customers is
  'A business''s customer. primary_email/primary_phone are display '
  'conveniences only, not unique identity keys — see '
  'customer_identities for verified external-channel identity mapping.';

create trigger customers_set_updated_at
  before update of display_name, primary_email, primary_phone, metadata
  on public.customers
  for each row
  execute function private.set_updated_at();

-- ---------------------------------------------------------------------
-- customer_identities
--
-- A verified external identity handle (e.g. a specific email address
-- or WhatsApp E.164 phone number) observed during provider channel
-- ingestion. Trusted ingestion data only — no `channel` column, since
-- channel type is fully derivable from channel_connection_id.
-- ---------------------------------------------------------------------
create table public.customer_identities (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  customer_id uuid not null,
  channel_connection_id uuid not null,
  external_identity_value text not null,
  created_at timestamptz not null default now(),
  foreign key (customer_id, business_id)
    references public.customers (id, business_id) on delete cascade,
  foreign key (channel_connection_id, business_id)
    references public.channel_connections (id, business_id) on delete restrict,
  unique (channel_connection_id, external_identity_value),
  unique (id, business_id)
);

comment on table public.customer_identities is
  'Trusted ingestion data: a verified external identity handle for a '
  'customer on a specific channel connection. Rows are created '
  'exclusively by trusted backend infrastructure (service_role) — '
  'see the race-safe resolution algorithm in docs/architecture.md. '
  'Ordinary authenticated members have SELECT-only access.';

-- ---------------------------------------------------------------------
-- conversations
--
-- Strictly 1:1: a Conversation is a single thread between the
-- workspace and one Customer. last_message_* are denormalized summary
-- fields maintained exclusively by the trigger below.
-- ---------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  customer_id uuid not null,
  channel_connection_id uuid not null,
  external_conversation_id text not null,
  subject text,
  status public.conversation_status not null default 'open',
  last_message_at timestamptz,
  last_message_sequence bigint,
  last_message_preview text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (business_id) references public.businesses (id) on delete cascade,
  foreign key (customer_id, business_id)
    references public.customers (id, business_id) on delete restrict,
  foreign key (channel_connection_id, business_id)
    references public.channel_connections (id, business_id) on delete restrict,
  unique (id, business_id),
  unique (id, business_id, channel_connection_id),
  unique (id, business_id, customer_id),
  unique (channel_connection_id, external_conversation_id)
);

comment on table public.conversations is
  'A strictly 1:1 thread between the workspace and one customer on one '
  'channel connection. UNIQUE (channel_connection_id, '
  'external_conversation_id) prevents a single external thread from '
  'being split across multiple conversation rows — see the '
  'multi-participant bounded rule in docs/architecture.md. '
  'last_message_* are trigger-owned; clients may only edit subject '
  'and status.';

-- ---------------------------------------------------------------------
-- messages
--
-- Canonical, provider-confirmed historical events only.
-- external_message_id is NOT NULL — there is no "pending/unconfirmed
-- outbound" state on this table; that is explicitly future outbox-
-- module work.
-- ---------------------------------------------------------------------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  conversation_id uuid not null,
  channel_connection_id uuid not null,
  external_message_id text not null,
  direction public.message_direction not null,
  sender_type public.message_sender_type not null,
  sender_customer_id uuid,
  sender_member_user_id uuid,
  body text not null,
  content_type text not null default 'text/plain',
  attachments jsonb not null default '[]'::jsonb,
  provider_metadata jsonb not null default '{}'::jsonb,
  provider_sent_at timestamptz not null,
  created_at timestamptz not null default now(),
  sequence bigint generated always as identity,
  foreign key (conversation_id, business_id)
    references public.conversations (id, business_id) on delete cascade,
  foreign key (sender_member_user_id, business_id)
    references public.memberships (user_id, business_id) on delete restrict,
  foreign key (conversation_id, business_id, channel_connection_id)
    references public.conversations (id, business_id, channel_connection_id) on delete cascade,
  foreign key (conversation_id, business_id, sender_customer_id)
    references public.conversations (id, business_id, customer_id) on delete cascade,
  unique (channel_connection_id, external_message_id),
  check (
    (sender_type = 'customer' and sender_customer_id is not null and sender_member_user_id is null and direction = 'inbound') or
    (sender_type = 'business_member' and sender_member_user_id is not null and sender_customer_id is null and direction = 'outbound') or
    (sender_type = 'system' and sender_customer_id is null and sender_member_user_id is null and direction = 'outbound')
  )
);

comment on table public.messages is
  'Canonical, provider-confirmed historical messages only — never a '
  'client-facing outbox. external_message_id is NOT NULL, backed by '
  'UNIQUE (channel_connection_id, external_message_id), so there is no '
  'unconfirmed/pending state mixed into canonical history. Created and '
  'updated exclusively by trusted backend infrastructure '
  '(service_role) — authenticated has zero INSERT/UPDATE access, '
  'enforced by both privilege revocation and the absence of a '
  'permissive RLS policy.';

-- ---------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------
create index customers_business_id_idx on public.customers (business_id);

create index customer_identities_customer_id_idx
  on public.customer_identities (customer_id);

create index channel_connections_business_id_idx
  on public.channel_connections (business_id);

create index conversations_business_id_idx on public.conversations (business_id);
create index conversations_customer_id_idx on public.conversations (customer_id);
create index conversations_business_last_message_idx
  on public.conversations (business_id, last_message_at desc);

create index messages_business_id_idx on public.messages (business_id);

create index messages_conversation_display_idx
  on public.messages (conversation_id, provider_sent_at, sequence);

-- ---------------------------------------------------------------------
-- Trigger function: concurrency-corrected last_message_* maintenance
--
-- Keeps conversations.last_message_{at,sequence,preview} reflecting
-- the message with the maximum (provider_sent_at, sequence) tuple.
--
-- Fast path: a single conditional UPDATE that only wins if the new/
-- edited row is already >= the cached leader (INSERT) or >= it
-- (UPDATE's fast path uses >= so an edit that keeps the row as leader
-- still refreshes the preview/timestamp).
--
-- Slow path (UPDATE only, when the fast path affects zero rows — i.e.
-- an edit moved what *was* the cached leader backward in time under
-- READ COMMITTED): explicitly locks the conversations row with
-- `FOR UPDATE` before recomputing, so a concurrent transaction
-- inserting a genuinely newer message cannot have its cached state
-- overwritten by this transaction's stale backward-looking recompute.
-- After acquiring the lock we re-check whether the edited row was
-- actually the cached leader (another concurrent slow path may have
-- already corrected it), recompute the true latest message by
-- scanning messages for this conversation, and apply the recomputed
-- value only under the same non-regression predicate the fast path
-- uses. See docs/architecture.md for the full race walkthrough.
-- ---------------------------------------------------------------------
create or replace function private.update_conversation_last_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  was_cached_leader boolean;
  latest record;
begin
  if tg_op = 'INSERT' then
    update public.conversations
    set last_message_at = new.provider_sent_at,
        last_message_sequence = new.sequence,
        last_message_preview = left(new.body, 200),
        updated_at = now()
    where id = new.conversation_id
      and (
        last_message_sequence is null
        or (new.provider_sent_at, new.sequence) > (last_message_at, last_message_sequence)
      );
    return new;
  end if;

  -- Fast path for UPDATE
  update public.conversations
  set last_message_at = new.provider_sent_at,
      last_message_sequence = new.sequence,
      last_message_preview = left(new.body, 200),
      updated_at = now()
  where id = new.conversation_id
    and (
      last_message_sequence is null
      or (new.provider_sent_at, new.sequence) >= (last_message_at, last_message_sequence)
    );

  if found then
    return new;
  end if;

  -- Slow Path: Explicit row lock on conversation to serialize concurrent trigger execution
  perform 1
  from public.conversations
  where id = new.conversation_id
  for update;

  select (last_message_sequence = old.sequence)
  into was_cached_leader
  from public.conversations
  where id = new.conversation_id;

  if was_cached_leader then
    select provider_sent_at, sequence, body
    into latest
    from public.messages
    where conversation_id = new.conversation_id
    order by provider_sent_at desc, sequence desc
    limit 1;

    if latest is not null then
      update public.conversations
      set last_message_at = latest.provider_sent_at,
          last_message_sequence = latest.sequence,
          last_message_preview = left(latest.body, 200),
          updated_at = now()
      where id = new.conversation_id
        and (
          last_message_sequence is null
          or (latest.provider_sent_at, latest.sequence) >= (last_message_at, last_message_sequence)
        );
    end if;
  end if;

  return new;
end;
$$;

create trigger messages_update_conversation_last_message
  after insert or update of provider_sent_at, body on public.messages
  for each row
  execute function private.update_conversation_last_message();

-- ---------------------------------------------------------------------
-- Triggers for updated_at (reuses private.set_updated_at() from the
-- Module 2B migration — not redefined here)
-- ---------------------------------------------------------------------
create trigger conversations_set_updated_at
  before update of subject, status on public.conversations
  for each row
  execute function private.set_updated_at();

-- ---------------------------------------------------------------------
-- RLS: channel_connections
-- ---------------------------------------------------------------------
alter table public.channel_connections enable row level security;
alter table public.channel_connections force row level security;

create policy "members can view their business's channel connections"
  on public.channel_connections for select to authenticated
  using (private.is_member_of(business_id));

create policy "admins can create channel connections"
  on public.channel_connections for insert to authenticated
  with check (private.is_business_admin(business_id));

create policy "admins can update channel connections"
  on public.channel_connections for update to authenticated
  using (private.is_business_admin(business_id))
  with check (private.is_business_admin(business_id));

-- No DELETE policy for authenticated: default deny.

-- ---------------------------------------------------------------------
-- RLS: customers
-- ---------------------------------------------------------------------
alter table public.customers enable row level security;
alter table public.customers force row level security;

create policy "members can view their business's customers"
  on public.customers for select to authenticated
  using (private.is_member_of(business_id));

create policy "members can create customers"
  on public.customers for insert to authenticated
  with check (private.is_member_of(business_id));

create policy "members can update customers"
  on public.customers for update to authenticated
  using (private.is_member_of(business_id))
  with check (private.is_member_of(business_id));

-- No DELETE policy for authenticated: default deny.

-- ---------------------------------------------------------------------
-- RLS: customer_identities
-- ---------------------------------------------------------------------
alter table public.customer_identities enable row level security;
alter table public.customer_identities force row level security;

create policy "members can view their business's customer identities"
  on public.customer_identities for select to authenticated
  using (private.is_member_of(business_id));

-- NO INSERT policy for authenticated on customer_identities
-- NO UPDATE policy for authenticated on customer_identities
-- NO DELETE policy for authenticated on customer_identities

-- ---------------------------------------------------------------------
-- RLS: conversations
-- ---------------------------------------------------------------------
alter table public.conversations enable row level security;
alter table public.conversations force row level security;

create policy "members can view their business's conversations"
  on public.conversations for select to authenticated
  using (private.is_member_of(business_id));

create policy "members can create conversations"
  on public.conversations for insert to authenticated
  with check (private.is_member_of(business_id));

create policy "members can update conversations"
  on public.conversations for update to authenticated
  using (private.is_member_of(business_id))
  with check (private.is_member_of(business_id));

-- No DELETE policy for authenticated: default deny.

-- ---------------------------------------------------------------------
-- RLS: messages
-- ---------------------------------------------------------------------
alter table public.messages enable row level security;
alter table public.messages force row level security;

create policy "members can view their business's messages"
  on public.messages for select to authenticated
  using (private.is_member_of(business_id));

-- NO INSERT policy for authenticated on messages
-- NO UPDATE policy for authenticated on messages
-- NO DELETE policy for authenticated on messages

-- ---------------------------------------------------------------------
-- Explicit privilege revocations & column-level privilege restrictions
--
-- RLS policies above are the row-level backstop; these SQL-privilege
-- statements are the column/statement-level backstop, and are what
-- make the messages/customer_identities trust boundary absolute
-- (default table-level privileges granted to `authenticated` by this
-- database's default-privileges setup would otherwise permit INSERT/
-- UPDATE/DELETE attempts that RLS alone would merely filter to zero
-- rows).
-- ---------------------------------------------------------------------
revoke insert, update, delete on public.messages from authenticated;
revoke insert, update, delete on public.customer_identities from authenticated;

revoke update on public.conversations from authenticated;
grant update (subject, status) on public.conversations to authenticated;

revoke update on public.customers from authenticated;
grant update (
  display_name, primary_email, primary_phone, metadata
) on public.customers to authenticated;

revoke update on public.channel_connections from authenticated;
grant update (display_label, status) on public.channel_connections to authenticated;

-- customers, conversations, and channel_connections have no DELETE
-- policy above (and none is granted here) — DELETE is denied for
-- authenticated on all five Module 3A tables via RLS's default-deny
-- for any operation with no permissive policy, the same pattern
-- Module 2B's businesses/memberships tables already rely on.
