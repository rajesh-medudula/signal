import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ChannelConnection,
  Customer,
  Conversation,
  ConversationStatus,
  Message,
  MessageAttachment,
  UpdatableChannelConnectionFields,
  UpdatableCustomerFields,
  UpdatableConversationFields,
} from "./types";

/**
 * Every query below runs on the caller-supplied `supabase` client — in
 * practice always the authenticated (RLS-respecting) server client, per
 * lib/db/supabase/server.ts. Nothing here uses the service-role client;
 * canonical `messages` and `customer_identities` writes are trusted-
 * backend territory outside this module's scope (see
 * docs/architecture.md).
 *
 * Every read/write also filters explicitly by `businessId` as defense
 * in depth, even though RLS (`private.is_member_of`) already scopes
 * every row to the caller's business — the same pattern
 * lib/business/queries.ts uses.
 */

// ---------------------------------------------------------------------
// Row shapes (snake_case, as returned by PostgREST) + mappers
// ---------------------------------------------------------------------

interface CustomerRow {
  id: string;
  business_id: string;
  display_name: string | null;
  primary_email: string | null;
  primary_phone: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

function toCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    businessId: row.business_id,
    displayName: row.display_name,
    primaryEmail: row.primary_email,
    primaryPhone: row.primary_phone,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface ChannelConnectionRow {
  id: string;
  business_id: string;
  channel: string;
  display_label: string;
  external_account_id: string;
  status: ChannelConnection["status"];
  created_at: string;
  updated_at: string;
}

function toChannelConnection(row: ChannelConnectionRow): ChannelConnection {
  return {
    id: row.id,
    businessId: row.business_id,
    // The database column is `text`; the domain contract narrows it to
    // `ChannelType`. Widening the enum of supported channels is an
    // application-layer change, not a schema one — see
    // lib/channels/types.ts.
    channel: row.channel as ChannelConnection["channel"],
    displayLabel: row.display_label,
    externalAccountId: row.external_account_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface ConversationRow {
  id: string;
  business_id: string;
  customer_id: string;
  channel_connection_id: string;
  external_conversation_id: string;
  subject: string | null;
  status: ConversationStatus;
  last_message_at: string | null;
  last_message_sequence: string | number | null;
  last_message_preview: string | null;
  created_at: string;
  updated_at: string;
}

function toConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    businessId: row.business_id,
    customerId: row.customer_id,
    channelConnectionId: row.channel_connection_id,
    externalConversationId: row.external_conversation_id,
    subject: row.subject,
    status: row.status,
    lastMessageAt: row.last_message_at,
    // bigint at the PostgreSQL/PostgREST boundary — always normalized
    // to a string here so callers never touch a raw JS number that
    // could have lost precision in transit.
    lastMessageSequence:
      row.last_message_sequence === null ? null : String(row.last_message_sequence),
    lastMessagePreview: row.last_message_preview,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface MessageRow {
  id: string;
  business_id: string;
  conversation_id: string;
  channel_connection_id: string;
  external_message_id: string;
  direction: Message["direction"];
  sender_type: Message["senderType"];
  sender_customer_id: string | null;
  sender_member_user_id: string | null;
  body: string;
  content_type: string;
  attachments: MessageAttachment[];
  provider_metadata: Record<string, unknown>;
  provider_sent_at: string;
  created_at: string;
  sequence: string | number;
}

function toMessage(row: MessageRow): Message {
  return {
    id: row.id,
    businessId: row.business_id,
    conversationId: row.conversation_id,
    channelConnectionId: row.channel_connection_id,
    externalMessageId: row.external_message_id,
    direction: row.direction,
    senderType: row.sender_type,
    senderCustomerId: row.sender_customer_id,
    senderMemberUserId: row.sender_member_user_id,
    body: row.body,
    contentType: row.content_type,
    attachments: row.attachments,
    providerMetadata: row.provider_metadata,
    providerSentAt: row.provider_sent_at,
    createdAt: row.created_at,
    // bigint identity column — always normalized to a string, same
    // reasoning as `lastMessageSequence` above.
    sequence: String(row.sequence),
  };
}

const CUSTOMER_COLUMNS =
  "id, business_id, display_name, primary_email, primary_phone, metadata, created_at, updated_at";
const CHANNEL_CONNECTION_COLUMNS =
  "id, business_id, channel, display_label, external_account_id, status, created_at, updated_at";
const CONVERSATION_COLUMNS =
  "id, business_id, customer_id, channel_connection_id, external_conversation_id, subject, status, last_message_at, last_message_sequence, last_message_preview, created_at, updated_at";
const MESSAGE_COLUMNS =
  "id, business_id, conversation_id, channel_connection_id, external_message_id, direction, sender_type, sender_customer_id, sender_member_user_id, body, content_type, attachments, provider_metadata, provider_sent_at, created_at, sequence";

// ---------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------

export async function listCustomers(
  supabase: SupabaseClient,
  businessId: string,
): Promise<Customer[]> {
  const { data, error } = await supabase
    .from("customers")
    .select(CUSTOMER_COLUMNS)
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .returns<CustomerRow[]>();

  if (error) {
    throw new Error(`Failed to load customers: ${error.message}`);
  }

  return (data ?? []).map(toCustomer);
}

export async function getCustomer(
  supabase: SupabaseClient,
  businessId: string,
  customerId: string,
): Promise<Customer | null> {
  const { data, error } = await supabase
    .from("customers")
    .select(CUSTOMER_COLUMNS)
    .eq("business_id", businessId)
    .eq("id", customerId)
    .maybeSingle()
    .returns<CustomerRow>();

  if (error) {
    throw new Error(`Failed to load customer: ${error.message}`);
  }

  return data ? toCustomer(data) : null;
}

/**
 * Updates only the columns Module 3A grants `authenticated` UPDATE on
 * (`display_name`, `primary_email`, `primary_phone`, `metadata` — see
 * the migration's column-level GRANT). There is no generic/unrestricted
 * update helper: callers can only ever pass
 * `UpdatableCustomerFields`, so there is no code path that could widen
 * this beyond what the database privileges already allow.
 */
export async function updateCustomerDetails(
  supabase: SupabaseClient,
  businessId: string,
  customerId: string,
  fields: Partial<UpdatableCustomerFields>,
): Promise<Customer> {
  const patch: Record<string, unknown> = {};
  if (fields.displayName !== undefined) patch.display_name = fields.displayName;
  if (fields.primaryEmail !== undefined) patch.primary_email = fields.primaryEmail;
  if (fields.primaryPhone !== undefined) patch.primary_phone = fields.primaryPhone;
  if (fields.metadata !== undefined) patch.metadata = fields.metadata;

  const { data, error } = await supabase
    .from("customers")
    .update(patch)
    .eq("business_id", businessId)
    .eq("id", customerId)
    .select(CUSTOMER_COLUMNS)
    .single()
    .returns<CustomerRow>();

  if (error) {
    throw new Error(`Failed to update customer: ${error.message}`);
  }

  return toCustomer(data);
}

// ---------------------------------------------------------------------
// Channel connections
// ---------------------------------------------------------------------

/**
 * Updates only `display_label` and `status` — the two columns Module
 * 3A grants `authenticated` UPDATE on for `channel_connections` (an
 * admin-only RLS policy on top). `id`, `business_id`, `channel`, and
 * `external_account_id` are immutable after insert by design.
 */
export async function updateChannelConnectionDetails(
  supabase: SupabaseClient,
  businessId: string,
  channelConnectionId: string,
  fields: Partial<UpdatableChannelConnectionFields>,
): Promise<ChannelConnection> {
  const patch: Record<string, unknown> = {};
  if (fields.displayLabel !== undefined) patch.display_label = fields.displayLabel;
  if (fields.status !== undefined) patch.status = fields.status;

  const { data, error } = await supabase
    .from("channel_connections")
    .update(patch)
    .eq("business_id", businessId)
    .eq("id", channelConnectionId)
    .select(CHANNEL_CONNECTION_COLUMNS)
    .single()
    .returns<ChannelConnectionRow>();

  if (error) {
    throw new Error(`Failed to update channel connection: ${error.message}`);
  }

  return toChannelConnection(data);
}

// ---------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------

/**
 * Lists a business's conversations, most-recently-active first
 * (`conversations_business_last_message_idx` covers this ordering).
 * Conversations with no messages yet (`last_message_at is null`) sort
 * last. `cursor`, when given, is the `last_message_at` value (ISO
 * string) of the last conversation from a previous page — a simple
 * keyset cursor over the same index; `limit` defaults to 50.
 */
export async function listConversations(
  supabase: SupabaseClient,
  businessId: string,
  opts?: { status?: ConversationStatus; cursor?: string; limit?: number },
): Promise<Conversation[]> {
  const limit = opts?.limit ?? 50;

  let query = supabase
    .from("conversations")
    .select(CONVERSATION_COLUMNS)
    .eq("business_id", businessId);

  if (opts?.status) {
    query = query.eq("status", opts.status);
  }

  if (opts?.cursor) {
    query = query.lt("last_message_at", opts.cursor);
  }

  const { data, error } = await query
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(limit)
    .returns<ConversationRow[]>();

  if (error) {
    throw new Error(`Failed to load conversations: ${error.message}`);
  }

  return (data ?? []).map(toConversation);
}

export async function getConversation(
  supabase: SupabaseClient,
  businessId: string,
  conversationId: string,
): Promise<Conversation | null> {
  const { data, error } = await supabase
    .from("conversations")
    .select(CONVERSATION_COLUMNS)
    .eq("business_id", businessId)
    .eq("id", conversationId)
    .maybeSingle()
    .returns<ConversationRow>();

  if (error) {
    throw new Error(`Failed to load conversation: ${error.message}`);
  }

  return data ? toConversation(data) : null;
}

/**
 * Updates only `subject` and `status` — the two columns Module 3A
 * grants `authenticated` UPDATE on for `conversations`. The trigger-
 * owned `last_message_*` summary fields are never touched here; they
 * have no client-facing update path at all (see
 * private.update_conversation_last_message() in the migration).
 */
export async function updateConversationDetails(
  supabase: SupabaseClient,
  businessId: string,
  conversationId: string,
  fields: Partial<UpdatableConversationFields>,
): Promise<Conversation> {
  const patch: Record<string, unknown> = {};
  if (fields.subject !== undefined) patch.subject = fields.subject;
  if (fields.status !== undefined) patch.status = fields.status;

  const { data, error } = await supabase
    .from("conversations")
    .update(patch)
    .eq("business_id", businessId)
    .eq("id", conversationId)
    .select(CONVERSATION_COLUMNS)
    .single()
    .returns<ConversationRow>();

  if (error) {
    throw new Error(`Failed to update conversation: ${error.message}`);
  }

  return toConversation(data);
}

// ---------------------------------------------------------------------
// Messages (read-only from the authenticated client — see
// docs/architecture.md; there is deliberately no create/update
// function here)
// ---------------------------------------------------------------------

const DEFAULT_MESSAGE_PAGE_SIZE = 50;

/**
 * Bidirectional keyset pagination over `(provider_sent_at, sequence)`
 * — the same total order `messages_conversation_display_idx` is built
 * for. See design §11.1.
 *
 * - No cursor: loads the most recent page (equivalent to `before` with
 *   an open-ended upper bound), newest message first — the natural
 *   "open a conversation" page.
 * - `direction: 'before'` + cursor: historical page strictly older
 *   than the cursor, in descending chronological order.
 * - `direction: 'after'` + cursor: forward/tailing page strictly newer
 *   than the cursor, in ascending chronological order.
 *
 * Same-timestamp messages are disambiguated by `sequence`, matching
 * the strict tuple comparison in the design (implemented here via
 * PostgREST's `or()` to express `(a, b) < (x, y)` as
 * `a < x OR (a = x AND b < y)`).
 */
export async function listMessages(
  supabase: SupabaseClient,
  businessId: string,
  conversationId: string,
  opts?: {
    cursor?: { providerSentAt: string; sequence: string };
    direction?: "before" | "after";
    limit?: number;
  },
): Promise<Message[]> {
  const direction = opts?.direction ?? "before";
  const limit = opts?.limit ?? DEFAULT_MESSAGE_PAGE_SIZE;

  let query = supabase
    .from("messages")
    .select(MESSAGE_COLUMNS)
    .eq("business_id", businessId)
    .eq("conversation_id", conversationId);

  if (opts?.cursor) {
    const { providerSentAt, sequence } = opts.cursor;
    const comparator = direction === "before" ? "lt" : "gt";
    query = query.or(
      `provider_sent_at.${comparator}.${providerSentAt},` +
        `and(provider_sent_at.eq.${providerSentAt},sequence.${comparator}.${sequence})`,
    );
  }

  const ascending = direction === "after";
  const { data, error } = await query
    .order("provider_sent_at", { ascending })
    .order("sequence", { ascending })
    .limit(limit)
    .returns<MessageRow[]>();

  if (error) {
    throw new Error(`Failed to load messages: ${error.message}`);
  }

  return (data ?? []).map(toMessage);
}

export async function getMessage(
  supabase: SupabaseClient,
  businessId: string,
  messageId: string,
): Promise<Message | null> {
  const { data, error } = await supabase
    .from("messages")
    .select(MESSAGE_COLUMNS)
    .eq("business_id", businessId)
    .eq("id", messageId)
    .maybeSingle()
    .returns<MessageRow>();

  if (error) {
    throw new Error(`Failed to load message: ${error.message}`);
  }

  return data ? toMessage(data) : null;
}
