import { MobileNav } from "@/components/dashboard/MobileNav";
import { AccountMenu } from "@/components/dashboard/AccountMenu";

type TopBarProps = {
  userEmail: string;
  businessName: string;
};

export function TopBar({ userEmail, businessName }: TopBarProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-surface px-4 md:px-6">
      <div className="flex items-center gap-3">
        <MobileNav />
        <span className="text-sm text-text-secondary">{businessName}</span>
      </div>
      <AccountMenu userEmail={userEmail} />
    </header>
  );
}
