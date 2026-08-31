import { ButtonLink } from "@/components/ui/Button";
import { SignalGraphic } from "@/components/brand/SignalGraphic";

export function Hero() {
  return (
    <section className="mx-auto grid max-w-5xl items-center gap-12 px-6 py-20 md:grid-cols-2 md:py-28">
      <div>
        <h1 className="max-w-md font-display text-5xl leading-[1.08] text-ink md:text-6xl">
          Don&apos;t read every customer message.
        </h1>
        <p className="mt-6 max-w-sm text-lg leading-relaxed text-ink-soft">
          Signal analyzes your customer conversations and helps you focus on
          the opportunities that deserve your attention.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-6">
          <ButtonLink href="/dashboard">Get Started</ButtonLink>
          <ButtonLink href="#how-it-works" variant="secondary">
            See how it works
          </ButtonLink>
        </div>
      </div>

      <SignalGraphic className="w-full max-w-md justify-self-center md:justify-self-end" />
    </section>
  );
}
