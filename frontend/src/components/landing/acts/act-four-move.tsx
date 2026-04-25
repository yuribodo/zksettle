"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { COPY } from "@/content/copy";
import { DisplayHeading } from "@/components/ui/display-heading";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { cn } from "@/lib/cn";

import { useActPin } from "./use-act-pin";

const ACT_DURATION = "+=150%";

export function ActFourMove() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useActPin(containerRef, {
    duration: ACT_DURATION,
    onUpdate: setProgress,
  });

  const { code, useCases, closer } = COPY.move;

  return (
    <section
      ref={containerRef}
      aria-labelledby="act-four-heading"
      className="relative isolate min-h-screen overflow-hidden bg-ink text-canvas"
    >
      {/* Atmospheric gradient — radial forest glow off-center */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 80% 60% at 25% 35%, rgba(12,61,46,0.45), transparent 70%), radial-gradient(ellipse 60% 50% at 80% 75%, rgba(12,61,46,0.25), transparent 65%)",
        }}
      />
      {/* Faint grid texture overlay (very subtle) */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(250,250,247,1) 1px, transparent 1px), linear-gradient(90deg, rgba(250,250,247,1) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative mx-auto grid min-h-screen max-w-6xl grid-cols-1 items-center gap-12 px-5 py-24 md:grid-cols-12 md:px-8">
        {/* LEFT — Terminal centerpiece */}
        <div className="md:col-span-7">
          <CodeTerminal code={code} progress={progress} />
        </div>

        {/* RIGHT — Use cases grid + closing card */}
        <div className="flex flex-col gap-12 md:col-span-5">
          <UseCasesGrid useCases={useCases} progress={progress} />
          <ClosingCard closer={closer} progress={progress} />
        </div>
      </div>
    </section>
  );
}

