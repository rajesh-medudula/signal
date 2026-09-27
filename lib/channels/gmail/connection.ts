import "server-only";
import { createServiceRoleClient } from "@/lib/db/supabase/admin";
import {
  generateOAuthState,
  generatePkcePair,
  sanitizeReturnPath,
  buildGoogleAuthorizationUrl,
  encodeOAuthStateCookie,
  exchangeCodeForTokens,
  validateGoogleIdToken,
  revokeGoogleToken,
  GMAIL_OAUTH_STATE_MAX_AGE_SECONDS,
  type GmailOAuthState,
} from "./oauth";
import { verifyGmailProfile } from "./profile";
import {
  persistGmailConnection,
  gmailCredentialExists,
  getGmailRefreshToken,
  disconnectGmailConnectionRecord,
  type PersistedGmailConnection,
} from "./credentials";
import { GmailConnectionError } from "./errors";

/**
 * Orchestrates the OAuth connection lifecycle by composing oauth.ts +
 * profile.ts + credentials.ts. Deliberately free of Next.js request
 * primitives (cookies(), redirect(), requireUser()/requireBusinessAdmin())
 * — those stay in the route handlers under app/api/channels/gmail/*,
 * which call requireUser()/requireBusinessAdmin() themselves (reusing
 * the existing Module 2B tenancy helpers, never reimplementing them)
 * and pass already-authorized context in here. That keeps this module
 * a plain set of testable functions.
 */

// ---------------------------------------------------------------------
// Step 1: /authorize
// ---------------------------------------------------------------------

export interface StartGmailAuthorizationInput {
  userId: string;
  businessId: string;
  returnPath?: string | null;
  /** Always force Google's consent screen, for both a first connect
   * and a reconnect, so a refresh token is reliably issued every time
   * rather than only on a mailbox's very first authorization. See the
   * Module 4 completion report. */
  forceConsent?: boolean;
}

export interface StartGmailAuthorizationResult {
  authorizationUrl: string;
  stateCookieValue: string;
  stateCookieMaxAgeSeconds: number;
}

export function startGmailAuthorization(
  input: StartGmailAuthorizationInput,
): StartGmailAuthorizationResult {
  const state = generateOAuthState();
  const { codeVerifier, codeChallenge } = generatePkcePair();
  const returnPath = sanitizeReturnPath(input.returnPath);

  const now = Math.floor(Date.now() / 1000);
  const payload: GmailOAuthState = {
    state,
    codeVerifier,
    userId: input.userId,
    businessId: input.businessId,
    issuedAt: now,
    expiresAt: now + GMAIL_OAUTH_STATE_MAX_AGE_SECONDS,
    returnPath,
  };

  const authorizationUrl = buildGoogleAuthorizationUrl({
    state,
    codeChallenge,
    prompt: input.forceConsent === false ? undefined : "consent",
  });

  return {
    authorizationUrl,
    stateCookieValue: encodeOAuthStateCookie(payload),
    stateCookieMaxAgeSeconds: GMAIL_OAUTH_STATE_MAX_AGE_SECONDS,
  };
}

// ---------------------------------------------------------------------
// Step 2: /callback
// ---------------------------------------------------------------------

export interface CompleteGmailAuthorizationInput {
  code: string;
  codeVerifier: string;
  businessId: string;
}

/**
 * Runs the remaining callback steps (item 33's callback checklist,
 * items 7-12): token exchange, ID token validation, Gmail mailbox
 * verification, then atomic persistence. State/PKCE comparison,
 * Signal session validation, and business-admin re-verification all
 * happen in the route handler *before* this is called — see
 * app/api/channels/gmail/callback/route.ts.
 *
 * Every step fails closed (item 61): any exception here — from token
 * exchange, ID validation, profile verification, or persistence —
 * propagates as a GmailConnectionError without any partial state
 * having been written. The one thing decided *in* this function
 * rather than left to the database is the "no refresh token AND no
 * existing credential" case (item 52), so that failure gets a precise
 * `missing_refresh_token` error instead of a generic one from the
 * database's NOT NULL backstop.
 */
export async function completeGmailAuthorization(
  input: CompleteGmailAuthorizationInput,
): Promise<PersistedGmailConnection> {
  const tokens = await exchangeCodeForTokens(input.code, input.codeVerifier);
  const identity = await validateGoogleIdToken(tokens.idToken);
  const profile = await verifyGmailProfile(tokens.accessToken);

  if (!tokens.refreshToken) {
    const hasExisting = await gmailCredentialExists(
      input.businessId,
      identity.sub,
    );
    if (!hasExisting) {
      throw new GmailConnectionError("missing_refresh_token");
    }
  }

  return persistGmailConnection({
    businessId: input.businessId,
    externalAccountId: identity.sub,
    displayLabel: `Gmail · ${profile.emailAddress}`,
    authenticatedEmail: profile.emailAddress,
    grantedScopes: tokens.grantedScopes,
    refreshToken: tokens.refreshToken,
  });
}

// ---------------------------------------------------------------------
// Step 3: /disconnect
// ---------------------------------------------------------------------

export interface DisconnectGmailConnectionInput {
  businessId: string;
  channelConnectionId: string;
}

/**
 * Removes the local credential and marks the connection disconnected
 * atomically before best-effort remote Google revocation (item 87 of
 * the specification) — a failed database operation must not revoke the
 * remote token while leaving the local row marked connected. The caller
 * (the disconnect route) is expected to have already run
 * requireBusinessAdmin(businessId); this function still re-scopes
 * every query to businessId as defense in depth.
 */
export async function disconnectGmailConnection(
  input: DisconnectGmailConnectionInput,
): Promise<void> {
  const supabase = createServiceRoleClient();

  const { data: connection, error } = await supabase
    .from("channel_connections")
    .select("id, business_id, channel, external_account_id")
    .eq("id", input.channelConnectionId)
    .eq("business_id", input.businessId)
    .eq("channel", "gmail")
    .maybeSingle();

  if (error || !connection) {
    throw new GmailConnectionError("not_found");
  }

  let refreshToken: string | null = null;
  try {
    const credential = await getGmailRefreshToken(
      connection.id,
      connection.business_id,
      connection.external_account_id,
    );
    refreshToken = credential?.refreshToken ?? null;
  } catch {
    // A damaged/missing credential can't prevent its local removal.
  }

  const disconnected = await disconnectGmailConnectionRecord(
    input.businessId,
    connection.id,
  );
  if (!disconnected) {
    throw new GmailConnectionError("not_found");
  }

  if (refreshToken) {
    try {
      await revokeGoogleToken(refreshToken);
    } catch {
      // Best-effort only — remote revocation failing must never restore
      // or preserve the now-deleted local credential (item 87).
    }
  }
}
