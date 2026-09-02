import { cn } from "@/lib/ui/cn";

type SectionHeadingProps = {
  title: string;
  description?: string;
  align?: "left" | "center";
  className?: string;
};

export function SectionHeading({
  title,
  description,
  align = "left",
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "max-w-xl",
        align === "center" && "mx-auto text-center",
        className,
      )}
    >
      <h2 className="text-[28px] font-semibold leading-tight tracking-tight text-text sm:text-[32px]">
        {title}
      </h2>
      {description ? (
        <p className="mt-3 text-[15px] leading-relaxed text-text-secondary">
          {description}
        </p>
      ) : null}
    </div>
  );
}
