import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/ui/cn";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-text placeholder:text-text-tertiary transition-colors duration-150 ease-out focus-visible:border-accent disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-tertiary",
        className,
      )}
      {...props}
    />
  );
}
