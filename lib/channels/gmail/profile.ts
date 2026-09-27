import "server-only";
import { GmailConnectionError } from "./errors";

export interface GmailProfile {
  emailAddress: string;
}

/**
 * Verifies Gmail mailbox access with `users.getProfile` — the only
 * Gmail API call Module 4 makes after token exchange (item 57 of the
 * specification). This is mailbox *identity* verification, not a sync:
 * `messagesTotal`, `threadsTotal`, and `historyId` are returned by the
 * API but deliberately not read or persisted here (item 83) — they're
 * operational state for a future ingestion module.
 *
 * Takes a short-lived access token directly, in memory, and never
 * persists it — access tokens aren't a column in
 * gmail_connection_credentials at all (item 77).
 */
export async function verifyGmailProfile(
  accessToken: string,
): Promise<GmailProfile> {
  let response: Response;
  try {
    response = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/profile",
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
  } catch {
    throw new GmailConnectionError("provider_error");
  }

  if (!response.ok) {
    throw new GmailConnectionError("profile_verification_failed");
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new GmailConnectionError("profile_verification_failed");
  }

  const emailAddress =
    typeof data === "object" && data !== null
      ? (data as { emailAddress?: unknown }).emailAddress
      : undefined;

  if (typeof emailAddress !== "string" || emailAddress.length === 0) {
    throw new GmailConnectionError("profile_verification_failed");
  }

  return { emailAddress };
}
