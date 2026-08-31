import { gmailConnector } from "@/lib/channels/gmail";
import { whatsappConnector } from "@/lib/channels/whatsapp";
import { instagramConnector } from "@/lib/channels/instagram";
import { telegramConnector } from "@/lib/channels/telegram";
import type { ChannelConnector, ChannelType } from "@/lib/channels/types";

const registry: Partial<Record<ChannelType, ChannelConnector>> = {
  gmail: gmailConnector,
  whatsapp: whatsappConnector,
  instagram: instagramConnector,
  telegram: telegramConnector,
};

/**
 * Looks up the connector for a channel type. Returns undefined for
 * channels that don't have a connector registered yet (e.g.
 * facebook_messenger, website_chat) rather than throwing, so callers can
 * show "not available yet" instead of crashing.
 */
export function getChannelConnector(
  channel: ChannelType,
): ChannelConnector | undefined {
  return registry[channel];
}
