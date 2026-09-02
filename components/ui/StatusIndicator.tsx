import { cn } from "@/lib/ui/cn";

type Tone = "neutral" | "success" | "warning" | "danger" | "info";

const dotTones: Record<Tone, string> = {
  neutral: "bg-text-tertiary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
};

type StatusIndicatorProps = {
  tone?: Tone;
  label: string;
  className?: string;
};

/** A dot + label pairing for connection/record state — not a decoration. */
export function StatusIndicator({
  tone = "neutral",
  label,
  className,
}: StatusIndicatorProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[13px] text-text-secondary",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn("h-1.5 w-1.5 rounded-full", dotTones[tone])}
      />
      {label}
    </span>
  );
}
