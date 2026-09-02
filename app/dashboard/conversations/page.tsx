import { MessagesSquare } from "lucide-react";
import { PlaceholderPage } from "@/components/dashboard/PlaceholderPage";

export default function ConversationsPage() {
  return (
    <PlaceholderPage
      pageTitle="Conversations"
      icon={MessagesSquare}
      emptyTitle="No customer conversations yet"
      emptyBody="Connect your first channel and Signal will start finding the conversations that deserve your attention."
    />
  );
}
