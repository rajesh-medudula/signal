import { Clock } from "lucide-react";
import { PlaceholderPage } from "@/components/dashboard/PlaceholderPage";

export default function FollowUpsPage() {
  return (
    <PlaceholderPage
      pageTitle="Follow-ups"
      icon={Clock}
      emptyTitle="Nothing waiting on a follow-up"
      emptyBody="Once conversations are flowing in, customers waiting on a reply or due for a check-in will surface here."
    />
  );
}
