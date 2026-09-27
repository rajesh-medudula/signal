import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const exchangeCodeForTokens = vi.fn();
const validateGoogleIdToken = vi.fn();
const revokeGoogleToken = vi.fn();
vi.mock("@/lib/channels/gmail/oauth", async () => {
  return {
    GMAIL_OAUTH_STATE_MAX_AGE_SECONDS: 600,
    generateOAuthState: () => "state",
    generatePkcePair: () => ({
      codeVerifier: "verifier",
      codeChallenge: "challenge",
    }),
    sanitizeReturnPath: (path: string | null | undefined) =>
      path ?? "/dashboard/channels",
    buildGoogleAuthorizationUrl: ({ prompt }: { prompt?: string }) =>
      `https://accounts.google.com/o/oauth2/v2/auth${prompt ? `?prompt=${prompt}` : ""}`,
    encodeOAuthStateCookie: () => "encrypted-cookie",
    exchangeCodeForTokens: (...args: unknown[]) => exchangeCodeForTokens(...args),
    validateGoogleIdToken: (...args: unknown[]) => validateGoogleIdToken(...args),
    revokeGoogleToken: (...args: unknown[]) => revokeGoogleToken(...args),
  };
});

const verifyGmailProfile = vi.fn();
vi.mock("@/lib/channels/gmail/profile", () => ({
  verifyGmailProfile: (...args: unknown[]) => verifyGmailProfile(...args),
}));

const persistGmailConnection = vi.fn();
const gmailCredentialExists = vi.fn();
const getGmailRefreshToken = vi.fn();
const disconnectGmailConnectionRecord = vi.fn();
vi.mock("@/lib/channels/gmail/credentials", () => ({
  persistGmailConnection: (...args: unknown[]) => persistGmailConnection(...args),
  gmailCredentialExists: (...args: unknown[]) => gmailCredentialExists(...args),
  getGmailRefreshToken: (...args: unknown[]) => getGmailRefreshToken(...args),
  disconnectGmailConnectionRecord: (...args: unknown[]) =>
    disconnectGmailConnectionRecord(...args),
}));

const createServiceRoleClient = vi.fn();
vi.mock("@/lib/db/supabase/admin", () => ({
  createServiceRoleClient: (...args: unknown[]) => createServiceRoleClient(...args),
}));

const {
  completeGmailAuthorization,
  disconnectGmailConnection,
  startGmailAuthorization,
} = await import("@/lib/channels/gmail/connection");
const { GmailConnectionError } = await import("@/lib/channels/gmail/errors");

beforeEach(() => {
  exchangeCodeForTokens.mockReset();
  validateGoogleIdToken.mockReset();
  revokeGoogleToken.mockReset();
  verifyGmailProfile.mockReset();
  persistGmailConnection.mockReset();
  gmailCredentialExists.mockReset();
  getGmailRefreshToken.mockReset();
  disconnectGmailConnectionRecord.mockReset();
  createServiceRoleClient.mockReset();

  process.env.GOOGLE_CLIENT_ID = "test-client-id";
  process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
  process.env.GOOGLE_REDIRECT_URI = "https://signal.test/api/channels/gmail/callback";
});

const validTokens = {
  idToken: "id-token",
  accessToken: "access-token",
  refreshToken: "refresh-token",
  grantedScopes: ["openid", "email"],
};

const validIdentity = { sub: "google-sub-1", email: "hello@acme.com" };
const validProfile = { emailAddress: "hello@acme.com" };

describe("startGmailAuthorization", () => {
  it("returns an authorization URL and an encrypted state cookie", () => {
    const result = startGmailAuthorization({
      userId: "user-1",
      businessId: "biz-1",
      returnPath: "/dashboard/channels",
    });

    expect(result.authorizationUrl).toContain("accounts.google.com");
    expect(typeof result.stateCookieValue).toBe("string");
    expect(result.stateCookieValue.length).toBeGreaterThan(0);
  });

  it("always forces the Google consent prompt by default", () => {
    const result = startGmailAuthorization({
      userId: "user-1",
      businessId: "biz-1",
    });
    expect(new URL(result.authorizationUrl).searchParams.get("prompt")).toBe(
      "consent",
    );
  });
});

