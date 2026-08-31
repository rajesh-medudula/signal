const steps = [
  {
    number: "1",
    title: "Connect a channel",
    body: "Link the inbox your customers already use — Gmail, WhatsApp, Instagram, and more, one at a time.",
  },
  {
    number: "2",
    title: "Signal reads every conversation",
    body: "Every message gets sorted by what it actually needs — a reply, a follow-up, or nothing at all.",
  },
  {
    number: "3",
    title: "You see what matters",
    body: "Open your dashboard to the handful of conversations worth your time, not the full inbox.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="border-t border-rule bg-paper-dim">
      <div className="mx-auto max-w-5xl px-6 py-20">
        <h2 className="max-w-md font-display text-3xl text-ink">
          From a full inbox to a short list
        </h2>

        <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
          {steps.map((step) => (
            <li key={step.number}>
              <span className="font-display text-2xl text-signal-deep">
                {step.number}
              </span>
              <h3 className="mt-3 text-base font-medium text-ink">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
