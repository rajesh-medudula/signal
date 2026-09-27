import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

const {
  generateOAuthState,
  generatePkcePair,
  sanitizeReturnPath,
  buildGoogleAuthorizationUrl,
  encodeOAuthStateCookie,
  decodeOAuthStateCookie,
  DEFAULT_GMAIL_RETURN_PATH,
} = await import("@/lib/channels/gmail/oauth");
const { GmailConnectionError } = await import("@/lib/channels/gmail/errors");

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env.GOOGLE_CLIENT_ID = "test-client-id";
  process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
  process.env.GOOGLE_REDIRECT_URI = "https://signal.test/api/channels/gmail/callback";
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("generateOAuthState", () => {
  it("is random and unique across calls", () => {
    const values = new Set(Array.from({ length: 20 }, () => generateOAuthState()));
    expect(values.size).toBe(20);
  });

  it("is a non-trivially-short opaque string", () => {
    const state = generateOAuthState();
    expect(state.length).toBeGreaterThanOrEqual(32);
  });
});

describe("generatePkcePair", () => {
  it("produces a verifier and an S256 challenge derived from it", async () => {
    const { createHash } = await import("node:crypto");
    const { codeVerifier, codeChallenge } = generatePkcePair();

    const expectedChallenge = Buffer.from(
      createHash("sha256").update(codeVerifier).digest(),
    ).toString("base64url");

    expect(codeChallenge).toBe(expectedChallenge);
  });

  it("produces a verifier within RFC 7636's 43-128 character range", () => {
    const { codeVerifier } = generatePkcePair();
    expect(codeVerifier.length).toBeGreaterThanOrEqual(43);
    expect(codeVerifier.length).toBeLessThanOrEqual(128);
  });

  it("produces different verifiers each time", () => {
    const a = generatePkcePair();
    const b = generatePkcePair();
    expect(a.codeVerifier).not.toBe(b.codeVerifier);
  });
});

describe("sanitizeReturnPath", () => {
  it("accepts a safe local relative path", () => {
    expect(sanitizeReturnPath("/dashboard/channels")).toBe(
      "/dashboard/channels",
    );
  });

  it("rejects an absolute external URL", () => {
    expect(sanitizeReturnPath("https://evil.example")).toBe(
      DEFAULT_GMAIL_RETURN_PATH,
    );
  });

  it("rejects a protocol-relative URL", () => {
    expect(sanitizeReturnPath("//evil.example")).toBe(
      DEFAULT_GMAIL_RETURN_PATH,
    );
  });

  it("rejects a javascript: URL", () => {
    expect(sanitizeReturnPath("javascript:alert(1)")).toBe(
      DEFAULT_GMAIL_RETURN_PATH,
    );
  });

  it("rejects a non-string value", () => {
    expect(sanitizeReturnPath(undefined)).toBe(DEFAULT_GMAIL_RETURN_PATH);
    expect(sanitizeReturnPath(null)).toBe(DEFAULT_GMAIL_RETURN_PATH);
    expect(sanitizeReturnPath(42)).toBe(DEFAULT_GMAIL_RETURN_PATH);
  });

  it("rejects a path with a backslash", () => {
    expect(sanitizeReturnPath("/dashboard\\evil")).toBe(
      DEFAULT_GMAIL_RETURN_PATH,
    );
  });

  it("rejects a path not starting with a single slash", () => {
    expect(sanitizeReturnPath("dashboard/channels")).toBe(
      DEFAULT_GMAIL_RETURN_PATH,
    );
  });
});

describe("buildGoogleAuthorizationUrl", () => {
  it("contains the expected Gmail scopes", () => {
    const url = buildGoogleAuthorizationUrl({
      state: "abc",
      codeChallenge: "def",
    });
    const parsed = new URL(url);
    const scope = parsed.searchParams.get("scope") ?? "";
    expect(scope).toContain("openid");
    expect(scope).toContain("email");
    expect(scope).toContain("https://www.googleapis.com/auth/gmail.metadata");
  });

  it("passes through state and PKCE parameters", () => {
    const url = buildGoogleAuthorizationUrl({
      state: "my-state-value",
      codeChallenge: "my-challenge-value",
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get("state")).toBe("my-state-value");
    expect(parsed.searchParams.get("code_challenge")).toBe(
      "my-challenge-value",
    );
    expect(parsed.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("requests offline access", () => {
    const url = buildGoogleAuthorizationUrl({
      state: "abc",
      codeChallenge: "def",
    });
    expect(new URL(url).searchParams.get("access_type")).toBe("offline");
  });

  it("includes prompt=consent only when requested", () => {
    const withPrompt = new URL(
      buildGoogleAuthorizationUrl({
        state: "abc",
        codeChallenge: "def",
        prompt: "consent",
      }),
    );
    const withoutPrompt = new URL(
      buildGoogleAuthorizationUrl({ state: "abc", codeChallenge: "def" }),
    );
    expect(withPrompt.searchParams.get("prompt")).toBe("consent");
    expect(withoutPrompt.searchParams.has("prompt")).toBe(false);
  });
});

describe("encodeOAuthStateCookie / decodeOAuthStateCookie", () => {
  const payload = {
    state: "state-value",
    codeVerifier: "verifier-value",
    userId: "user-1",
    businessId: "biz-1",
    issuedAt: 1000,
    expiresAt: 1600,
    returnPath: "/dashboard/channels",
  };

  it("round-trips the full payload", () => {
    const cookie = encodeOAuthStateCookie(payload);
    const decoded = decodeOAuthStateCookie(cookie);
    expect(decoded).toEqual(payload);
  });

  it("produces a cookie value that doesn't contain the plaintext code verifier", () => {
    const cookie = encodeOAuthStateCookie(payload);
    expect(cookie).not.toContain(payload.codeVerifier);
  });

  it("produces different ciphertext for the same payload each time (random IV)", () => {
    const a = encodeOAuthStateCookie(payload);
    const b = encodeOAuthStateCookie(payload);
    expect(a).not.toBe(b);
  });

  it("rejects a tampered cookie value", () => {
    const cookie = encodeOAuthStateCookie(payload);
    const raw = Buffer.from(cookie, "base64url");
    raw[raw.length - 1] ^= 0xff;
    const tampered = raw.toString("base64url");

    expect(() => decodeOAuthStateCookie(tampered)).toThrow(
      GmailConnectionError,
    );
  });

  it("rejects garbage input", () => {
    expect(() => decodeOAuthStateCookie("not-a-valid-cookie")).toThrow(
      GmailConnectionError,
    );
  });

  it("rejects a cookie encrypted under a different GOOGLE_CLIENT_SECRET", () => {
    const cookie = encodeOAuthStateCookie(payload);
    process.env.GOOGLE_CLIENT_SECRET = "a-different-secret";
    expect(() => decodeOAuthStateCookie(cookie)).toThrow(GmailConnectionError);
  });
});
