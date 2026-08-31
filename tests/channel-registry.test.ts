import { describe, expect, it } from "vitest";
import { getChannelConnector } from "@/lib/channels/registry";

describe("getChannelConnector", () => {
  it("returns a connector for every registered channel", () => {
    for (const channel of ["gmail", "whatsapp", "instagram", "telegram"] as const) {
      const connector = getChannelConnector(channel);

      expect(connector).toBeDefined();
      expect(connector?.channel).toBe(channel);
    }
  });

  it("returns undefined for channels without a connector yet", () => {
    expect(getChannelConnector("facebook_messenger")).toBeUndefined();
    expect(getChannelConnector("website_chat")).toBeUndefined();
  });

  it("connector methods reject with NotImplementedError until built", async () => {
    const connector = getChannelConnector("gmail");

    await expect(
      connector?.connect({ businessId: "b1", channel: "gmail", credentials: {} }),
    ).rejects.toThrow(/not implemented/i);
  });
});
