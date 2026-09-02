import { ButtonLink } from "@/components/ui/Button";

export function FinalCTA() {
  return (
    <section className="border-t border-border bg-surface">
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <h2 className="text-[28px] font-semibold tracking-tight text-text sm:text-[32px]">
          Stop reading every message
        </h2>
        <p className="mx-auto mt-3 max-w-md text-[15px] text-text-secondary">
          Connect a channel and let Signal tell you which conversations
          deserve your attention.
        </p>
        <div className="mt-7">
          <ButtonLink href="/dashboard">Start free</ButtonLink>
        </div>
      </div>
    </section>
  );
}