function CodeTerminal({
  code,
  progress,
}: {
  code: { label: string; lines: ReadonlyArray<string> };
  progress: number;
}) {
  const reduceMotion = useReducedMotion();
  const [visibleLines, setVisibleLines] = useState(reduceMotion ? code.lines.length : 0);
  const [done, setDone] = useState(reduceMotion);

  useEffect(() => {
    if (reduceMotion) return;
    if (progress < 0.05) {
      setVisibleLines(0);
      setDone(false);
      return;
    }
    const target = Math.min(code.lines.length, Math.floor((progress - 0.05) / 0.10) + 1);
    setVisibleLines(target);
    if (target >= code.lines.length) setDone(true);
  }, [progress, code.lines.length, reduceMotion]);

  const enterOpacity = Math.min(1, Math.max(0, progress * 8)); // fast enter
  const enterY = (1 - enterOpacity) * 24;

  return (
    <div
      className="relative"
      style={{
        opacity: enterOpacity,
        transform: `translateY(${enterY}px)`,
        transition: "transform 0.15s linear",
      }}
    >
      {/* Eyebrow above terminal */}
      <p className="mb-6 font-mono text-xs uppercase tracking-[0.14em] text-canvas/55">
        {code.label}
      </p>

      {/* Terminal frame */}
      <div
        className="overflow-hidden rounded-[var(--radius-6)] border border-forest/25 bg-black/60 backdrop-blur-sm"
        style={{ boxShadow: "0 30px 80px -20px rgba(12, 61, 46, 0.55), 0 0 0 1px rgba(12,61,46,0.15) inset" }}
      >
        {/* Window chrome */}
        <div className="flex items-center gap-2 border-b border-forest/15 bg-black/40 px-4 py-3">
          <span className="size-2.5 rounded-full bg-forest/40" />
          <span className="size-2.5 rounded-full bg-forest/25" />
          <span className="size-2.5 rounded-full bg-forest/15" />
          <span className="ml-3 font-mono text-[11px] tracking-wide text-canvas/35">~/your-app</span>
        </div>

        {/* Code body */}
        <pre className="p-6 pl-8 font-mono text-[15px] leading-relaxed md:text-base">
          {code.lines.slice(0, visibleLines).map((line, i) => (
            <div
              key={i}
              className={i === 0 ? "text-canvas/55" : "text-[#5fb88f]"}
              style={{
                animation: i === visibleLines - 1 ? "veil-line-fade 0.18s ease-out" : undefined,
              }}
            >
              {line}
            </div>
          ))}
          {visibleLines < code.lines.length || (!done && !reduceMotion) ? (
            <span className="ml-0.5 inline-block h-[1.05em] w-[0.55ch] translate-y-[2px] animate-veil-cursor bg-canvas/80 align-middle" aria-hidden />
          ) : null}
          {done ? (
            <div className="mt-4 border-t border-forest/20 pt-4 font-mono text-xs uppercase tracking-[0.12em] text-[#5fb88f]">
              ✓ ready · 0 PII leaked
            </div>
          ) : null}
        </pre>
      </div>

      {/* Inline keyframes for cursor + line fade. Tailwind doesn't have these built-in here. */}
      <style jsx>{`
        @keyframes veil-cursor {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
        :global(.animate-veil-cursor) {
          animation: veil-cursor 1s steps(1) infinite;
        }
        @keyframes veil-line-fade {
          from { opacity: 0; transform: translateX(-4px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

function UseCasesGrid({
  useCases,
  progress,
}: {
  useCases: ReadonlyArray<string>;
  progress: number;
}) {
  // Fade in once headline is visible — progress > 0.30
  const enter = Math.min(1, Math.max(0, (progress - 0.30) / 0.20));

  return (
    <div
      style={{
        opacity: enter,
        transform: `translateY(${(1 - enter) * 16}px)`,
        transition: "transform 0.2s linear",
      }}
    >
      <p className="mb-4 font-mono text-xs uppercase tracking-[0.14em] text-canvas/55">
        One primitive. Six markets.
      </p>
      {/* Hairline grid trick: gap-px on a forest-tint background creates 1px dividers */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-4)] bg-forest/20">
        {useCases.map((uc, i) => (
          <div
            key={uc}
            className="bg-ink/95 px-4 py-5 transition-colors duration-200 hover:bg-ink"
            style={{
              transitionDelay: `${i * 30}ms`,
            }}
          >
            <p className="font-display text-base font-medium text-canvas">{uc}</p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-canvas/40">
              market #{String(i + 1).padStart(2, "0")}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ClosingCard({
  closer,
  progress,
}: {
  closer: {
    headline: string;
    sub: string;
    ctas: {
      primary: { label: string; href: string };
      secondary: { label: string; href: string };
    };
  };
  progress: number;
}) {
  const enter = Math.min(1, Math.max(0, (progress - 0.55) / 0.20));

  return (
    <div
      className="border-t border-forest/20 pt-10"
      style={{
        opacity: enter,
        transform: `translateY(${(1 - enter) * 16}px)`,
        transition: "transform 0.2s linear",
      }}
    >
      <DisplayHeading
        id="act-four-heading"
        level="m"
        className="max-w-[20ch] text-canvas"
      >
        {closer.headline}
      </DisplayHeading>
      <p className="mt-4 max-w-[40ch] text-base leading-relaxed text-canvas/65">{closer.sub}</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href={closer.ctas.primary.href}
          className={cn(
            buttonVariants({ variant: "primary", size: "lg" }),
            "shadow-[0_8px_30px_-10px_rgba(12,61,46,0.6)]",
          )}
        >
          {closer.ctas.primary.label}
        </Link>
        <Link
          href={closer.ctas.secondary.href}
          className={cn(
            buttonVariants({ variant: "ghost", size: "lg" }),
            "border border-canvas/15 text-canvas hover:bg-canvas/5",
          )}
        >
          {closer.ctas.secondary.label}
        </Link>
      </div>
    </div>
  );
}
