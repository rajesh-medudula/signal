"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Logo } from "@/components/brand/Logo";
import { NavItem } from "@/components/dashboard/NavItem";
import { navItems } from "@/components/dashboard/nav-items";
import { IconButton } from "@/components/ui/IconButton";

/** Slide-over navigation drawer for narrow viewports, built on Radix Dialog
 * so it gets focus trapping, escape-to-close, and outside-click for free. */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <IconButton aria-label="Open navigation" className="md:hidden">
          <Menu className="h-5 w-5" aria-hidden="true" />
        </IconButton>
      </DialogPrimitive.Trigger>

      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-text/40 data-[state=open]:animate-fade-in md:hidden" />
        <DialogPrimitive.Content
          className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[80vw] flex-col border-r border-border bg-surface data-[state=open]:animate-[signal-drawer-in_var(--duration-slow)_var(--ease-out)] md:hidden"
        >
          <DialogPrimitive.Title className="sr-only">
            Navigation
          </DialogPrimitive.Title>
          <div className="flex h-14 items-center border-b border-border px-4">
            <Logo />
          </div>
          <nav className="flex-1 px-2 py-3">
            <ul className="flex flex-col gap-0.5">
              {navItems.map((item) => {
                const isActive =
                  item.href === "/dashboard"
                    ? pathname === item.href
                    : pathname.startsWith(item.href);

                return (
                  <li key={item.href}>
                    <NavItem
                      {...item}
                      isActive={isActive}
                      onNavigate={() => setOpen(false)}
                    />
                  </li>
                );
              })}
            </ul>
          </nav>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
