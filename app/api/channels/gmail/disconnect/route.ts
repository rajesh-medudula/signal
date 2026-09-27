import { NextResponse, type NextRequest } from "next/server";
import { requireBusinessAdmin } from "@/lib/business/authorization";
import { disconnectGmailConnection } from "@/lib/channels/gmail/connection";
import { GmailConnectionError } from "@/lib/channels/gmail/errors";

export const runtime = "nodejs";

/**
 * Disconnects a Gmail connection. POST, not GET (item 33) — this is a
 * state-changing action, triggered by a plain `<form method="POST">`
 * on the Channels page so it works without client-side JS.
 *
 * requireBusinessAdmin() is the actual enforcement; the Channels UI
 * hiding this control from a plain member is convenience only (item
 * 45) — this route independently re-verifies every time.
 */
export async function POST(request: NextRequest) {
  const { business } = await requireBusinessAdmin();

  const formData = await request.formData();
  const channelConnectionId = String(formData.get("channelConnectionId") ?? "");

  const redirectTo = new URL("/dashboard/channels", request.url);

  if (!channelConnectionId) {
    redirectTo.searchParams.set("gmail", "error");
    redirectTo.searchParams.set("reason", "not_found");
    return NextResponse.redirect(redirectTo, { status: 303 });
  }

  try {
    await disconnectGmailConnection({
      businessId: business.id,
      channelConnectionId,
    });
  } catch (err) {
    const reason = err instanceof GmailConnectionError ? err.code : "unknown";
    redirectTo.searchParams.set("gmail", "error");
    redirectTo.searchParams.set("reason", reason);
    return NextResponse.redirect(redirectTo, { status: 303 });
  }

  return NextResponse.redirect(redirectTo, { status: 303 });
}
