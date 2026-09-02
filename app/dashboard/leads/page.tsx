import { Target } from "lucide-react";
import { PlaceholderPage } from "@/components/dashboard/PlaceholderPage";

export default function LeadsPage() {
  return (
    <PlaceholderPage
      pageTitle="Leads"
      icon={Target}
      emptyTitle="No leads scored yet"
      emptyBody="Connect a channel and Signal will identify which conversations are sales opportunities, ranked by how likely they are to close."
    />
  );
}
