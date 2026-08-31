import { EmptyState } from "@/components/dashboard/EmptyState";
import { timeOfDayGreeting } from "@/lib/ui/greeting";

export default function DashboardPage() {
  return (
    <div>
      <h1 className="font-display text-3xl text-ink">
        {timeOfDayGreeting()}
      </h1>

      <div className="mt-8">
        <EmptyState
          title="Nothing needs your attention yet"
          body="Your customer intelligence will appear here once a communication channel is connected."
          actionLabel="Connect a channel"
          actionHref="/dashboard/channels"
        />
      </div>
    </div>
  );
}
