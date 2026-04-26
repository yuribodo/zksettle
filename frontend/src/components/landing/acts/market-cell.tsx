"use client";

import { type CSSProperties } from "react";

import { type Market } from "@/content/copy";

const DASH_PATTERN = "8 6";
const BORDER_RX = 8;
const BRACKET_LEN = 12;

export function MarketCell({
  market,
  index,
  total,
}: {
  market: Market;
  index: number;
  total: number;
}) {
  return (
    <div
      data-markets-cell
      className="group relative isolate min-h-[220px] overflow-hidden rounded-[8px] p-6"
    >
      {/* Background tint layer (used by hover later) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[8px] bg-forest/0 transition-colors duration-200"
        data-cell-tint
      />

      {/* SVG border. width/height as % work on rect; vectorEffect keeps the stroke 1px regardless of SVG scaling. */}
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full"
        preserveAspectRatio="none"
      >
        <rect
          data-cell-border-dashed
          x="0"
          y="0"
          width="100%"
          height="100%"
          rx={BORDER_RX}
          ry={BORDER_RX}
          fill="none"
          stroke="rgb(12 61 46 / 0.55)"
          strokeWidth="1"
          strokeDasharray={DASH_PATTERN}
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* Corner brackets — 4 separate SVGs, each positioned with top/right/bottom/left
          (NOT transform:translate(100%,...) — CSS % in translate is self-relative, would break alignment). */}
      <CornerBracket position="tl" />
      <CornerBracket position="tr" />
      <CornerBracket position="bl" />
      <CornerBracket position="br" />

      {/* Content */}
      <div className="relative flex h-full min-h-[180px] flex-col">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] tabular-nums text-canvas/45">
          {String(index + 1).padStart(2, "0")}/{String(total).padStart(2, "0")}
        </p>

        <div className="mt-auto">
          <p className="font-display text-2xl text-canvas md:text-3xl" data-cell-name>
            {market.name}
          </p>

          <div
            className="mt-3 overflow-hidden"
            data-cell-descriptor-wrap
            style={{ height: 0, opacity: 0 }}
          >
            <div
              aria-hidden
              className="mb-2 h-px w-full"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(to right, rgba(250,250,247,0.45) 0 4px, transparent 4px 8px)",
              }}
            />
            <p className="font-mono text-[12px] leading-snug text-canvas/65">
              {market.descriptor}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

type CornerPosition = "tl" | "tr" | "bl" | "br";

const CORNER_POSITION_STYLE: Record<CornerPosition, CSSProperties> = {
  tl: { top: 6, left: 6, transform: "none" },
  tr: { top: 6, right: 6, transform: "scaleX(-1)" },
  bl: { bottom: 6, left: 6, transform: "scaleY(-1)" },
  br: { bottom: 6, right: 6, transform: "scale(-1, -1)" },
};

function CornerBracket({ position }: { position: CornerPosition }) {
  const positionStyle = CORNER_POSITION_STYLE[position];

  return (
    <svg
      aria-hidden
      width={BRACKET_LEN}
      height={BRACKET_LEN}
      className="pointer-events-none absolute"
      style={{ ...positionStyle, transformOrigin: "center" }}
    >
      <path
        data-cell-bracket
        d={`M 0 0 L ${BRACKET_LEN} 0 M 0 0 L 0 ${BRACKET_LEN}`}
        stroke="rgb(12 61 46 / 0.65)"
        strokeWidth="1"
        fill="none"
        strokeLinecap="square"
      />
    </svg>
  );
}
