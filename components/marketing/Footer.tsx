import { Logo } from "@/components/brand/Logo";

export function Footer() {
  return (
    <footer className="border-t border-rule">
      <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-4 px-6 py-10 text-sm text-slate sm:flex-row sm:items-center">
        <Logo className="text-base" />
        <p>Built for teams who&apos;d rather act than read.</p>
        <p>&copy; {new Date().getFullYear()} Signal</p>
      </div>
    </footer>
  );
}
