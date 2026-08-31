type LogoProps = {
  className?: string;
};

export function Logo({ className }: LogoProps) {
  return (
    <span
      className={`font-display text-xl tracking-tight text-ink ${className ?? ""}`}
    >
      Signal
    </span>
  );
}
