/**
 * Module 3A domain contract: Customer / Conversation / Message.
 *
 * Mirrors supabase/migrations/20260924120000_customer_conversation_message_foundation.sql
 * field-for-field. See docs/architecture.md for the trust-boundary and
 * concurrency rationale behind these shapes.
 */
import type { ChannelType } from "@/lib/channels/types";

export type ChannelConnectionStatus = "connected" | "disconnected" | "error";

export interface ChannelConnection {
  id: string;
  businessId: string;
  channel: ChannelType; // Domain application contract (database column remains text)
  displayLabel: string;
  externalAccountId: string;
  status: ChannelConnectionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  businessId: string;
  displayName: string | null;
  primaryEmail: string | null;
  primaryPhone: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerIdentity {
  id: string;
  businessId: string;
  customerId: string;
  channelConnectionId: string;
  externalIdentityValue: string;
  createdAt: string;
}

export type ConversationStatus = "open" | "closed" | "archived";

export interface Conversation {
  id: string;
  businessId: string;
  customerId: string;
  channelConnectionId: string;
  externalConversationId: string;
  subject: string | null;
  status: ConversationStatus;
  lastMessageAt: string | null;
  lastMessageSequence: string | null; // PostgreSQL bigint represented as string
  lastMessagePreview: string | null;
  createdAt: string;
  updatedAt: string;
}

export type MessageDirection = "inbound" | "outbound";
export type MessageSenderType = "customer" | "business_member" | "system";

export interface MessageAttachment {
  filename: string;
  contentType: string;
  sizeBytes: number | null;
  storageRef: string | null;
}

export interface Message {
  id: string;
  businessId: string;
  conversationId: string;
  channelConnectionId: string;
  externalMessageId: string;
  direction: MessageDirection;
  senderType: MessageSenderType;
  senderCustomerId: string | null;
  senderMemberUserId: string | null;
  body: string;
  contentType: string;
  attachments: MessageAttachment[];
  providerMetadata: Record<string, unknown>;
  providerSentAt: string;
  createdAt: string;
  sequence: string; // PostgreSQL bigint represented as string
}

export type UpdatableChannelConnectionFields = Pick<
  ChannelConnection,
  "displayLabel" | "status"
>;
export type UpdatableCustomerFields = Pick<
  Customer,
  "displayName" | "primaryEmail" | "primaryPhone" | "metadata"
>;
export type UpdatableConversationFields = Pick<Conversation, "subject" | "status">;
