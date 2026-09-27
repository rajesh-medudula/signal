import { Mail } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { StatusIndicator } from "@/components/ui/StatusIndicator";
import type { GmailConnectionView } from "@/lib/channels/gmail/queries";

type GmailConnectionCardProps = {
  connection: GmailConnectionView | null;
  /** Connect/reconnect/disconnect controls are convenience-hidden for
   * a plain member — the actual enforcement is
   * requireBusinessAdmin() in every route under
   * app/api/channels/gmail/*, never this prop (item 45). */
  isAdmin: boolean;
  errorReason?: string | null;
};

const STATUS_TONE: Record<GmailConnectionView["status"], "success" | "neutral" | "danger"> = {
  connected: "success",
  disconnected: "neutral",
  error: "danger",
};

const STATUS_LABEL: Record<GmailConnectionView["status"], string> = {
  connected: "Connected",
  disconnected: "Disconnected",
  error: "Needs attention",
};

const ERROR_MESSAGES: Record<string, string> = {
  cancelled: "Gmail authorization was cancelled.",
  invalid_state: "Gmail authorization failed. Please try again.",
  session_mismatch: "Your session changed during authorization. Please try again.",
  not_authorized: "You don't have permission to manage Gmail connections for this business.",
  provider_error: "Gmail authorization failed. Please try again.",
  profile_verification_failed: "The selected Google account could not be connected to Gmail.",
  missing_refresh_token: "Your Gmail authorization expired. Reconnect Gmail.",
  not_found: "Gmail connection not found.",
};

/**
 * The whole of Module 4's UI surface (item 44 of the specification):
 * a connect/reconnect/disconnect card, nothing more. No inbox, no
 * thread view, no message list — those are future-module work.
 */
export function GmailConnectionCard({
  connection,
  isAdmin,
  errorReason,
}: GmailConnectionCardProps) {
  const showsReconnectDisconnect = connection && connection.status !== "disconnected";

  return (
    <Card>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-muted">
            <Mail className="h-4 w-4 text-text-secondary" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium text-text">Gmail</p>
            {connection ? (
              <>
                <StatusIndicator
                  tone={STATUS_TONE[connection.status]}
                  label={STATUS_LABEL[connection.status]}
                  className="mt-1"
                />
                {connection.email ? (
                  <p className="mt-1 text-sm text-text-secondary">
                    {connection.email}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="mt-1 max-w-sm text-sm text-text-secondary">
                Connect a Gmail mailbox to bring customer conversations into
                Signal.
              </p>
            )}
            {errorReason ? (
              <p className="mt-2 text-sm text-danger">
                {ERROR_MESSAGES[errorReason] ??
                  "Something went wrong connecting Gmail. Please try again."}
              </p>
            ) : null}
          </div>
        </div>

        {isAdmin ? (
          <div className="flex shrink-0 items-center gap-2">
            {showsReconnectDisconnect ? (
              <>
                <ButtonLink
                  href="/api/channels/gmail/authorize"
                  variant="secondary"
                  size="sm"
                >
                  Reconnect
                </ButtonLink>
                <form action="/api/channels/gmail/disconnect" method="POST">
                  <input
                    type="hidden"
                    name="channelConnectionId"
                    value={connection.id}
                  />
                  <Button type="submit" variant="secondary" size="sm">
                    Disconnect
                  </Button>
                </form>
              </>
            ) : (
              <ButtonLink href="/api/channels/gmail/authorize" size="sm">
                {connection ? "Reconnect Gmail" : "Connect Gmail"}
              </ButtonLink>
            )}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
