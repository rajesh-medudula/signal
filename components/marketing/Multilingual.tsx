import { SectionHeading } from "@/components/ui/SectionHeading";
import { Badge } from "@/components/ui/Badge";

const languages = [
  "English",
  "Hindi",
  "Telugu",
  "Tamil",
  "Hinglish",
  "Telugish",
  "Tanglish",
];

export function Multilingual() {
  return (
    <section className="border-t border-border bg-surface">
      <div className="mx-auto max-w-5xl px-6 py-20">
        <div className="grid gap-10 md:grid-cols-2 md:gap-16">
          <SectionHeading
            title="Built for how your customers actually write"
            description="Real conversations mix languages mid-sentence. Signal is built to understand them as they are, and your dashboard stays in English regardless."
          />

          <div className="flex flex-wrap content-start gap-2">
            {languages.map((language) => (
              <Badge key={language} variant="neutral" className="text-[13px]">
                {language}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
