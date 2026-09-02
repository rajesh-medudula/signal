"use client";

import Link from "next/link";
import { Settings } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";

/**
 * Placeholder account menu. There's no real account/session yet — this
 * demonstrates where it will live and keeps the trigger itself honest
 * (no name, no avatar image) rather than inventing a fake signed-in user.
 */
export function AccountMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Account menu"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-muted text-[13px] font-medium text-text-secondary transition-colors duration-150 ease-out hover:bg-border"
        >
          ?
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Your business</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href="/dashboard/settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" aria-hidden="true" />
            Settings
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
