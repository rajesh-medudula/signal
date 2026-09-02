type LogoProps = {
  className?: string;
};

/**
 * A restrained wordmark — no illustrative mark, no serif. The type itself
 * carries the identity, consistent with the rest of the product UI.
 */
export function Logo({ className }: LogoProps) {
  return (
    <span
      className={`text-[15px] font-semibold tracking-tight text-text ${className ?? ""}`}
    >
      Signal
    </span>
  );
}
