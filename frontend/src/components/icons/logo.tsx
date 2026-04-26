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
  const gap = size * 0.36;
  const wordmarkFontSize = size * 0.52;

  const containerClass = ["inline-flex items-center align-middle", className]
    .filter(Boolean)
    .join(" ");

  const wordmarkStyle: CSSProperties = {
    fontSize: `${wordmarkFontSize}px`,
    letterSpacing: "-0.025em",
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
          className={`font-display font-normal leading-[0.92] ${tokens.wordmark}`}
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
      <rect
        x="6"
        y="6"
        width="36"
        height="36"
        rx="9"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M15 16H32.5L15 32H33"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      <path
        d="M18 24H30"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="square"
        opacity="0.45"
      />
      <circle cx="15" cy="16" r="2" fill="currentColor" />
      <circle cx="33" cy="32" r="2" fill="currentColor" />
    </svg>
  );
}
