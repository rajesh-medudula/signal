import {
  Target,
  FileText,
  Compass,
  MessageSquareText,
  Bell,
  Radar,
} from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";

const capabilities = [
  {
    icon: Radar,
    title: "Find the opportunities",
    body: "Identify which conversations are worth acting on, out of everything coming in.",
  },
  {
    icon: FileText,
    title: "Summarize customer needs",
    body: "Turn a long back-and-forth into a short, readable summary of what the customer wants.",
  },
  {
    icon: Target,
    title: "Determine intent",
    body: "Tell the difference between a serious buyer, a question, and a complaint.",
  },
  {
    icon: Compass,
    title: "Recommend next actions",
    body: "See exactly what to do next for each conversation, not just that it needs attention.",
  },
  {
    icon: MessageSquareText,
    title: "Draft suggested replies",
    body: "Start from a reply Signal has already drafted, in the right tone and language.",
  },
  {
    icon: Bell,
    title: "Flag follow-ups",
    body: "Catch conversations that have gone quiet before the customer moves on.",
  },
];

export function AICapabilities() {
  return (
    <section id="capabilities" className="border-t border-border bg-bg">
      <div className="mx-auto max-w-5xl px-6 py-20">
        <SectionHeading
          title="What Signal does with every conversation"
          description="These capabilities are part of the Signal roadmap and will roll out as the product is built."
        />

        <div className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {capabilities.map((capability) => (
            <div key={capability.title}>
              <capability.icon
                className="h-5 w-5 text-accent"
                aria-hidden="true"
              />
              <h3 className="mt-3 text-[15px] font-semibold text-text">
                {capability.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
                {capability.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
