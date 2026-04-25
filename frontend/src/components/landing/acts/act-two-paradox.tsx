"use client";

import { useRef, useState } from "react";

import { COPY } from "@/content/copy";
import { DisplayHeading } from "@/components/ui/display-heading";

import { useActPin } from "./use-act-pin";

const ACT_DURATION = "+=300%"; // 3x viewport pin

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function fadeWindow(p: number, fadeIn: number, fullStart: number, fullEnd: number, fadeOut: number): number {
  if (p <= fadeIn) return 0;
  if (p < fullStart) return clamp01((p - fadeIn) / (fullStart - fadeIn));
  if (p <= fullEnd) return 1;
  if (p < fadeOut) return clamp01(1 - (p - fullEnd) / (fadeOut - fullEnd));
  return 0;
}

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
      {/* Stage: each phase is absolutely centered. Only one (or transitioning) is visible at a time. */}
      <div className="absolute inset-0 mx-auto max-w-6xl px-5 md:px-8">

        {/* Phase 1 — Headline + eyebrow (peak 0–0.20, fade out by 0.30) */}
        <PhaseLayer opacity={fadeWindow(progress, -0.05, 0.0, 0.18, 0.32)}>
          <p className="font-mono text-xs uppercase tracking-[0.08em] text-stone">{eyebrow}</p>
          <DisplayHeading id="act-two-heading" level="xl" className="mt-8 max-w-[18ch]">
            {headline.map((line, i) => (
              <span key={i} className="block">
                {line}
              </span>
            ))}
          </DisplayHeading>
        </PhaseLayer>

        {/* Phase 2 — Video centerpiece (fade in 0.22, peak 0.30–0.70, fade out by 0.82) */}
        <PhaseLayer opacity={fadeWindow(progress, 0.22, 0.30, 0.70, 0.82)} centered>
          <ActTwoVideoCenterpiece progress={progress} />
        </PhaseLayer>

        {/* Phase 3 — Recap + closer (fade in 0.78, stays peak through 1.0) */}
        <PhaseLayer opacity={fadeWindow(progress, 0.78, 0.86, 1.10, 1.20)}>
          <ActTwoRecap closer={closer} />
        </PhaseLayer>
      </div>
    </section>
  );
}

function PhaseLayer({
  children,
  opacity,
  centered = false,
}: {
  children: React.ReactNode;
  opacity: number;
  centered?: boolean;
}) {
  if (opacity <= 0.001) return null;
  return (
    <div
      className="absolute inset-0 flex flex-col px-5 md:px-8"
      style={{
        opacity,
        justifyContent: "center",
        alignItems: centered ? "center" : "stretch",
        pointerEvents: opacity > 0.5 ? "auto" : "none",
        transition: "opacity 0.15s linear",
      }}
    >
      <div className={centered ? "w-full" : "mx-auto w-full max-w-6xl"}>{children}</div>
    </div>
  );
}

function ActTwoVideoCenterpiece({ progress }: { progress: number }) {
  // Subtle scale through the video phase (0.22 → 0.82)
  const phaseProgress = clamp01((progress - 0.22) / 0.60);
  const scale = 0.96 + phaseProgress * 0.04;

  return (
    <div
      className="mx-auto w-full max-w-4xl"
      style={{ transform: `scale(${scale})`, transition: "transform 0.1s linear" }}
    >
      <div
        className="relative aspect-video w-full rounded-[var(--radius-6)] border border-dashed border-stone/30 bg-surface-deep/60"
        role="img"
        aria-label="Video centerpiece placeholder"
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-stone">
          <PlayGlyph />
          <p className="font-mono text-xs uppercase tracking-[0.12em]">Video centerpiece</p>
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
      <circle cx="20" cy="20" r="18.5" stroke="currentColor" strokeWidth="1" opacity="0.4" />
      <path d="M16 13.5L27 20L16 26.5V13.5Z" fill="currentColor" opacity="0.5" />
    </svg>
  );
}

function ActTwoRecap({ closer }: { closer: string }) {
  const { leftLabel, rightLabel, recap } = COPY.paradoxAct;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <RecapColumn label={leftLabel} fields={recap.leftFields} variant="without" />
        <RecapColumn label={rightLabel} fields={recap.rightFields} variant="with" />
      </div>
      <p className="mt-8 max-w-[55ch] text-lg leading-relaxed text-quill md:text-xl">{closer}</p>
    </div>
  );
}

type RecapField = { key: string; value: string; flag: string | null };

function RecapColumn({
  label,
  fields,
  variant,
}: {
  label: string;
  fields: ReadonlyArray<RecapField>;
  variant: "without" | "with";
}) {
  const styleClasses =
    variant === "with"
      ? "rounded-[var(--radius-6)] border border-forest/20 bg-surface-deep p-6"
      : "rounded-[var(--radius-6)] border border-danger-text/20 bg-canvas p-6";
  return (
    <article className={styleClasses}>
      <p className="font-mono text-xs uppercase tracking-[0.08em] text-stone">{label}</p>
      <dl className="mt-4 space-y-2 font-mono text-sm">
        {fields.map((f) => (
          <div key={f.key} className="flex justify-between gap-4">
            <dt className="text-stone">{f.key}:</dt>
            <dd className={variant === "without" ? "text-quill" : "text-forest"}>
              {f.value}
              {f.flag ? (
                <span className="ml-2 rounded-sm bg-danger-text/15 px-1 py-0.5 text-xs text-danger-text">
                  {f.flag}
                </span>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
    </article>
  );
}
