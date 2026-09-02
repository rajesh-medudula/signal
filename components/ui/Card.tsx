import type { HTMLAttributes } from "react";
import { cn } from "@/lib/ui/cn";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  padded?: boolean;
};

/** A plain information container — a border and a surface, not a decoration. */
export function Card({ padded = true, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface",
        padded && "p-5",
        className,
      )}
      {...props}
    />
  );
}
