import Link from "next/link";

type EmptyStateProps = {
  title: string;
  body: string;
  actionLabel?: string;
  actionHref?: string;
};

export function EmptyState({
  title,
  body,
  actionLabel,
  actionHref,
}: EmptyStateProps) {
  return (
    <div className="max-w-md rounded-lg border border-rule bg-paper-dim px-8 py-10">
      <h2 className="font-display text-2xl text-ink">{title}</h2>
      <p className="mt-3 text-sm leading-relaxed text-slate">{body}</p>
      {actionLabel && actionHref ? (
        <Link
          href={actionHref}
          className="mt-6 inline-flex items-center justify-center rounded-md bg-ink px-5 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-ink-soft"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
