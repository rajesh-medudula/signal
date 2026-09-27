import { describe, expect, it, vi, beforeEach } from "vitest";
import { randomBytes } from "node:crypto";

vi.mock("server-only", () => ({}));

process.env.GMAIL_TOKEN_ENCRYPTION_KEY_V1 = randomBytes(32).toString("base64");

const createServiceRoleClient = vi.fn();
vi.mock("@/lib/db/supabase/admin", () => ({
  createServiceRoleClient: (...args: unknown[]) => createServiceRoleClient(...args),
}));

const {
  persistGmailConnection,
  gmailCredentialExists,
  getGmailRefreshToken,
  deleteGmailCredential,
  disconnectGmailConnectionRecord,
  hasGrantedScope,
  getGmailConnectionEmails,
} = await import("@/lib/channels/gmail/credentials");
const { GmailConnectionError } = await import("@/lib/channels/gmail/errors");
const { encryptGmailRefreshToken } = await import("@/lib/channels/gmail/crypto");

/** A minimal chainable + thenable fake for supabase-js query builders:
 * every method returns `this` except the terminal ones
 * (maybeSingle/single), and the builder itself resolves like a
 * PostgrestBuilder when awaited directly (used by `.in(...)` queries
 * that don't call a terminal method). */
function queryResult<T>(result: { data: T; error: unknown }) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = vi.fn(chain);
  builder.eq = vi.fn(chain);
  builder.in = vi.fn(chain);
  builder.delete = vi.fn(chain);
  builder.update = vi.fn(chain);
  builder.maybeSingle = vi.fn(async () => result);
  builder.single = vi.fn(async () => result);
  builder.then = (resolve: (value: typeof result) => void) => resolve(result);
  return builder;
}

beforeEach(() => {
  createServiceRoleClient.mockReset();
});

describe("persistGmailConnection", () => {
  it("encrypts the refresh token before sending it, and maps the RPC result", async () => {
    const rpcResult = queryResult({
      data: {
        result_channel_connection_id: "conn-1",
        result_was_reconnect: false,
      },
      error: null,
    });
    const rpc = vi.fn(() => rpcResult);
    createServiceRoleClient.mockReturnValue({ rpc });

    const result = await persistGmailConnection({
      businessId: "biz-1",
      externalAccountId: "google-sub-1",
      displayLabel: "Gmail · hello@acme.com",
      authenticatedEmail: "hello@acme.com",
      grantedScopes: ["openid", "email"],
      refreshToken: "plaintext-refresh-token",
    });

    expect(result).toEqual({ channelConnectionId: "conn-1", wasReconnect: false });
    expect(rpc).toHaveBeenCalledTimes(1);
    const [fnName, args] = rpc.mock.calls[0] as unknown as [
      string,
      Record<string, unknown>,
    ];
    expect(fnName).toBe("persist_gmail_connection");
    expect(args.p_business_id).toBe("biz-1");
    expect(args.p_external_account_id).toBe("google-sub-1");
    // The plaintext token must never be sent — only ciphertext.
    expect(args.p_refresh_token_ciphertext).not.toBe("plaintext-refresh-token");
    expect(typeof args.p_refresh_token_ciphertext).toBe("string");
    expect(args.p_encryption_key_version).toBe(1);
  });

  it("passes null ciphertext when no refresh token is given (reconnect without a new token)", async () => {
    const rpcResult = queryResult({
      data: { result_channel_connection_id: "conn-1", result_was_reconnect: true },
      error: null,
    });
    const rpc = vi.fn(() => rpcResult);
    createServiceRoleClient.mockReturnValue({ rpc });

    await persistGmailConnection({
      businessId: "biz-1",
      externalAccountId: "google-sub-1",
      displayLabel: "Gmail · hello@acme.com",
      authenticatedEmail: "hello@acme.com",
      grantedScopes: ["openid"],
      refreshToken: null,
    });

    const [, args] = rpc.mock.calls[0] as unknown as [
      string,
      Record<string, unknown>,
    ];
    expect(args.p_refresh_token_ciphertext).toBeNull();
    expect(args.p_encryption_key_version).toBeNull();
  });

  it("throws GmailConnectionError when the RPC fails", async () => {
    const rpcResult = queryResult({ data: null, error: { message: "boom" } });
    createServiceRoleClient.mockReturnValue({ rpc: () => rpcResult });

    await expect(
      persistGmailConnection({
        businessId: "biz-1",
        externalAccountId: "google-sub-1",
        displayLabel: "Gmail · hello@acme.com",
        authenticatedEmail: "hello@acme.com",
        grantedScopes: [],
        refreshToken: "token",
      }),
    ).rejects.toThrow(GmailConnectionError);
  });
});

