import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui/Button";

export function Nav() {
  return (
    <header className="border-b border-rule">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <Link href="/" aria-label="Signal home">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-8 text-sm text-ink-soft md:flex">
          <a href="#how-it-works" className="hover:text-ink">
            How it works
          </a>
          <a href="#channels" className="hover:text-ink">
            Channels
          </a>
        </nav>

        <div className="flex items-center gap-5 text-sm">
          <Link href="/dashboard" className="hidden text-ink-soft hover:text-ink sm:inline">
            Sign in
          </Link>
          <ButtonLink href="/dashboard">Get Started</ButtonLink>
        </div>
      </div>
    </header>
  );
}
