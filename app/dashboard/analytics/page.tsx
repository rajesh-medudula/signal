import { BarChart3 } from "lucide-react";
import { PlaceholderPage } from "@/components/dashboard/PlaceholderPage";

export default function AnalyticsPage() {
  return (
    <PlaceholderPage
      pageTitle="Analytics"
      icon={BarChart3}
      emptyTitle="No analytics yet"
      emptyBody="Trends across your conversations — volume, response time, intent, and outcomes — will appear here once you're connected."
    />
  );
}
