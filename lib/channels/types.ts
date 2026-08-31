/**
 * Channel independence: nothing outside lib/channels/<channel> should know
 * Gmail, WhatsApp, Instagram, or Telegram exist. Every connector normalizes
 * its channel's data into these shapes before handing it to the rest of
 * the app. This is an architectural contract for future modules, not a
 * database schema — the real schema is designed separately.
 */

export type ChannelType =
  | "gmail"
  | "whatsapp"
  | "instagram"
  | "telegram"
  | "facebook_messenger"
  | "website_chat";

export interface NormalizedMessage {
  channel: ChannelType;
  /** ID of the message in the source channel, for dedupe and lookups. */
  externalId: string;
  conversationExternalId: string;
  direction: "inbound" | "outbound";
  body: string;
  sentAt: string;
}

export interface ChannelConnectionConfig {
  businessId: string;
  channel: ChannelType;
  credentials: Record<string, string>;
}

/**
 * The contract every channel connector must satisfy. No connector below
 * implements real API calls yet — that's future-module work.
 */
export interface ChannelConnector {
  readonly channel: ChannelType;
  connect(config: ChannelConnectionConfig): Promise<void>;
  fetchNewMessages(config: ChannelConnectionConfig): Promise<NormalizedMessage[]>;
  sendMessage(config: ChannelConnectionConfig, message: NormalizedMessage): Promise<void>;
}