describe("completeGmailAuthorization", () => {
  it("fails closed when token exchange fails", async () => {
    exchangeCodeForTokens.mockRejectedValue(
      new GmailConnectionError("provider_error"),
    );

    await expect(
      completeGmailAuthorization({
        code: "code",
        codeVerifier: "verifier",
        businessId: "biz-1",
      }),
    ).rejects.toThrow(GmailConnectionError);

    expect(validateGoogleIdToken).not.toHaveBeenCalled();
    expect(persistGmailConnection).not.toHaveBeenCalled();
  });

  it("fails closed when ID token validation fails", async () => {
    exchangeCodeForTokens.mockResolvedValue(validTokens);
    validateGoogleIdToken.mockRejectedValue(
      new GmailConnectionError("provider_error"),
    );

    await expect(
      completeGmailAuthorization({
        code: "code",
        codeVerifier: "verifier",
        businessId: "biz-1",
      }),
    ).rejects.toThrow(GmailConnectionError);

    expect(verifyGmailProfile).not.toHaveBeenCalled();
    expect(persistGmailConnection).not.toHaveBeenCalled();
  });

  it("fails closed when Gmail profile verification fails", async () => {
    exchangeCodeForTokens.mockResolvedValue(validTokens);
    validateGoogleIdToken.mockResolvedValue(validIdentity);
    verifyGmailProfile.mockRejectedValue(
      new GmailConnectionError("profile_verification_failed"),
    );

    await expect(
      completeGmailAuthorization({
        code: "code",
        codeVerifier: "verifier",
        businessId: "biz-1",
      }),
    ).rejects.toThrow(GmailConnectionError);

    expect(persistGmailConnection).not.toHaveBeenCalled();
  });

  it("fails closed with missing_refresh_token when Google omits it and there's no existing credential", async () => {
    exchangeCodeForTokens.mockResolvedValue({
      ...validTokens,
      refreshToken: null,
    });
    validateGoogleIdToken.mockResolvedValue(validIdentity);
    verifyGmailProfile.mockResolvedValue(validProfile);
    gmailCredentialExists.mockResolvedValue(false);

    await expect(
      completeGmailAuthorization({
        code: "code",
        codeVerifier: "verifier",
        businessId: "biz-1",
      }),
    ).rejects.toMatchObject({ code: "missing_refresh_token" });

    expect(persistGmailConnection).not.toHaveBeenCalled();
  });

  it("succeeds on initial connect", async () => {
    exchangeCodeForTokens.mockResolvedValue(validTokens);
    validateGoogleIdToken.mockResolvedValue(validIdentity);
    verifyGmailProfile.mockResolvedValue(validProfile);
    persistGmailConnection.mockResolvedValue({
      channelConnectionId: "conn-1",
      wasReconnect: false,
    });

    const result = await completeGmailAuthorization({
      code: "code",
      codeVerifier: "verifier",
      businessId: "biz-1",
    });

    expect(result).toEqual({ channelConnectionId: "conn-1", wasReconnect: false });
    expect(persistGmailConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        businessId: "biz-1",
        externalAccountId: "google-sub-1",
        authenticatedEmail: "hello@acme.com",
        refreshToken: "refresh-token",
        displayLabel: "Gmail · hello@acme.com",
      }),
    );
    expect(gmailCredentialExists).not.toHaveBeenCalled();
  });

  it("succeeds on reconnect with a new refresh token (replacement)", async () => {
    exchangeCodeForTokens.mockResolvedValue(validTokens);
    validateGoogleIdToken.mockResolvedValue(validIdentity);
    verifyGmailProfile.mockResolvedValue(validProfile);
    persistGmailConnection.mockResolvedValue({
      channelConnectionId: "conn-1",
      wasReconnect: true,
    });

    const result = await completeGmailAuthorization({
      code: "code",
      codeVerifier: "verifier",
      businessId: "biz-1",
    });

    expect(result.wasReconnect).toBe(true);
    expect(persistGmailConnection).toHaveBeenCalledWith(
      expect.objectContaining({ refreshToken: "refresh-token" }),
    );
  });

  it("succeeds on reconnect without a new refresh token, retaining the existing one", async () => {
    exchangeCodeForTokens.mockResolvedValue({
      ...validTokens,
      refreshToken: null,
    });
    validateGoogleIdToken.mockResolvedValue(validIdentity);
    verifyGmailProfile.mockResolvedValue(validProfile);
    gmailCredentialExists.mockResolvedValue(true);
    persistGmailConnection.mockResolvedValue({
      channelConnectionId: "conn-1",
      wasReconnect: true,
    });

    const result = await completeGmailAuthorization({
      code: "code",
      codeVerifier: "verifier",
      businessId: "biz-1",
    });

    expect(result.wasReconnect).toBe(true);
    expect(persistGmailConnection).toHaveBeenCalledWith(
      expect.objectContaining({ refreshToken: null }),
    );
  });
});

