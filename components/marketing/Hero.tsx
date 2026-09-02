import { ButtonLink } from "@/components/ui/Button";

export function Hero() {
  return (
    <section className="mx-auto max-w-3xl px-6 pb-14 pt-16 text-center md:pt-24">
      <h1 className="text-[40px] font-semibold leading-[1.15] tracking-tight text-text sm:text-5xl">
        Customer conversations are noisy. Your best opportunities
        shouldn&apos;t be.
      </h1>
      <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-text-secondary">
        Signal analyzes your customer conversations, prioritizes the people
        most likely to buy, and tells you what to do next.
      </p>
      <div className="mt-8 flex items-center justify-center gap-3">
        <ButtonLink href="/sign-up">Start free</ButtonLink>
        <ButtonLink href="#how-it-works" variant="secondary">
          See how it works
        </ButtonLink>
      </div>
    </section>
  );
}
