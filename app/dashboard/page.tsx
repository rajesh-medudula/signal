import { Radio } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConnectChannelModal } from "@/components/dashboard/ConnectChannelModal";
import { Button } from "@/components/ui/Button";
import { timeOfDayGreeting } from "@/lib/ui/greeting";

export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight text-text">
        {timeOfDayGreeting()}
      </h1>

      <div className="mt-6">
        <EmptyState
          icon={Radio}
          title="Nothing needs your attention yet"
          body="Your customer intelligence will appear here once a communication channel is connected."
          action={
            <ConnectChannelModal
              trigger={<Button size="sm">Connect a channel</Button>}
            />
          }
        />
      </div>
    </div>
  );
}
