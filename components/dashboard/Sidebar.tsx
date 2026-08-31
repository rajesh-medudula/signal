"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/Logo";

const navItems = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Conversations", href: "/dashboard/conversations" },
  { label: "Customers", href: "/dashboard/customers" },
  { label: "Leads", href: "/dashboard/leads" },
  { label: "Follow-ups", href: "/dashboard/follow-ups" },
  { label: "Analytics", href: "/dashboard/analytics" },
  { label: "Channels", href: "/dashboard/channels" },
  { label: "Settings", href: "/dashboard/settings" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-rule bg-paper-dim">
      <div className="border-b border-rule px-6 py-5">
        <Link href="/" aria-label="Signal home">
          <Logo />
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4">
        <ul className="flex flex-col gap-0.5">
          {navItems.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === item.href
                : pathname.startsWith(item.href);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`block rounded-md px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? "bg-ink text-paper"
                      : "text-ink-soft hover:bg-paper hover:text-ink"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
