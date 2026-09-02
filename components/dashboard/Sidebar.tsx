"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { NavItem } from "@/components/dashboard/NavItem";
import { navItems } from "@/components/dashboard/nav-items";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-surface md:flex">
      <div className="flex h-14 items-center border-b border-border px-4">
        <Link href="/" aria-label="Signal home">
          <Logo />
        </Link>
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
                <NavItem {...item} isActive={isActive} />
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
