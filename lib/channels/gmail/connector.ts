import { NotImplementedError } from "@/lib/errors";
import type {
  ChannelConnectionConfig,
  ChannelConnector,
  NormalizedMessage,
} from "@/lib/channels/types";

/**
 * Placeholder Gmail connector. Establishes where OAuth, message fetching,
 * and sending will live without implementing any of it — Gmail-specific
 * code stays isolated here and never leaks into the rest of the app.
 */
export const gmailConnector: ChannelConnector = {
  channel: "gmail",

  async connect(_config: ChannelConnectionConfig): Promise<void> {
    throw new NotImplementedError("Gmail connector");
  },

  async fetchNewMessages(
    _config: ChannelConnectionConfig,
  ): Promise<NormalizedMessage[]> {
    throw new NotImplementedError("Gmail connector");
  },

  async sendMessage(
    _config: ChannelConnectionConfig,
    _message: NormalizedMessage,
  ): Promise<void> {
    throw new NotImplementedError("Gmail connector");
  },
};