describe("disconnectGmailConnection", () => {
  function mockSupabase(connectionRow: unknown) {
    const selectBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: connectionRow, error: null }),
    };
    const from = vi.fn(() => selectBuilder);
    createServiceRoleClient.mockReturnValue({ from });
    return { from, selectBuilder };
  }

  it("throws not_found when the connection doesn't belong to the business", async () => {
    mockSupabase(null);

    await expect(
      disconnectGmailConnection({ businessId: "biz-1", channelConnectionId: "conn-1" }),
    ).rejects.toMatchObject({ code: "not_found" });

    expect(disconnectGmailConnectionRecord).not.toHaveBeenCalled();
  });

  it("deletes the local credential and marks disconnected even when remote revocation fails", async () => {
    mockSupabase({
      id: "conn-1",
      business_id: "biz-1",
      channel: "gmail",
      external_account_id: "google-sub-1",
    });
    getGmailRefreshToken.mockResolvedValue({
      refreshToken: "refresh-token",
      grantedScopes: [],
      authenticatedEmail: "hello@acme.com",
    });
    revokeGoogleToken.mockRejectedValue(new Error("Google is down"));
    disconnectGmailConnectionRecord.mockResolvedValue(true);

    await disconnectGmailConnection({
      businessId: "biz-1",
      channelConnectionId: "conn-1",
    });

    expect(revokeGoogleToken).toHaveBeenCalledWith("refresh-token");
    expect(disconnectGmailConnectionRecord).toHaveBeenCalledWith(
      "biz-1",
      "conn-1",
    );
    expect(
      disconnectGmailConnectionRecord.mock.invocationCallOrder[0],
    ).toBeLessThan(revokeGoogleToken.mock.invocationCallOrder[0]);
  });

  it("deletes the local credential even when there was none to revoke", async () => {
    mockSupabase({
      id: "conn-1",
      business_id: "biz-1",
      channel: "gmail",
      external_account_id: "google-sub-1",
    });
    getGmailRefreshToken.mockResolvedValue(null);
    disconnectGmailConnectionRecord.mockResolvedValue(true);

    await disconnectGmailConnection({
      businessId: "biz-1",
      channelConnectionId: "conn-1",
    });

    expect(revokeGoogleToken).not.toHaveBeenCalled();
    expect(disconnectGmailConnectionRecord).toHaveBeenCalledWith(
      "biz-1",
      "conn-1",
    );
  });

  it("propagates failure of the atomic local disconnect", async () => {
    mockSupabase({
      id: "conn-1",
      business_id: "biz-1",
      channel: "gmail",
      external_account_id: "google-sub-1",
    });
    getGmailRefreshToken.mockResolvedValue(null);
    disconnectGmailConnectionRecord.mockRejectedValue(
      new GmailConnectionError("provider_error"),
    );

    await expect(
      disconnectGmailConnection({ businessId: "biz-1", channelConnectionId: "conn-1" }),
    ).rejects.toThrow(GmailConnectionError);

    expect(disconnectGmailConnectionRecord).toHaveBeenCalledWith(
      "biz-1",
      "conn-1",
    );
  });

  it("fails as not_found when the atomic RPC no longer sees the scoped Gmail row", async () => {
    mockSupabase({
      id: "conn-1",
      business_id: "biz-1",
      channel: "gmail",
      external_account_id: "google-sub-1",
    });
    getGmailRefreshToken.mockResolvedValue(null);
    disconnectGmailConnectionRecord.mockResolvedValue(false);

    await expect(
      disconnectGmailConnection({
        businessId: "biz-1",
        channelConnectionId: "conn-1",
      }),
    ).rejects.toMatchObject({ code: "not_found" });
  });
});
