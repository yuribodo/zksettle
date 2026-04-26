"use client";

import { useRef, useState } from "react";

import { COPY } from "@/content/copy";
import { DisplayHeading } from "@/components/ui/display-heading";

import { HologramCanvas } from "./hologram-canvas";
import { useActPin } from "./use-act-pin";

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function fade(p: number, inStart: number, inEnd: number, outStart: number, outEnd: number): number {
  if (p < inStart) return 0;
  if (p < inEnd) return clamp01((p - inStart) / (inEnd - inStart));
  if (p <= outStart) return 1;
  if (p < outEnd) return clamp01(1 - (p - outStart) / (outEnd - outStart));
  return 0;
}

export function ActTwoParadox() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useActPin(containerRef, {
    duration: "+=150%",
    onUpdate: setProgress,
  });

  const { eyebrow, headline, closer } = COPY.paradoxAct;

  const eyebrowOpacity = fade(progress, 0.0, 0.08, 0.25, 0.35);
  const headlineOpacity = fade(progress, 0.05, 0.18, 0.6, 0.75);
  const headlineScale = 0.85 + clamp01((progress - 0.05) / 0.2) * 0.15;
  const headlineY = clamp01(1 - (progress - 0.05) / 0.2) * 30;
  const closerOpacity = fade(progress, 0.35, 0.5, 0.7, 0.85);

  return (
    <section
      ref={containerRef}
      id="act-two-paradox"
      aria-labelledby="act-two-heading"
      className="relative isolate min-h-screen overflow-hidden bg-[#050505]"
    >
      <div className="absolute inset-0">
        <HologramCanvas progress={progress} />
      </div>

      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center px-5 md:px-8">
        <p
          className="font-mono text-xs uppercase tracking-[0.08em] text-white/60"
          style={{
            opacity: eyebrowOpacity,
            transform: `translateY(${(1 - eyebrowOpacity) * 12}px)`,
            transition: "none",
          }}
        >
          {eyebrow}
        </p>

        <DisplayHeading
          id="act-two-heading"
          level="xl"
          className="mt-6 max-w-[18ch] text-center text-white"
          style={{
            opacity: headlineOpacity,
            transform: `translateY(${headlineY}px) scale(${headlineScale})`,
            textShadow: "0 2px 40px rgba(0,0,0,0.8), 0 0 120px rgba(10,80,60,0.3)",
            transition: "none",
          }}
        >
          {headline}
        </DisplayHeading>

        <p
          className="mt-10 max-w-[40ch] text-center font-mono text-sm tracking-[0.04em] text-white/70"
          style={{
            opacity: closerOpacity,
            transform: `translateY(${(1 - closerOpacity) * 16}px)`,
            transition: "none",
          }}
        >
          {closer}
        </p>
      </div>
    </section>
  );
}
