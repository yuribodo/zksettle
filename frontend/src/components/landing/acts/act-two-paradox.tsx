"use client";

import { useRef, useState } from "react";

import { COPY } from "@/content/copy";
import { DisplayHeading } from "@/components/ui/display-heading";

import { useActPin } from "./use-act-pin";

const ACT_DURATION = "+=300%"; // 3x viewport pin

export function ActTwoParadox() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useActPin(containerRef, {
    duration: ACT_DURATION,
    onUpdate: setProgress,
  });

  const { eyebrow, headline, closer } = COPY.paradoxAct;

  return (
    <section
      ref={containerRef}
      aria-labelledby="act-two-heading"
      className="relative isolate min-h-screen overflow-hidden bg-canvas"
    >
      <div className="absolute inset-0 mx-auto flex max-w-6xl flex-col justify-center gap-10 px-5 py-24 md:px-8">
        <p className="font-mono text-xs uppercase tracking-[0.08em] text-stone">
          {eyebrow}
        </p>

        <DisplayHeading id="act-two-heading" level="xl" className="max-w-[18ch]">
          {headline.map((line, i) => (
            <span key={i} className="block">
              {line}
            </span>
          ))}
        </DisplayHeading>

        {/* Video placeholder slot — Task 3.2 will fill this */}
        <ActTwoVideoSlot progress={progress} />

        {/* Recap slot — Task 3.3 will fill this */}
        <ActTwoRecapSlot progress={progress} />

        <p className="max-w-[55ch] text-lg leading-relaxed text-quill md:text-xl">
          {closer}
        </p>
      </div>
    </section>
  );
}

function ActTwoVideoSlot({ progress }: { progress: number }) {
  // Visible during phase 2 (progress 0.20 → 0.80). Scales subtly + fades at edges.
  const phaseProgress = Math.min(Math.max((progress - 0.2) / 0.6, 0), 1);
  const scale = 0.94 + phaseProgress * 0.06;
  const opacity =
    phaseProgress < 0.05
      ? phaseProgress / 0.05
      : phaseProgress > 0.95
        ? Math.max(0, 1 - (phaseProgress - 0.95) * 20)
        : 1;

  return (
    <div
      className="relative mx-auto w-full max-w-4xl"
      style={{
        opacity,
        transform: `scale(${scale})`,
        transition: "transform 0.1s linear",
      }}
    >
      <div
        className="relative aspect-video w-full rounded-[var(--radius-6)] border border-dashed border-stone/30 bg-surface-deep/40"
        role="img"
        aria-label="Video centerpiece placeholder"
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-stone">
          <PlayGlyph />
          <p className="font-mono text-xs uppercase tracking-[0.12em]">
            Video centerpiece
          </p>
          <p className="max-w-[36ch] px-6 text-center text-xs text-stone/70">
            Placeholder — o vídeo do paradoxo entra aqui (~30–60s, mute autoplay).
          </p>
        </div>
      </div>
    </div>
  );
}

function PlayGlyph() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle
        cx="20"
        cy="20"
        r="18.5"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.4"
      />
      <path
        d="M16 13.5L27 20L16 26.5V13.5Z"
        fill="currentColor"
        opacity="0.5"
      />
    </svg>
  );
}

function ActTwoRecapSlot({ progress: _progress }: { progress: number }) {
  // Stub — Task 3.3 implements the recap
  return null;
}
