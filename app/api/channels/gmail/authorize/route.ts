import { NextResponse, type NextRequest } from "next/server";
import { requireBusinessAdmin } from "@/lib/business/authorization";
import { startGmailAuthorization } from "@/lib/channels/gmail/connection";
import {
  GMAIL_OAUTH_STATE_COOKIE,
  GMAIL_OAUTH_STATE_MAX_AGE_SECONDS,
} from "@/lib/channels/gmail/oauth";
import { isProduction } from "@/lib/security/env";

/**
 * Runs on Node.js (not the Edge runtime): this route uses `node:crypto`
 * and google-auth-library, neither of which is Edge-compatible.
 */
export const runtime = "nodejs";

/**
 * Starts the Gmail OAuth flow. A real browser navigation (not a
 * fetch()) — the "Connect Gmail" / "Reconnect" controls are plain
 * links, so an unauthenticated or non-admin visitor gets the normal
 * requireUser()/requireBusinessAdmin() redirect/404 behavior rather
 * than an opaque fetch failure.
 *
 * Deliberately does not create a channel_connections row (item 33) —
 * that only happens after full verification succeeds in the callback.
 */
export async function GET(request: NextRequest) {
  const { business, membership } = await requireBusinessAdmin();

  const returnPath = request.nextUrl.searchParams.get("return_path");

  const { authorizationUrl, stateCookieValue, stateCookieMaxAgeSeconds } =
    startGmailAuthorization({
      userId: membership.userId,
      businessId: business.id,
      returnPath,
    });

  const response = NextResponse.redirect(authorizationUrl);
  response.cookies.set(GMAIL_OAUTH_STATE_COOKIE, stateCookieValue, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    maxAge: stateCookieMaxAgeSeconds ?? GMAIL_OAUTH_STATE_MAX_AGE_SECONDS,
  });

  return response;
}
