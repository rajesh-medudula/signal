"use client";

import { MessageCircle, Camera, Send, MessageSquare, Globe } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal, ModalContent, ModalTitle, ModalDescription, ModalTrigger } from "@/components/ui/Modal";
import { StatusIndicator } from "@/components/ui/StatusIndicator";
import { Divider } from "@/components/ui/Divider";
import type { ReactNode } from "react";

const channels = [
  { name: "WhatsApp Business", icon: MessageCircle },
  { name: "Instagram", icon: Camera },
  { name: "Telegram", icon: Send },
  { name: "Facebook Messenger", icon: MessageSquare },
  { name: "Website chat", icon: Globe },
];

type ConnectChannelModalProps = {
  trigger: ReactNode;
};

/**
 * Honest placeholder for every channel except Gmail: none of these
 * actually connect yet. Gmail has its own real connect/reconnect/
 * disconnect flow (GmailConnectionCard on the Channels page as of
 * Module 4) and is deliberately left out of this list — surfacing it
 * here too would just be a second, non-functional path to the same
 * thing.
 */
export function ConnectChannelModal({ trigger }: ConnectChannelModalProps) {
  return (
    <Modal>
      <ModalTrigger asChild>{trigger}</ModalTrigger>
      <ModalContent>
        <ModalTitle>Connect a channel</ModalTitle>
        <ModalDescription>
          These channels aren&apos;t available yet. This is where
          you&apos;ll link the inbox your customers write to.
        </ModalDescription>

        <div className="mt-4">
          <Divider />
          <ul className="mt-1">
            {channels.map(({ name, icon: Icon }, index) => (
              <li key={name}>
                <div className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4 text-text-secondary" aria-hidden="true" />
                    <span className="text-sm text-text">{name}</span>
                  </div>
                  <StatusIndicator tone="neutral" label="Not available yet" />
                </div>
                {index < channels.length - 1 ? <Divider /> : null}
              </li>
            ))}
          </ul>
        </div>

        <Button variant="secondary" className="mt-2 w-full" disabled>
          Coming in a future module
        </Button>
      </ModalContent>
    </Modal>
  );
}
