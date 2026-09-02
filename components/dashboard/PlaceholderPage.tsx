import type { LucideIcon } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConnectChannelModal } from "@/components/dashboard/ConnectChannelModal";
import { Button } from "@/components/ui/Button";

type PlaceholderPageProps = {
  pageTitle: string;
  icon: LucideIcon;
  emptyTitle: string;
  emptyBody: string;
  /** Most sections are gated on connecting a channel; a few aren't. */
  showConnectAction?: boolean;
};

export function PlaceholderPage({
  pageTitle,
  icon,
  emptyTitle,
  emptyBody,
  showConnectAction = true,
}: PlaceholderPageProps) {
  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight text-text">
        {pageTitle}
      </h1>
      <div className="mt-6">
        <EmptyState
          icon={icon}
          title={emptyTitle}
          body={emptyBody}
          action={
            showConnectAction ? (
              <ConnectChannelModal
                trigger={<Button size="sm">Connect a channel</Button>}
              />
            ) : undefined
          }
        />
      </div>
    </div>
  );
}
