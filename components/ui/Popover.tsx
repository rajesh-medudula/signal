"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "@/lib/ui/cn";

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;

export function PopoverContent({
  className,
  sideOffset = 6,
  ...props
}: PopoverPrimitive.PopoverContentProps) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          "z-50 w-72 rounded-md border border-border bg-surface p-3 text-sm text-text-secondary shadow-[var(--shadow-elevated)] data-[state=open]:animate-scale-in",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}
