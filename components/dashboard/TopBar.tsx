export function TopBar() {
  return (
    <header className="flex items-center justify-between border-b border-rule px-8 py-4">
      <span className="text-sm text-slate">Your business</span>
      <div
        className="h-8 w-8 rounded-full bg-paper-dim"
        aria-label="Account menu placeholder"
      />
    </header>
  );
}
