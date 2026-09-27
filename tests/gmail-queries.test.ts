import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const createSupabaseServerClient = vi.fn();
vi.mock("@/lib/db/supabase/server", () => ({
  createSupabaseServerClient: (...args: unknown[]) =>
    createSupabaseServerClient(...args),
}));

const getGmailConnectionEmails = vi.fn();
vi.mock("@/lib/channels/gmail/credentials", () => ({
  getGmailConnectionEmails: (...args: unknown[]) =>
    getGmailConnectionEmails(...args),
}));

const { listGmailConnections } = await import("@/lib/channels/gmail/queries");

function mockRows(data: unknown[]) {
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    returns: vi.fn().mockResolvedValue({ data, error: null }),
  };
  createSupabaseServerClient.mockResolvedValue({
    from: vi.fn(() => builder),
  });
  return builder;
}

describe("listGmailConnections", () => {
  it("reports a connected row as error if its credential is not decryptable", async () => {
    const builder = mockRows([
      {
        id: "conn-1",
        business_id: "biz-1",
        external_account_id: "google-sub-1",
        status: "connected",
        display_label: "Gmail · hello@acme.com",
        created_at: "2026-09-27T00:00:00Z",
        updated_at: "2026-09-27T00:00:00Z",
      },
    ]);
    getGmailConnectionEmails.mockResolvedValue(new Map());

    const result = await listGmailConnections("biz-1");

    expect(builder.select).toHaveBeenCalledWith(
      "id, business_id, external_account_id, status, display_label, created_at, updated_at",
    );
    expect(getGmailConnectionEmails).toHaveBeenCalledWith([
      {
        id: "conn-1",
        businessId: "biz-1",
        externalAccountId: "google-sub-1",
      },
    ]);
    expect(result[0]).toMatchObject({ status: "error", email: "" });
    expect(result[0]).not.toHaveProperty("refreshToken");
    expect(result[0]).not.toHaveProperty("ciphertext");
  });
});