describe("gmailCredentialExists", () => {
  it("returns false when no connection row exists", async () => {
    const from = vi.fn(() => queryResult({ data: null, error: null }));
    createServiceRoleClient.mockReturnValue({ from });

    await expect(gmailCredentialExists("biz-1", "google-sub-1")).resolves.toBe(
      false,
    );
  });

  it("returns false when the connection exists but has no credential row", async () => {
    let call = 0;
    const from = vi.fn(() => {
      call += 1;
      return call === 1
        ? queryResult({ data: { id: "conn-1" }, error: null })
        : queryResult({ data: null, error: null });
    });
    createServiceRoleClient.mockReturnValue({ from });

    await expect(gmailCredentialExists("biz-1", "google-sub-1")).resolves.toBe(
      false,
    );
  });

  it("returns true when both the connection and its credential exist", async () => {
    let call = 0;
    const from = vi.fn(() => {
      call += 1;
      return call === 1
        ? queryResult({ data: { id: "conn-1" }, error: null })
        : queryResult({
            data: { channel_connection_id: "conn-1" },
            error: null,
          });
    });
    createServiceRoleClient.mockReturnValue({ from });

    await expect(gmailCredentialExists("biz-1", "google-sub-1")).resolves.toBe(
      true,
    );
  });

  it("throws a safe provider error when the connection lookup fails", async () => {
    const from = vi.fn(() =>
      queryResult({ data: null, error: { message: "database unavailable" } }),
    );
    createServiceRoleClient.mockReturnValue({ from });

    await expect(gmailCredentialExists("biz-1", "google-sub-1")).rejects.toMatchObject({
      code: "provider_error",
    });
  });

  it("throws a safe provider error when the credential lookup fails", async () => {
    let call = 0;
    const from = vi.fn(() => {
      call += 1;
      return call === 1
        ? queryResult({ data: { id: "conn-1" }, error: null })
        : queryResult({ data: null, error: { message: "database unavailable" } });
    });
    createServiceRoleClient.mockReturnValue({ from });

    await expect(gmailCredentialExists("biz-1", "google-sub-1")).rejects.toMatchObject({
      code: "provider_error",
    });
  });
});

describe("getGmailRefreshToken", () => {
  it("decrypts and returns the stored token", async () => {
    const context = { businessId: "biz-1", externalAccountId: "google-sub-1" };
    const encrypted = encryptGmailRefreshToken("my-refresh-token", context);

    const from = vi.fn(() =>
      queryResult({
        data: {
          refresh_token_ciphertext: encrypted.ciphertext,
          encryption_key_version: encrypted.keyVersion,
          granted_scopes: ["openid", "email"],
          authenticated_email: "hello@acme.com",
        },
        error: null,
      }),
    );
    createServiceRoleClient.mockReturnValue({ from });

    const credential = await getGmailRefreshToken(
      "conn-1",
      context.businessId,
      context.externalAccountId,
    );

    expect(credential).toEqual({
      refreshToken: "my-refresh-token",
      grantedScopes: ["openid", "email"],
      authenticatedEmail: "hello@acme.com",
    });
  });

  it("returns null when there is no credential row", async () => {
    const from = vi.fn(() => queryResult({ data: null, error: null }));
    createServiceRoleClient.mockReturnValue({ from });

    await expect(
      getGmailRefreshToken("conn-1", "biz-1", "google-sub-1"),
    ).resolves.toBeNull();
  });

  it("throws when the query errors", async () => {
    const from = vi.fn(() =>
      queryResult({ data: null, error: { message: "boom" } }),
    );
    createServiceRoleClient.mockReturnValue({ from });

    await expect(
      getGmailRefreshToken("conn-1", "biz-1", "google-sub-1"),
    ).rejects.toThrow(GmailConnectionError);
  });
});

describe("deleteGmailCredential", () => {
  it("resolves when the delete succeeds", async () => {
    const from = vi.fn(() => queryResult({ data: null, error: null }));
    createServiceRoleClient.mockReturnValue({ from });

    await expect(deleteGmailCredential("conn-1")).resolves.toBeUndefined();
  });

  it("throws when the delete errors", async () => {
    const from = vi.fn(() =>
      queryResult({ data: null, error: { message: "boom" } }),
    );
    createServiceRoleClient.mockReturnValue({ from });

    await expect(deleteGmailCredential("conn-1")).rejects.toThrow(
      GmailConnectionError,
    );
  });
});

