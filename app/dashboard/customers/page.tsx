import { Users } from "lucide-react";
import { PlaceholderPage } from "@/components/dashboard/PlaceholderPage";

export default function CustomersPage() {
  return (
    <PlaceholderPage
      pageTitle="Customers"
      icon={Users}
      emptyTitle="No customer records yet"
      emptyBody="Once a channel is connected, Signal builds a record for each customer from their conversations across every channel they use."
    />
  );
}
