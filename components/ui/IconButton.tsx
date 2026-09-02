import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/ui/cn";

type Size = "sm" | "md";

const sizes: Record<Size, string> = {
  sm: "h-7 w-7",
  md: "h-8 w-8",
};

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: Size;
  /** Required — icon buttons must always have an accessible name. */
  "aria-label": string;
};

export function IconButton({
  size = "md",
  className,
  ...props
}: IconButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md text-text-secondary transition-colors duration-150 ease-out hover:bg-surface-muted hover:text-text disabled:pointer-events-none disabled:opacity-50",
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
