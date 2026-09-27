import "server-only";
import {
  randomBytes,
  createHash,
  createCipheriv,
  createDecipheriv,
  hkdfSync,
} from "node:crypto";
import { OAuth2Client, CodeChallengeMethod } from "google-auth-library";
import { getRequiredEnv } from "@/lib/security/env";
import { GmailConnectionError } from "./errors";

/**
 * Module 4 requests only enough scope to identify the account and
 * verify Gmail mailbox access (`users.getProfile`) — see item 57 of
 * the specification. `gmail.readonly` and anything message-reading is
 * explicitly future-module, incremental-consent work.
 */
export const GMAIL_OAUTH_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/gmail.metadata",
] as const;

export const GMAIL_OAUTH_STATE_COOKIE = "signal_gmail_oauth_state";
export const GMAIL_OAUTH_STATE_MAX_AGE_SECONDS = 10 * 60; // 10 minutes
export const DEFAULT_GMAIL_RETURN_PATH = "/dashboard/channels";

function base64url(buf: Buffer): string {
  return buf.toString("base64url");
}

export function generateOAuthState(): string {
  return base64url(randomBytes(32));
}

export interface PkcePair {
  codeVerifier: string;
  codeChallenge: string;
}

/** S256 PKCE pair. codeVerifier is 43 base64url characters (32 random
 * bytes), well within RFC 7636's 43-128 character range. */
export function generatePkcePair(): PkcePair {
  const codeVerifier = base64url(randomBytes(32));
  const codeChallenge = base64url(
    createHash("sha256").update(codeVerifier).digest(),
  );
  return { codeVerifier, codeChallenge };
}

/**
 * Only a same-origin relative path is ever accepted as a post-OAuth
 * return destination — item 34 of the specification. Anything else
 * (an absolute URL, a protocol-relative `//host` URL, a `javascript:`
 * URL, a path containing a backslash or control characters) falls
 * back to the default. This runs once, at authorize-time, before the
 * value is sealed into the encrypted state cookie — the callback route
 * trusts the cookie's returnPath precisely because it was already
 * sanitized here and the cookie can't be forged without the server's
 * key (see encodeOAuthStateCookie below).
 */
export function sanitizeReturnPath(path: unknown): string {
  if (typeof path !== "string" || path.length === 0) {
    return DEFAULT_GMAIL_RETURN_PATH;
  }
  if (!path.startsWith("/") || path.startsWith("//")) {
    return DEFAULT_GMAIL_RETURN_PATH;
  }
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(path)) {
    // Rejects `javascript:...` and any other scheme-prefixed value
    // that happens to also start with "/" somewhere later.
    return DEFAULT_GMAIL_RETURN_PATH;
  }
  if (path.includes("\\") || /[\x00-\x1f]/.test(path)) {
    return DEFAULT_GMAIL_RETURN_PATH;
  }
  return path;
}

function createOAuthClient(): OAuth2Client {
  return new OAuth2Client({
    clientId: getRequiredEnv("GOOGLE_CLIENT_ID"),
    clientSecret: getRequiredEnv("GOOGLE_CLIENT_SECRET"),
    redirectUri: getRequiredEnv("GOOGLE_REDIRECT_URI"),
  });
}

export function buildGoogleAuthorizationUrl(params: {
  state: string;
  codeChallenge: string;
  /** Always passed for both initial connect and reconnect in this
   * implementation, so Google reliably issues a refresh token every
   * time rather than only on a mailbox's very first authorization —
   * see the Module 4 completion report. */
  prompt?: "consent";
}): string {
  const client = createOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    scope: [...GMAIL_OAUTH_SCOPES],
    state: params.state,
    include_granted_scopes: true,
    code_challenge: params.codeChallenge,
    code_challenge_method: CodeChallengeMethod.S256,
    ...(params.prompt ? { prompt: params.prompt } : {}),
  });
}

export interface GoogleTokens {
  idToken: string;
  accessToken: string;
  /** null when Google didn't issue a new refresh token this time
   * (typically a reconnect where consent was already durable) —
   * callers must not treat this as failure by itself. */
  refreshToken: string | null;
  grantedScopes: string[];
}

