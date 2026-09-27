import { requireBusinessAccess } from "@/lib/business/authorization";
import { listGmailConnections } from "@/lib/channels/gmail/queries";
import { GmailConnectionCard } from "@/components/channels/GmailConnectionCard";
import { ConnectChannelModal } from "@/components/dashboard/ConnectChannelModal";
import { ButtonLink, Button } from "@/components/ui/Button";

type ChannelsPageProps = {
  searchParams: Promise<{ gmail?: string; reason?: string }>;
};

export default async function ChannelsPage({ searchParams }: ChannelsPageProps) {
  const { business, membership } = await requireBusinessAccess();
  const { gmail, reason } = await searchParams;

  const isAdmin = membership.role === "owner" || membership.role === "admin";
  const errorReason = gmail === "error" ? (reason ?? "unknown") : null;

  const gmailConnections = await listGmailConnections(business.id);

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight text-text">
        Channels
      </h1>

      <div className="mt-6 space-y-3">
        {gmailConnections.length > 0 ? (
          gmailConnections.map((connection, index) => (
            <GmailConnectionCard
              key={connection.id}
              connection={connection}
              isAdmin={isAdmin}
              errorReason={index === 0 ? errorReason : null}
            />
          ))
        ) : (
          <GmailConnectionCard
            connection={null}
            isAdmin={isAdmin}
            errorReason={errorReason}
          />
        )}

        {isAdmin && gmailConnections.length > 0 ? (
          <ButtonLink
            href="/api/channels/gmail/authorize"
            variant="ghost"
            size="sm"
          >
            Connect another Gmail account
          </ButtonLink>
        ) : null}
      </div>

      <div className="mt-10">
        <h2 className="text-sm font-medium text-text-secondary">
          More channels
        </h2>
        <p className="mt-1 max-w-lg text-sm text-text-secondary">
          WhatsApp Business, Instagram, Telegram, Facebook Messenger, and
          website chat are coming in future modules.
        </p>
        <div className="mt-3">
          <ConnectChannelModal
            trigger={
              <Button variant="secondary" size="sm">
                See other channels
              </Button>
            }
          />
        </div>
      </div>
    </div>
  );
}
