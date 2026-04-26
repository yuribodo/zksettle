"use client";

import { type CSSProperties } from "react";

import { type Market } from "@/content/copy";
import { cn } from "@/lib/cn";

const DASH_PATTERN = "8 6";
const STROKE_IDLE = "color-mix(in srgb, var(--color-forest) 34%, transparent)";
const STROKE_HOVER = "var(--color-forest)";
const BORDER_RX = 8;
const BRACKET_LEN = 12;

type CornerPosition = "tl" | "tr" | "bl" | "br";

const CORNER_POSITION_STYLE: Record<CornerPosition, CSSProperties> = {
  tl: { top: 6, left: 6, transform: "none" },
  tr: { top: 6, right: 6, transform: "scaleX(-1)" },
  bl: { bottom: 6, left: 6, transform: "scaleY(-1)" },
  br: { bottom: 6, right: 6, transform: "scale(-1, -1)" },
};

export function MarketCell({
  market,
  index,
  total,
  isDimmed,
  onHoverChange,
}: {
  market: Market;
  index: number;
  total: number;
  isDimmed: boolean;
  onHoverChange: (hovering: boolean) => void;
}) {
  return (
    <div
      data-markets-cell
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
      className={cn(
        "group relative isolate min-h-[168px] overflow-hidden rounded-[8px] bg-surface/45 p-5 transition-opacity duration-200 lg:min-h-[154px]",
        isDimmed ? "opacity-60" : "opacity-100",
      )}
    >
      {/* Tint layer — fades in on hover (delay 100ms) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[8px] bg-surface-deep/0 transition-colors duration-200 group-hover:bg-surface-deep/80"
        style={{ transitionDelay: "100ms" }}
      />

      {/* Border layer — TWO rects stacked. Dashed is visible at idle; solid fades in on hover. */}
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full"
        preserveAspectRatio="none"
      >
        {/* Dashed (idle) — fades to invisible on hover */}
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          rx={BORDER_RX}
          ry={BORDER_RX}
          fill="none"
          stroke={STROKE_IDLE}
          strokeWidth="1"
          strokeDasharray={DASH_PATTERN}
          vectorEffect="non-scaling-stroke"
          className="opacity-100 transition-opacity duration-200 group-hover:opacity-0"
        />
        {/* Solid (hover) — fades in on hover, slightly delayed */}
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          rx={BORDER_RX}
          ry={BORDER_RX}
          fill="none"
          stroke={STROKE_HOVER}
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
          className="opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        />
      </svg>

      {/* Corner brackets — color shifts on hover (delay 50ms) */}
      <CornerBracket position="tl" />
      <CornerBracket position="tr" />
      <CornerBracket position="bl" />
      <CornerBracket position="br" />

      {/* Content */}
      <div className="relative flex h-full min-h-[128px] flex-col lg:min-h-[114px]">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] tabular-nums text-stone">
          {String(index + 1).padStart(2, "0")}/{String(total).padStart(2, "0")}
        </p>

        <div className="mt-auto">
          <p className="font-display text-[1.45rem] leading-none text-ink md:text-[1.7rem]">
            {market.name}
          </p>

          {/*
            Descriptor reveal uses the grid-rows trick:
            grid-rows-[0fr] → group-hover:grid-rows-[1fr] animates intrinsic height.
            Inner div has overflow-hidden so content clips during animation.
          */}
          <div
            className="mt-2 grid grid-rows-[0fr] opacity-0 transition-[grid-template-rows,opacity] duration-200 ease-out group-hover:grid-rows-[1fr] group-hover:opacity-100"
            style={{ transitionDelay: "150ms" }}
          >
            <div className="overflow-hidden">
              <div
                aria-hidden
                className="mb-2 h-px w-full"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(to right, color-mix(in srgb, var(--color-forest) 36%, transparent) 0 4px, transparent 4px 8px)",
                }}
              />
              <p className="font-mono text-[11px] leading-snug text-quill">
                {market.descriptor}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CornerBracket({ position }: { position: CornerPosition }) {
  const positionStyle = CORNER_POSITION_STYLE[position];

  return (
    <svg
      aria-hidden
      width={BRACKET_LEN}
      height={BRACKET_LEN}
      className="pointer-events-none absolute"
      style={{ ...positionStyle, transformOrigin: "center", transitionDelay: "50ms" }}
    >
      <path
        d={`M 0 0 L ${BRACKET_LEN} 0 M 0 0 L 0 ${BRACKET_LEN}`}
        stroke={STROKE_IDLE}
        strokeWidth="1"
        fill="none"
        strokeLinecap="square"
        className="transition-[stroke,stroke-width] duration-200 [.group:hover_&]:stroke-[1.5] [.group:hover_&]:[stroke:var(--color-forest)]"
      />
    </svg>
  );
}
