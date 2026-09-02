"use client";

import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/ui/cn";

export const DropdownMenu = DropdownPrimitive.Root;
export const DropdownMenuTrigger = DropdownPrimitive.Trigger;

export function DropdownMenuContent({
  className,
  sideOffset = 6,
  ...props
}: DropdownPrimitive.DropdownMenuContentProps) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-[180px] overflow-hidden rounded-md border border-border bg-surface p-1 shadow-[var(--shadow-elevated)] data-[state=open]:animate-scale-in",
          className,
        )}
        {...props}
      />
    </DropdownPrimitive.Portal>
  );
}

export function DropdownMenuItem({
  className,
  ...props
}: DropdownPrimitive.DropdownMenuItemProps) {
  return (
    <DropdownPrimitive.Item
      className={cn(
        "flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-text outline-none data-[highlighted]:bg-surface-muted data-[disabled]:pointer-events-none data-[disabled]:text-text-tertiary",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({
  className,
  ...props
}: DropdownPrimitive.DropdownMenuSeparatorProps) {
  return (
    <DropdownPrimitive.Separator
      className={cn("my-1 h-px bg-border", className)}
      {...props}
    />
  );
}

export function DropdownMenuLabel({
  className,
  ...props
}: DropdownPrimitive.DropdownMenuLabelProps) {
  return (
    <DropdownPrimitive.Label
      className={cn(
        "px-2 py-1.5 text-[12px] font-medium text-text-tertiary",
        className,
      )}
      {...props}
    />
  );
}
