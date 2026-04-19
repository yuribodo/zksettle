import type { CSSProperties } from "react";

export type LogoVariant = "canvas-ink" | "surface-forest" | "forest-surface";

export type LogoProps = {
  variant?: LogoVariant;
  size?: number;
  showWordmark?: boolean;
  className?: string;
};

const VARIANT_CLASSES: Record<LogoVariant, { seal: string; wordmark: string }> = {
  "canvas-ink": { seal: "text-ink", wordmark: "text-ink" },
  "surface-forest": { seal: "text-forest", wordmark: "text-ink" },
  "forest-surface": { seal: "text-surface", wordmark: "text-surface" },
};

export function Logo({
  variant = "canvas-ink",
  size = 48,
  showWordmark = true,
  className,
}: LogoProps) {
  const tokens = VARIANT_CLASSES[variant];
  const gap = size * 0.4;
  const wordmarkFontSize = size * 0.5;

  const containerClass = ["inline-flex items-center align-middle", className]
    .filter(Boolean)
    .join(" ");

  const wordmarkStyle: CSSProperties = {
    fontSize: `${wordmarkFontSize}px`,
    letterSpacing: "-0.01em",
  };

  return (
    <span
      className={containerClass}
      style={{ gap: `${gap}px` }}
      role={showWordmark ? undefined : "img"}
      aria-label={showWordmark ? undefined : "ZKSettle"}
    >
      <Seal size={size} className={tokens.seal} />
      {showWordmark ? (
        <span
          aria-hidden={false}
          className={`font-display font-normal leading-none ${tokens.wordmark}`}
          style={wordmarkStyle}
        >
          ZKSettle
        </span>
      ) : null}
    </span>
  );
}

function Seal({ size, className }: { size: number; className: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={className}
      shapeRendering="geometricPrecision"
    >
      <circle cx="24" cy="24" r="22" stroke="currentColor" strokeWidth="1.25" />
      <text
        x="24"
        y="24"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="26"
        fontStyle="normal"
        fontWeight="400"
        fill="currentColor"
      >
        Z
      </text>
      <line
        x1="10.5"
        y1="24"
        x2="37.5"
        y2="24"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="butt"
      />
      <line x1="24" y1="0.5" x2="24" y2="3.5" stroke="currentColor" strokeWidth="1.25" />
      <line x1="47.5" y1="24" x2="44.5" y2="24" stroke="currentColor" strokeWidth="1.25" />
      <line x1="24" y1="47.5" x2="24" y2="44.5" stroke="currentColor" strokeWidth="1.25" />
      <line x1="0.5" y1="24" x2="3.5" y2="24" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}
