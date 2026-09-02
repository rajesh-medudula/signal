import { Logo } from "@/components/brand/Logo";

export function Footer() {
  return (
    <footer className="border-t border-border bg-bg">
      <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-4 px-6 py-8 text-[13px] text-text-tertiary sm:flex-row sm:items-center">
        <Logo />
        <p>&copy; {new Date().getFullYear()} Signal</p>
      </div>
    </footer>
  );
}
