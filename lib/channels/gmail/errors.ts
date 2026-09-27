/**
 * Stable, user-safe error categories for the Gmail connection
 * lifecycle. Every failure path in lib/channels/gmail/* throws one of
 * these instead of letting a raw Google API error, token payload, or
 * stack trace reach a redirect URL, a log line, or the browser.
 */
export type GmailErrorCode =
  | "cancelled"
  | "invalid_state"
  | "session_mismatch"
  | "not_authorized"
  | "provider_error"
  | "profile_verification_failed"
  | "missing_refresh_token"
  | "not_found"
  | "unknown";

export const GMAIL_ERROR_MESSAGES: Record<GmailErrorCode, string> = {
  cancelled: "Gmail authorization was cancelled.",
  invalid_state: "Gmail authorization failed. Please try again.",
  session_mismatch: "Your session changed during authorization. Please try again.",
  not_authorized:
    "You don't have permission to manage Gmail connections for this business.",
  provider_error: "Gmail authorization failed. Please try again.",
  profile_verification_failed:
    "The selected Google account could not be connected to Gmail.",
  missing_refresh_token: "Your Gmail authorization expired. Reconnect Gmail.",
  not_found: "Gmail connection not found.",
  unknown: "Something went wrong connecting Gmail. Please try again.",
};

export class GmailConnectionError extends Error {
  readonly code: GmailErrorCode;

  constructor(code: GmailErrorCode, message?: string) {
    super(message ?? GMAIL_ERROR_MESSAGES[code]);
    this.name = "GmailConnectionError";
    this.code = code;
  }
}

/** Safe diagnostic-only redaction — prefer not logging the value at
 * all; use this only where a redacted shape genuinely helps debugging
 * (e.g. confirming a secret is non-empty without revealing it). */
export function redactSecret(value: string | null | undefined): string {
  if (!value) return "<empty>";
  if (value.length <= 8) return "<redacted>";
  return `${value.slice(0, 4)}…<redacted, ${value.length} chars>`;
}
