import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/ui/cn";

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-20 w-full resize-y rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-tertiary transition-colors duration-150 ease-out focus-visible:border-accent disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-tertiary",
        className,
      )}
      {...props}
    />
  );
}
