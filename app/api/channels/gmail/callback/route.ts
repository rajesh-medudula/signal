import type { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { requireBusinessAdmin } from "@/lib/business/authorization";
import { completeGmailAuthorization } from "@/lib/channels/gmail/connection";
import {
  GMAIL_OAUTH_STATE_COOKIE,
  decodeOAuthStateCookie,
} from "@/lib/channels/gmail/oauth";
import { GmailConnectionError, type GmailErrorCode } from "@/lib/channels/gmail/errors";
import { isNextNotFoundSignal } from "@/lib/channels/gmail/next-error-signals";

export const runtime = "nodejs";

function failurePath(code: GmailErrorCode | "unknown"): string {
  // A short, stable category only — never a raw Google error string
  // or anything else provider-sourced (item 65 of the specification).
  return `/dashboard/channels?gmail=error&reason=${encodeURIComponent(code)}`;
}

/**
 * Handles Google's redirect back after consent. Order follows item 33
 * of the specification exactly: validate the OAuth response, validate
 * state/PKCE, validate the Signal session and business-admin role
 * (which may have changed while the user was away at Google), *then*
 * exchange the code and verify identity/mailbox — never the reverse.
 *
 * The state cookie is single-use regardless of outcome (item 63) —
 * deleted unconditionally, up front, via next/headers' `cookies()`
 * rather than a response object, so the deletion is queued onto
 * whatever response this request ends up producing: a `redirect()` we
 * call ourselves below, requireBusinessAdmin()'s own thrown
 * `redirect()` (verified to carry the mutation forward), or the
 * `isNextNotFoundSignal` branch below (needed specifically because a
 * thrown `notFound()` does not).
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const providerError = searchParams.get("error");
  const returnedState = searchParams.get("state");
  const stateCookieValue =
    request.cookies.get(GMAIL_OAUTH_STATE_COOKIE)?.value ?? null;

  (await cookies()).delete(GMAIL_OAUTH_STATE_COOKIE);

  if (providerError) {
    // Covers both an explicit user cancellation (access_denied) and
    // any other provider-side error — both are "no connection" (item
    // 61), and we don't forward Google's own error text.
    redirect(failurePath("cancelled"));
  }

  if (!code || !returnedState || !stateCookieValue) {
    redirect(failurePath("invalid_state"));
  }

  let state;
  try {
    state = decodeOAuthStateCookie(stateCookieValue);
  } catch {
    redirect(failurePath("invalid_state"));
  }

  const now = Math.floor(Date.now() / 1000);
  if (state.state !== returnedState || now > state.expiresAt) {
    // Covers both a mismatched/forged state and an expired-but-still-
    // present cookie. A genuinely replayed callback has no cookie at
    // all (already single-use/deleted above) and fails the earlier
    // check instead.
    redirect(failurePath("invalid_state"));
  }

  // requireBusinessAdmin re-verifies both the Signal session and the
  // business-admin role from scratch — reusing the existing Module 2B
  // helper rather than any bespoke check; the authorization *decision*
  // is entirely its own. An unauthenticated session's redirect() to
  // /sign-in propagates unchanged. A lost/never-held admin role's
  // notFound() is converted to the Channels page's own error state
  // instead — purely so the already-deleted cookie is preserved in the
  // response (see isNextNotFoundSignal); the outcome is the same
  // fail-closed rejection either way (item 62).
  let context;
  try {
    context = await requireBusinessAdmin(state.businessId);
  } catch (err) {
    if (isNextNotFoundSignal(err)) {
      redirect(failurePath("not_authorized"));
    }
    throw err;
  }

  if (context.membership.userId !== state.userId) {
    // The authenticated caller completing this callback isn't the
    // same user who started it (e.g. a shared browser, a cookie that
    // outlived a sign-out/sign-in as a different admin of the same
    // business).
    redirect(failurePath("session_mismatch"));
  }

  try {
    await completeGmailAuthorization({
      code,
      codeVerifier: state.codeVerifier,
      businessId: context.business.id,
    });
  } catch (err) {
    const errorCode =
      err instanceof GmailConnectionError ? err.code : "unknown";
    redirect(failurePath(errorCode));
  }

  redirect(state.returnPath);
}
