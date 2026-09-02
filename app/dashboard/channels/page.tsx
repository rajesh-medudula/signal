import { Plug } from "lucide-react";
import { PlaceholderPage } from "@/components/dashboard/PlaceholderPage";

export default function ChannelsPage() {
  return (
    <PlaceholderPage
      pageTitle="Channels"
      icon={Plug}
      emptyTitle="No channels connected"
      emptyBody="Connect Gmail, WhatsApp Business, Instagram, Telegram, Facebook Messenger, or your website chat to start bringing conversations into Signal."
    />
  );
}
