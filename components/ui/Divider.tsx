import { cn } from "@/lib/ui/cn";

type DividerProps = {
  orientation?: "horizontal" | "vertical";
  className?: string;
};

export function Divider({ orientation = "horizontal", className }: DividerProps) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={cn(
        orientation === "horizontal"
          ? "h-px w-full bg-border"
          : "h-full w-px bg-border",
        className,
      )}
    />
  );
}
