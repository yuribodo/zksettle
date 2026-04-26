"use client";

import { type CSSProperties } from "react";

import { type Market } from "@/content/copy";
import { cn } from "@/lib/cn";

const DASH_PATTERN = "8 6";
const STROKE_IDLE = "rgb(12 61 46 / 0.55)";
const STROKE_HOVER = "rgb(12 61 46 / 0.95)";
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
        "group relative isolate min-h-[220px] overflow-hidden rounded-[8px] p-6 transition-opacity duration-200",
        isDimmed ? "opacity-60" : "opacity-100",
      )}
    >
      {/* Tint layer — fades in on hover (delay 100ms) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[8px] bg-forest/0 transition-colors duration-200 group-hover:bg-forest/[0.06]"
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
      <div className="relative flex h-full min-h-[180px] flex-col">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] tabular-nums text-canvas/45">
          {String(index + 1).padStart(2, "0")}/{String(total).padStart(2, "0")}
        </p>

        <div className="mt-auto">
          <p className="font-display text-2xl text-canvas md:text-3xl">{market.name}</p>

          {/*
            Descriptor reveal uses the grid-rows trick:
            grid-rows-[0fr] → group-hover:grid-rows-[1fr] animates intrinsic height.
            Inner div has overflow-hidden so content clips during animation.
          */}
          <div
            className="mt-3 grid grid-rows-[0fr] opacity-0 transition-[grid-template-rows,opacity] duration-200 ease-out group-hover:grid-rows-[1fr] group-hover:opacity-100"
            style={{ transitionDelay: "150ms" }}
          >
            <div className="overflow-hidden">
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
        className="transition-[stroke,stroke-width] duration-200 [.group:hover_&]:stroke-[1.5] [.group:hover_&]:[stroke:rgb(12_61_46_/_0.95)]"
      />
    </svg>
  );
}
