import { Plug, ScanSearch, ListChecks } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";

const steps = [
  {
    number: "1",
    icon: Plug,
    title: "Connect a channel",
    body: "Link the inbox your customers already use — Gmail, WhatsApp, Instagram, and more, one at a time.",
  },
  {
    number: "2",
    icon: ScanSearch,
    title: "Signal reads every conversation",
    body: "Every message gets sorted by what it actually needs — a reply, a follow-up, or nothing at all.",
  },
  {
    number: "3",
    icon: ListChecks,
    title: "You see what matters",
    body: "Open your dashboard to the handful of conversations worth your time, not the full inbox.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="border-t border-border bg-surface">
      <div className="mx-auto max-w-5xl px-6 py-20">
        <SectionHeading
          title="From a full inbox to a short list"
          align="center"
          className="mx-auto"
        />

        <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
          {steps.map((step) => (
            <li key={step.number} className="flex flex-col items-start">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-surface-muted">
                <step.icon className="h-4 w-4 text-text-secondary" aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-[15px] font-semibold text-text">
                {step.number}. {step.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
