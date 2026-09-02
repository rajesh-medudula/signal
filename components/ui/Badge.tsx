import type { HTMLAttributes } from "react";
import { cn } from "@/lib/ui/cn";

type Variant = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

const variants: Record<Variant, string> = {
  neutral: "bg-surface-muted text-text-secondary",
  accent: "bg-accent-tint text-accent",
  success: "bg-success-tint text-success",
  warning: "bg-warning-tint text-warning",
  danger: "bg-danger-tint text-danger",
  info: "bg-info-tint text-info",
};

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: Variant;
};

export function Badge({ variant = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-2 py-0.5 text-[12px] font-medium leading-5",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
