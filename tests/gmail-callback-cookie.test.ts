import { describe, expect, it, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const { deleteCookie, cookiesStore, redirectFn } = vi.hoisted(() => {
  const deleteCookie = vi.fn();
  const cookiesStore = { delete: deleteCookie, get: vi.fn(), set: vi.fn() };
  const redirectFn = vi.fn((path: string) => {
    const err = new Error("NEXT_REDIRECT") as Error & { digest: string };
    err.digest = `NEXT_REDIRECT;replace;${path};307;`;
    throw err;
  });
  return { deleteCookie, cookiesStore, redirectFn };
});

vi.mock("next/headers", () => ({
  cookies: async () => cookiesStore,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectFn,
}));

const requireBusinessAdmin = vi.fn();
vi.mock("@/lib/business/authorization", () => ({
  requireBusinessAdmin: (...args: unknown[]) => requireBusinessAdmin(...args),
}));

const completeGmailAuthorization = vi.fn();
vi.mock("@/lib/channels/gmail/connection", () => ({
  completeGmailAuthorization: (...args: unknown[]) =>
    completeGmailAuthorization(...args),
}));

const decodeOAuthStateCookie = vi.fn();
vi.mock("@/lib/channels/gmail/oauth", () => ({
  GMAIL_OAUTH_STATE_COOKIE: "signal_gmail_oauth_state",
  decodeOAuthStateCookie: (...args: unknown[]) =>
    decodeOAuthStateCookie(...args),
}));

const { GET } = await import("@/app/api/channels/gmail/callback/route");

function makeRequest(params: Record<string, string>, cookieValue?: string) {
  const url = new URL("https://signal.test/api/channels/gmail/callback");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return {
    nextUrl: url,
    cookies: {
      get: (name: string) =>
        name === "signal_gmail_oauth_state" && cookieValue
          ? { value: cookieValue }
          : undefined,
    },
  } as unknown as NextRequest;
}

const validState = {
  state: "state-value",
  codeVerifier: "verifier",
  userId: "user-1",
  businessId: "biz-1",
  issuedAt: 0,
  expiresAt: Math.floor(Date.now() / 1000) + 600,
  returnPath: "/dashboard/channels",
};

beforeEach(() => {
  deleteCookie.mockClear();
  redirectFn.mockClear();
  requireBusinessAdmin.mockReset();
  completeGmailAuthorization.mockReset();
  decodeOAuthStateCookie.mockReset();
});

describe("Gmail callback route: state-cookie clearing", () => {
  it("deletes the state cookie even on the earliest failure path (provider error)", async () => {
    const request = makeRequest({ error: "access_denied" }, "cookie-value");

    await expect(GET(request)).rejects.toThrow();

    expect(deleteCookie).toHaveBeenCalledWith("signal_gmail_oauth_state");
    expect(redirectFn).toHaveBeenCalledWith(
      expect.stringContaining("reason=cancelled"),
    );
  });

  it("deletes the state cookie on invalid_state (missing code/state/cookie)", async () => {
    const request = makeRequest({}, undefined);

    await expect(GET(request)).rejects.toThrow();

    expect(deleteCookie).toHaveBeenCalledWith("signal_gmail_oauth_state");
    expect(redirectFn).toHaveBeenCalledWith(
      expect.stringContaining("reason=invalid_state"),
    );
  });

  it("converts a notFound-shaped requireBusinessAdmin failure into a redirect (so the earlier deletion survives)", async () => {
    decodeOAuthStateCookie.mockReturnValue(validState);

    const notFoundErr = new Error("NEXT_HTTP_ERROR_FALLBACK;404") as Error & {
      digest: string;
    };
    notFoundErr.digest = "NEXT_HTTP_ERROR_FALLBACK;404";
    requireBusinessAdmin.mockRejectedValue(notFoundErr);

    const request = makeRequest(
      { code: "auth-code", state: validState.state },
      "cookie-value",
    );

    await expect(GET(request)).rejects.toThrow();

    // The cookie is cleared unconditionally, before requireBusinessAdmin
    // is even called.
    expect(deleteCookie).toHaveBeenCalledWith("signal_gmail_oauth_state");
    // The notFound signal was converted to our own redirect rather than
    // left to propagate as-is (which would drop the cookie deletion).
    expect(redirectFn).toHaveBeenCalledWith(
      expect.stringContaining("reason=not_authorized"),
    );
  });

  it("leaves a redirect-shaped requireBusinessAdmin failure (e.g. unauthenticated -> /sign-in) to propagate untouched", async () => {
    decodeOAuthStateCookie.mockReturnValue(validState);

    const signInRedirect = new Error("NEXT_REDIRECT") as Error & {
      digest: string;
    };
    signInRedirect.digest = "NEXT_REDIRECT;replace;/sign-in;307;";
    requireBusinessAdmin.mockRejectedValue(signInRedirect);

    const request = makeRequest(
      { code: "auth-code", state: validState.state },
      "cookie-value",
    );

    await expect(GET(request)).rejects.toBe(signInRedirect);

    // Still cleared up front, before requireBusinessAdmin ran — this
    // case relies on redirect() itself carrying the mutation forward
    // (verified separately against the real Next runtime), not on any
    // extra handling in the route.
    expect(deleteCookie).toHaveBeenCalledWith("signal_gmail_oauth_state");
    // The route must not have called its own redirect() for this case —
    // the original sign-in redirect propagates as-is, unconverted.
    expect(redirectFn).not.toHaveBeenCalled();
  });

  it("deletes the cookie before completeGmailAuthorization runs, and redirects to the sanitized return path on success", async () => {
    decodeOAuthStateCookie.mockReturnValue(validState);
    requireBusinessAdmin.mockResolvedValue({
      business: { id: "biz-1" },
      membership: { userId: "user-1", role: "owner" },
    });
    completeGmailAuthorization.mockResolvedValue({
      channelConnectionId: "conn-1",
      wasReconnect: false,
    });

    const request = makeRequest(
      { code: "auth-code", state: validState.state },
      "cookie-value",
    );

    await expect(GET(request)).rejects.toThrow();

    const deleteOrder = deleteCookie.mock.invocationCallOrder[0];
    const completeOrder =
      completeGmailAuthorization.mock.invocationCallOrder[0];
    expect(deleteOrder).toBeLessThan(completeOrder);
    expect(redirectFn).toHaveBeenCalledWith(validState.returnPath);
  });

  it("rejects a mismatched Signal session (state.userId !== authenticated membership.userId) with the cookie already cleared", async () => {
    decodeOAuthStateCookie.mockReturnValue(validState);
    requireBusinessAdmin.mockResolvedValue({
      business: { id: "biz-1" },
      membership: { userId: "a-different-user", role: "owner" },
    });

    const request = makeRequest(
      { code: "auth-code", state: validState.state },
      "cookie-value",
    );

    await expect(GET(request)).rejects.toThrow();

    expect(deleteCookie).toHaveBeenCalledWith("signal_gmail_oauth_state");
    expect(redirectFn).toHaveBeenCalledWith(
      expect.stringContaining("reason=session_mismatch"),
    );
    expect(completeGmailAuthorization).not.toHaveBeenCalled();
  });
});