export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
): Promise<GoogleTokens> {
  const client = createOAuthClient();

  let tokens;
  try {
    ({ tokens } = await client.getToken({ code, codeVerifier }));
  } catch {
    // Never log the code, verifier, or the raw error — it may embed
    // request details. A stable category is enough here.
    throw new GmailConnectionError("provider_error");
  }

  if (!tokens.id_token || !tokens.access_token) {
    throw new GmailConnectionError("provider_error");
  }

  return {
    idToken: tokens.id_token,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
    grantedScopes: (tokens.scope ?? "")
      .split(" ")
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

export interface GoogleIdentity {
  sub: string;
  email: string;
}

/**
 * Signature, issuer, audience, and expiry validation all happen
 * inside `verifyIdToken` (google-auth-library, backed by Google's
 * published certs) — this function never trusts a decoded-but-
 * unverified JWT payload.
 */
export async function validateGoogleIdToken(
  idToken: string,
): Promise<GoogleIdentity> {
  const client = createOAuthClient();

  let ticket;
  try {
    ticket = await client.verifyIdToken({
      idToken,
      audience: getRequiredEnv("GOOGLE_CLIENT_ID"),
    });
  } catch {
    throw new GmailConnectionError("provider_error");
  }

  const payload = ticket.getPayload();

  if (!payload || !payload.sub || !payload.email) {
    throw new GmailConnectionError("provider_error");
  }

  return { sub: payload.sub, email: payload.email };
}

/** Best-effort remote revocation. Callers must treat a thrown error
 * here as non-fatal to disconnect — see connection.ts. */
export async function revokeGoogleToken(token: string): Promise<void> {
  const client = createOAuthClient();
  await client.revokeToken(token);
}

// ---------------------------------------------------------------------
// OAuth state cookie
//
// Holds the random `state` value, the PKCE code_verifier, the caller's
// user/business IDs, and the sanitized return path for the duration of
// the round trip to Google and back. Encrypted (AES-256-GCM) rather
// than plain JSON, so the PKCE verifier and state aren't sitting in
// the browser's cookie jar as inspectable plaintext even though the
// cookie is already HttpOnly.
//
// The specification's environment-variable list for Module 4 doesn't
// add a dedicated state-signing secret, so the encryption key here is
// derived (HKDF-SHA256, with a fixed, purpose-specific `info` string)
// from GOOGLE_CLIENT_SECRET rather than introducing a new required env
// var. This is a deliberate Module 4 implementation choice — see the
// completion report.
// ---------------------------------------------------------------------

const STATE_COOKIE_VERSION = 1;
const STATE_IV_LENGTH = 12;
const STATE_TAG_LENGTH = 16;

function deriveStateCookieKey(): Buffer {
  const secret = getRequiredEnv("GOOGLE_CLIENT_SECRET");
  return Buffer.from(
    hkdfSync(
      "sha256",
      Buffer.from(secret, "utf8"),
      Buffer.alloc(0),
      Buffer.from("signal:gmail:oauth-state:v1", "utf8"),
      32,
    ),
  );
}

export interface GmailOAuthState {
  state: string;
  codeVerifier: string;
  userId: string;
  businessId: string;
  issuedAt: number;
  expiresAt: number;
  returnPath: string;
}

export function encodeOAuthStateCookie(payload: GmailOAuthState): string {
  const key = deriveStateCookieKey();
  const iv = randomBytes(STATE_IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  const json = Buffer.from(JSON.stringify(payload), "utf8");
  const encrypted = Buffer.concat([cipher.update(json), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([
    Buffer.from([STATE_COOKIE_VERSION]),
    iv,
    tag,
    encrypted,
  ]).toString("base64url");
}

function isGmailOAuthState(value: unknown): value is GmailOAuthState {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.state === "string" &&
    typeof v.codeVerifier === "string" &&
    typeof v.userId === "string" &&
    typeof v.businessId === "string" &&
    typeof v.issuedAt === "number" &&
    typeof v.expiresAt === "number" &&
    typeof v.returnPath === "string"
  );
}

/** Throws GmailConnectionError("invalid_state") for anything
 * malformed, tampered with, or from an unsupported envelope version —
 * never returns a partially-trusted result. */
export function decodeOAuthStateCookie(raw: string): GmailOAuthState {
  let envelope: Buffer;
  try {
    envelope = Buffer.from(raw, "base64url");
  } catch {
    throw new GmailConnectionError("invalid_state");
  }

  if (envelope.length < 1 + STATE_IV_LENGTH + STATE_TAG_LENGTH) {
    throw new GmailConnectionError("invalid_state");
  }

  if (envelope[0] !== STATE_COOKIE_VERSION) {
    throw new GmailConnectionError("invalid_state");
  }

  const iv = envelope.subarray(1, 1 + STATE_IV_LENGTH);
  const tag = envelope.subarray(
    1 + STATE_IV_LENGTH,
    1 + STATE_IV_LENGTH + STATE_TAG_LENGTH,
  );
  const encrypted = envelope.subarray(1 + STATE_IV_LENGTH + STATE_TAG_LENGTH);

  const key = deriveStateCookieKey();
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  let json: Buffer;
  try {
    json = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  } catch {
    throw new GmailConnectionError("invalid_state");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json.toString("utf8"));
  } catch {
    throw new GmailConnectionError("invalid_state");
  }

  if (!isGmailOAuthState(parsed)) {
    throw new GmailConnectionError("invalid_state");
  }

  return parsed;
}
