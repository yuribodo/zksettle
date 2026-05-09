"use client";

import React, { type CSSProperties } from "react";

import { type Market } from "@/content/copy";

const STROKE_ACTIVE = "var(--color-forest)";
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
}: Readonly<{
  market: Market;
  index: number;
  total: number;
}>) {
  return (
    <div
      data-markets-cell
      className="group relative isolate min-h-[168px] overflow-hidden rounded-[8px] bg-surface/45 p-5 lg:min-h-[154px]"
    >
      {/* Tint layer — always active */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[8px] bg-surface-deep/80"
      />

      {/* Border — solid always */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[8px] border-[1.5px]"
        style={{ borderColor: STROKE_ACTIVE }}
      />

      {/* Corner brackets */}
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

          <div className="mt-2">
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
  );
}

function CornerBracket({ position }: Readonly<{ position: CornerPosition }>) {
  return (
    <svg
      aria-hidden
      width={BRACKET_LEN}
      height={BRACKET_LEN}
      className="pointer-events-none absolute"
      style={{ ...CORNER_POSITION_STYLE[position], transformOrigin: "center" }}
    >
      <path
        d={`M 0 0 L ${BRACKET_LEN} 0 M 0 0 L 0 ${BRACKET_LEN}`}
        stroke={STROKE_ACTIVE}
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="square"
      />
    </svg>
  );
}
