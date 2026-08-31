import { NotImplementedError } from "@/lib/errors";
import type {
  ChannelConnectionConfig,
  ChannelConnector,
  NormalizedMessage,
} from "@/lib/channels/types";

/**
 * Placeholder WhatsApp Business connector. Establishes where auth, message fetching,
 * and sending will live without implementing any of it — WhatsApp Business-specific
 * code stays isolated here and never leaks into the rest of the app.
 */
export const whatsappConnector: ChannelConnector = {
  channel: "whatsapp",

  async connect(_config: ChannelConnectionConfig): Promise<void> {
    throw new NotImplementedError("WhatsApp Business connector");
  },

  async fetchNewMessages(
    _config: ChannelConnectionConfig,
  ): Promise<NormalizedMessage[]> {
    throw new NotImplementedError("WhatsApp Business connector");
  },

  async sendMessage(
    _config: ChannelConnectionConfig,
    _message: NormalizedMessage,
  ): Promise<void> {
    throw new NotImplementedError("WhatsApp Business connector");
  },
};
