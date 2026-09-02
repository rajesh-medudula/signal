import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";
import { Card } from "@/components/ui/Card";

type AuthShellProps = {
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
};

export function AuthShell({
  title,
  description,
  children,
  footer,
}: AuthShellProps) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-16">
      <Link href="/" aria-label="Signal home" className="mb-8">
        <Logo />
      </Link>

      <Card className="w-full max-w-sm">
        <h1 className="text-lg font-semibold tracking-tight text-text">
          {title}
        </h1>
        <p className="mt-1 text-[13px] text-text-secondary">{description}</p>

        <div className="mt-6">{children}</div>
      </Card>

      <p className="mt-5 text-[13px] text-text-secondary">{footer}</p>
    </div>
  );
}
