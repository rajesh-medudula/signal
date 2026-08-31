import Link from "next/link";
import type { ComponentProps } from "react";

type Variant = "primary" | "secondary";

const base =
  "inline-flex items-center justify-center rounded-md px-5 py-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-paper hover:bg-ink-soft",
  secondary: "text-ink hover:text-slate",
};

type ButtonLinkProps = ComponentProps<typeof Link> & {
  variant?: Variant;
};

export function ButtonLink({
  variant = "primary",
  className,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={`${base} ${variants[variant]} ${className ?? ""}`}
      {...props}
    />
  );
}
