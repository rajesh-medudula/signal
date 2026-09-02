import { Mail, MessageCircle, Camera, Send, MessageSquare, Globe } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";

const channels = [
  { name: "Gmail", icon: Mail },
  { name: "WhatsApp Business", icon: MessageCircle },
  { name: "Instagram", icon: Camera },
  { name: "Telegram", icon: Send },
  { name: "Facebook Messenger", icon: MessageSquare },
  { name: "Website chat", icon: Globe },
];

export function Channels() {
  return (
    <section id="channels" className="border-t border-border bg-bg">
      <div className="mx-auto max-w-5xl px-6 py-20">
        <SectionHeading
          title="Connect the channels you already use"
          description="Bring one in first, and add the rest as you go."
        />

        <div className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
          {channels.map(({ name, icon: Icon }) => (
            <div
              key={name}
              className="flex items-center gap-2.5 bg-surface px-4 py-4 text-[14px] text-text"
            >
              <Icon className="h-4 w-4 text-text-secondary" aria-hidden="true" />
              {name}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
