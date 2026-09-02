import type { ReactNode } from "react";
import { cn } from "@/lib/ui/cn";

type MetricProps = {
  value: string;
  label: string;
  sublabel?: string;
  tone?: "default" | "accent";
  className?: string;
  /** Optional trailing element, e.g. an info disclosure. */
  trailing?: ReactNode;
};

/**
 * A number-first business-intelligence readout — e.g. a priority score.
 * Deliberately plain: a large tabular number, a label, done.
 */
export function Metric({
  value,
  label,
  sublabel,
  tone = "default",
  className,
  trailing,
}: MetricProps) {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div>
        <div
          className={cn(
            "font-mono text-2xl font-medium tabular-nums leading-none",
            tone === "accent" ? "text-accent" : "text-text",
          )}
        >
          {value}
        </div>
        <div className="mt-1.5 text-[13px] text-text-secondary">{label}</div>
        {sublabel ? (
          <div className="mt-0.5 text-[12px] text-text-tertiary">{sublabel}</div>
        ) : null}
      </div>
      {trailing}
    </div>
  );
}