describe("disconnectGmailConnectionRecord", () => {
  it("calls the atomic business-scoped disconnect RPC", async () => {
    const rpcResult = queryResult({
      data: { result_disconnected: true },
      error: null,
    });
    const rpc = vi.fn(() => rpcResult);
    createServiceRoleClient.mockReturnValue({ rpc });

    await expect(
      disconnectGmailConnectionRecord("biz-1", "conn-1"),
    ).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledWith("disconnect_gmail_connection", {
      p_business_id: "biz-1",
      p_channel_connection_id: "conn-1",
    });
  });

  it("returns false when the atomic function cannot find the scoped Gmail row", async () => {
    const rpcResult = queryResult({
      data: { result_disconnected: false },
      error: null,
    });
    createServiceRoleClient.mockReturnValue({ rpc: () => rpcResult });

    await expect(
      disconnectGmailConnectionRecord("biz-1", "conn-1"),
    ).resolves.toBe(false);
  });

  it("throws a safe provider error when the atomic function fails", async () => {
    const rpcResult = queryResult({ data: null, error: { message: "database unavailable" } });
    createServiceRoleClient.mockReturnValue({ rpc: () => rpcResult });

    await expect(
      disconnectGmailConnectionRecord("biz-1", "conn-1"),
    ).rejects.toMatchObject({ code: "provider_error" });
  });
});

describe("getGmailConnectionEmails", () => {
  it("returns an empty map for an empty id list without querying", async () => {
    const from = vi.fn();
    createServiceRoleClient.mockReturnValue({ from });

    const result = await getGmailConnectionEmails([]);

    expect(result.size).toBe(0);
    expect(from).not.toHaveBeenCalled();
  });

  it("maps channel_connection_id to authenticated_email, never the ciphertext", async () => {
    const contextA = { businessId: "biz-1", externalAccountId: "google-sub-1" };
    const contextB = { businessId: "biz-2", externalAccountId: "google-sub-2" };
    const encryptedA = encryptGmailRefreshToken("token-a", contextA);
    const encryptedB = encryptGmailRefreshToken("token-b", contextB);
    const from = vi.fn(() =>
      queryResult({
        data: [
          {
            channel_connection_id: "conn-1",
            authenticated_email: "a@acme.com",
            refresh_token_ciphertext: encryptedA.ciphertext,
            encryption_key_version: encryptedA.keyVersion,
          },
          {
            channel_connection_id: "conn-2",
            authenticated_email: "b@acme.com",
            refresh_token_ciphertext: encryptedB.ciphertext,
            encryption_key_version: encryptedB.keyVersion,
          },
        ],
        error: null,
      }),
    );
    createServiceRoleClient.mockReturnValue({ from });

    const result = await getGmailConnectionEmails([
      { id: "conn-1", ...contextA },
      { id: "conn-2", ...contextB },
    ]);

    expect(result.get("conn-1")).toBe("a@acme.com");
    expect(result.get("conn-2")).toBe("b@acme.com");
    expect([...result.values()]).not.toContain("token-a");
  });

  it("omits an email for an undecryptable credential so callers cannot report it usable", async () => {
    const encrypted = encryptGmailRefreshToken("token-a", {
      businessId: "biz-other",
      externalAccountId: "google-sub-1",
    });
    const from = vi.fn(() =>
      queryResult({
        data: [
          {
            channel_connection_id: "conn-1",
            authenticated_email: "a@acme.com",
            refresh_token_ciphertext: encrypted.ciphertext,
            encryption_key_version: encrypted.keyVersion,
          },
        ],
        error: null,
      }),
    );
    createServiceRoleClient.mockReturnValue({ from });

    const result = await getGmailConnectionEmails([
      {
        id: "conn-1",
        businessId: "biz-1",
        externalAccountId: "google-sub-1",
      },
    ]);

    expect(result.has("conn-1")).toBe(false);
    expect([...result.values()]).not.toContain("a@acme.com");
  });
});

describe("hasGrantedScope", () => {
  it("checks the actually-granted scope set, not what was requested", () => {
    expect(hasGrantedScope(["openid", "email"], "email")).toBe(true);
    expect(
      hasGrantedScope(
        ["openid", "email"],
        "https://www.googleapis.com/auth/gmail.readonly",
      ),
    ).toBe(false);
  });
});
