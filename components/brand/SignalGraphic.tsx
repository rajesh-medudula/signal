const noiseDots: { cx: number; cy: number; r: number; opacity: number }[] = [
  { cx: 26, cy: 74, r: 3.5, opacity: 0.55 },
  { cx: 52, cy: 40, r: 2.5, opacity: 0.4 },
  { cx: 44, cy: 132, r: 4, opacity: 0.5 },
  { cx: 78, cy: 96, r: 2.5, opacity: 0.6 },
  { cx: 30, cy: 168, r: 3, opacity: 0.35 },
  { cx: 92, cy: 54, r: 3.5, opacity: 0.45 },
  { cx: 108, cy: 150, r: 2.5, opacity: 0.55 },
  { cx: 64, cy: 190, r: 3, opacity: 0.4 },
  { cx: 122, cy: 84, r: 4, opacity: 0.5 },
  { cx: 18, cy: 118, r: 2, opacity: 0.5 },
  { cx: 138, cy: 128, r: 3, opacity: 0.4 },
  { cx: 96, cy: 210, r: 2.5, opacity: 0.35 },
  { cx: 150, cy: 60, r: 2.5, opacity: 0.4 },
  { cx: 40, cy: 226, r: 3, opacity: 0.3 },
  { cx: 116, cy: 200, r: 2, opacity: 0.4 },
  { cx: 160, cy: 170, r: 3, opacity: 0.35 },
];

const threads = [
  "M26,74 C90,90 150,150 196,152",
  "M78,96 C120,110 160,140 196,150",
  "M44,132 C100,140 150,150 196,150",
  "M108,150 C140,150 170,150 196,150",
  "M92,54 C130,90 170,130 196,148",
];

/**
 * The brand's signature moment: many scattered signals (a noisy inbox)
 * resolve into a single clean line with one point of attention. Used once,
 * on the marketing hero — not repeated as decoration elsewhere.
 */
export function SignalGraphic({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 460 260"
      className={className}
      role="img"
      aria-label="Scattered customer messages resolving into a single, clear signal"
    >
      <g stroke="var(--color-noise)" strokeWidth="1" fill="none" opacity="0.5">
        {threads.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>

      <g fill="var(--color-noise)">
        {noiseDots.map((d, i) => (
          <circle key={i} cx={d.cx} cy={d.cy} r={d.r} opacity={d.opacity} />
        ))}
      </g>

      <line
        x1="196"
        y1="150"
        x2="430"
        y2="150"
        stroke="var(--color-ink)"
        strokeWidth="1.5"
      />

      <circle cx="196" cy="150" r="3" fill="var(--color-ink)" />

      <circle cx="336" cy="150" r="7" fill="var(--color-signal-tint)" />
      <circle
        cx="336"
        cy="150"
        r="5"
        fill="var(--color-signal)"
        stroke="var(--color-signal-deep)"
        strokeWidth="1"
      >
        <animate
          attributeName="r"
          values="5;6;5"
          dur="2.6s"
          repeatCount="indefinite"
        />
      </circle>
    </svg>
  );
}
