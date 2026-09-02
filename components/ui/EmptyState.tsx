import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: ReactNode;
};

/** A contextual, action-oriented empty state — never just "nothing here yet". */
export function EmptyState({ icon: Icon, title, body, action }: EmptyStateProps) {
  return (
    <div className="flex max-w-md flex-col items-start rounded-lg border border-border bg-surface px-6 py-8">
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-surface-muted">
        <Icon className="h-5 w-5 text-text-secondary" aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-[15px] font-semibold text-text">{title}</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
