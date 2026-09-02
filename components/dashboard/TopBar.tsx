import { MobileNav } from "@/components/dashboard/MobileNav";
import { AccountMenu } from "@/components/dashboard/AccountMenu";

type TopBarProps = {
  userEmail: string;
};

export function TopBar({ userEmail }: TopBarProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-surface px-4 md:px-6">
      <div className="flex items-center gap-3">
        <MobileNav />
        {/* Business/workspace name resolution lands with membership in
            a future module; this is a placeholder until then. */}
        <span className="text-sm text-text-secondary">Your business</span>
      </div>
      <AccountMenu userEmail={userEmail} />
    </header>
  );
}
