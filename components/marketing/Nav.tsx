import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui/Button";

const links = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#capabilities", label: "AI capabilities" },
  { href: "#channels", label: "Channels" },
];

export function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link href="/" aria-label="Signal home">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-7 text-[13px] text-text-secondary md:flex">
          {links.map((link) => (
            <a key={link.href} href={link.href} className="hover:text-text">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="hidden text-[13px] text-text-secondary hover:text-text sm:inline"
          >
            Sign in
          </Link>
          <ButtonLink href="/dashboard" size="sm">
            Start free
          </ButtonLink>
        </div>
      </div>
    </header>
  );
}
