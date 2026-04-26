"use client";

import React, { type CSSProperties, useRef, useState } from "react";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { cn } from "@/lib/cn";
import { COPY, type EngineChapter } from "@/content/copy";
import { DisplayHeading } from "@/components/ui/display-heading";
import { ProofConsole, type ConsoleLine } from "@/components/landing/proof-console";
import { StepDiagram } from "@/components/landing/step-diagram";
import { useCanvasStage } from "@/components/landing/canvas/use-canvas-stage";

import { useActPin } from "./use-act-pin";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

/* ── Constants ─────────────────────────────────────────────────────────── */

const STROKE_IDLE = "color-mix(in srgb, var(--color-forest) 34%, transparent)";
const STROKE_HOVER = "var(--color-forest)";
const BRACKET_LEN = 12;
const TOTAL = 3;

type CornerPosition = "tl" | "tr" | "bl" | "br";

const CORNER_STYLE: Record<CornerPosition, CSSProperties> = {
  tl: { top: 6, left: 6, transform: "none" },
  tr: { top: 6, right: 6, transform: "scaleX(-1)" },
  bl: { bottom: 6, left: 6, transform: "scaleY(-1)" },
  br: { bottom: 6, right: 6, transform: "scale(-1, -1)" },
};

const DEMO_RUNNING: readonly ConsoleLine[] = [
  { kind: "muted", text: "$ zksettle.prove(credential)" },
  { kind: "muted", text: "[..] proving..." },
];

const DEMO_DONE: readonly ConsoleLine[] = [
  { kind: "muted", text: "$ zksettle.prove(credential)" },
  { kind: "ok", text: "[ok] credential verified (issuer: zk-mock-1)" },
  { kind: "ok", text: "[ok] proof generated in 4.8s" },
  { kind: "result", text: "proof: 0xa3f1...c7e2" },
];

/* ── ActThreeEngine ────────────────────────────────────────────────────── */

export function ActThreeEngine() {
  const containerRef = useRef<HTMLDivElement>(null);
  const curtainRef = useRef<HTMLDivElement>(null);
  const [scrollStep, setScrollStep] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  const { scrollStateRef } = useCanvasStage();

  useActPin(containerRef, {
    duration: "+=150%",
    scrub: 0.5,
    onUpdate: (progress) => {
      scrollStateRef.current.actThreeProgress = progress;
      const next = Math.min(2, Math.floor(progress * 3));
      setScrollStep((cur) => (cur === next ? cur : next));
    },
  });

  useGSAP(
    () => {
      const root = containerRef.current;
      if (!root) return;

      const mm = gsap.matchMedia();
      mm.add(
        {
          isDesktop:
            "(min-width: 768px) and (prefers-reduced-motion: no-preference)",
        },
        (ctx) => {
          if (!ctx.conditions?.isDesktop) return;

          const curtain = curtainRef.current;
          const eyebrow = root.querySelector("[data-engine-eyebrow]");
          const cells = root.querySelectorAll("[data-engine-cell]");
          const divider = root.querySelector("[data-engine-divider]");
          const closer = root.querySelector("[data-engine-closer]");

          gsap.set(curtain, { opacity: 1 });
          gsap.set(eyebrow, { opacity: 0, y: 24, filter: "blur(6px)" });
          gsap.set(cells, { opacity: 0, y: 32, scale: 0.96, filter: "blur(4px)" });
          gsap.set(divider, { scaleX: 0, transformOrigin: "left center" });
          gsap.set(closer, { opacity: 0, y: 20, filter: "blur(4px)" });

          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: root,
              start: "top 80%",
              end: "top 20%",
              scrub: 0.8,
            },
          });

          tl.to(curtain, { opacity: 0, duration: 0.4, ease: "power2.inOut" }, 0);

          tl.to(
            eyebrow,
            { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.3 },
            0.1,
          );

          tl.to(
            cells,
            {
              opacity: 1,
              y: 0,
              scale: 1,
              filter: "blur(0px)",
              duration: 0.4,
              stagger: 0.08,
              ease: "power2.out",
            },
            0.2,
          );

          tl.to(divider, { scaleX: 1, duration: 0.3 }, 0.5);

          tl.to(
            closer,
            {
              opacity: 1,
              y: 0,
              filter: "blur(0px)",
              duration: 0.4,
              ease: "power2.out",
            },
            0.6,
          );
        },
      );

      return () => {
        scrollStateRef.current.actThreeProgress = 0;
        mm.revert();
      };
    },
    { scope: containerRef },
  );

  function runDemo() {
    setRunning(true);
    setDone(false);
    setTimeout(() => {
      setRunning(false);
      setDone(true);
    }, 2000);
  }

  const { eyebrow, headline, chapters, demoCta } = COPY.engine;

  return (
    <section
      ref={containerRef}
      id="act-three-engine"
      aria-labelledby="act-three-heading"
      className="relative isolate min-h-screen overflow-hidden bg-canvas text-ink"
    >
      {/* Curtain — white overlay that lifts to reveal content */}
      <div
        ref={curtainRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-20 bg-canvas"
      />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col justify-center gap-8 px-6 py-16 md:px-8 lg:gap-7 lg:py-12">
        {/* Eyebrow */}
        <p
          className="font-mono text-xs uppercase tracking-[0.18em] text-forest"
          data-engine-eyebrow
        >
          {eyebrow}
        </p>

        {/* Step cards grid */}
        <div
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-3"
          onMouseLeave={() => setHoveredIndex(null)}
        >
          {chapters.map((chapter, i) => {
            const isRevealed =
              hoveredIndex === i ||
              (hoveredIndex === null && scrollStep === i);

            return (
              <EngineStepCell
                key={chapter.title}
                chapter={chapter}
                index={i}
                isRevealed={isRevealed}
                isDimmed={hoveredIndex !== null && hoveredIndex !== i}
                onHoverChange={(hovering) => {
                  if (hovering) setHoveredIndex(i);
                  else
                    setHoveredIndex((prev) => (prev === i ? null : prev));
                }}
              />
            );
          })}
        </div>

        {/* Dashed divider */}
        <div
          className="h-px w-full"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to right, var(--color-border) 0 8px, transparent 8px 14px)",
          }}
          data-engine-divider
        />

        {/* Closer */}
        <div
          className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] lg:items-end lg:gap-10"
          data-engine-closer
        >
          <DisplayHeading
            id="act-three-heading"
            level="m"
            className="max-w-[20ch] text-ink"
          >
            {headline}
          </DisplayHeading>

          <div>
            <button
              type="button"
              onClick={runDemo}
              disabled={running}
              className="inline-flex items-center justify-center rounded-[var(--radius-3)] bg-forest px-4 py-2.5 text-base font-medium text-canvas transition-colors duration-150 ease-[var(--ease-brand)] hover:bg-forest-hover disabled:pointer-events-none disabled:opacity-50"
            >
              {running
                ? "Generating proof..."
                : done
                  ? "Generate again →"
                  : demoCta}
            </button>
          </div>
        </div>

        {/* Console output */}
        {(running || done) && (
          <div className="mt-6">
            <ProofConsole
              initial="$ zksettle.prove(credential)"
              lines={done ? DEMO_DONE : DEMO_RUNNING}
            />
          </div>
        )}
      </div>
    </section>
  );
}

/* ── EngineStepCell ────────────────────────────────────────────────────── */

function EngineStepCell({
  chapter,
  index,
  isRevealed,
  isDimmed,
  onHoverChange,
}: {
  chapter: EngineChapter;
  index: number;
  isRevealed: boolean;
  isDimmed: boolean;
  onHoverChange: (hovering: boolean) => void;
}) {
  return (
    <div
      data-engine-cell
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
      className={cn(
        "group relative isolate overflow-hidden rounded-[8px] bg-surface/45 p-5 transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-px active:translate-y-0",
        isDimmed ? "opacity-60" : "opacity-100",
      )}
    >
      {/* Tint layer */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 rounded-[8px] transition-colors duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]",
          isRevealed ? "bg-surface-deep/80" : "bg-surface-deep/0",
        )}
        style={{ transitionDelay: "60ms" }}
      />

      {/* Border — dashed idle, solid when revealed */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 rounded-[8px] border border-dashed transition-opacity duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]",
          isRevealed ? "opacity-0" : "opacity-100",
        )}
        style={{ borderColor: STROKE_IDLE }}
      />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 rounded-[8px] border-[1.5px] transition-opacity duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]",
          isRevealed ? "opacity-100" : "opacity-0",
        )}
        style={{ borderColor: STROKE_HOVER }}
      />

      {/* Corner brackets */}
      <CornerBracket position="tl" active={isRevealed} />
      <CornerBracket position="tr" active={isRevealed} />
      <CornerBracket position="bl" active={isRevealed} />
      <CornerBracket position="br" active={isRevealed} />

      {/* Content */}
      <div className="relative flex h-full flex-col">
        {/* Counter */}
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] tabular-nums text-stone">
          {String(index + 1).padStart(2, "0")}/
          {String(TOTAL).padStart(2, "0")}
        </p>

        {/* Flow diagram */}
        <div className="mt-5">
          <StepDiagram index={index as 0 | 1 | 2} delay={index * 0.15} />
        </div>

        {/* Title block — pushed to bottom */}
        <div className="mt-auto pt-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-stone">
            {chapter.kicker}
          </p>
          <p className="mt-2 font-display text-[1.45rem] leading-none text-ink md:text-[1.7rem]">
            {chapter.title}
          </p>
        </div>

        {/* Reveal area — always in DOM for stable height, fades in when revealed */}
        <div
          className={cn(
            "mt-4 transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
            isRevealed
              ? "translate-y-0 opacity-100"
              : "md:translate-y-1 md:opacity-0",
          )}
          style={{ transitionDelay: isRevealed ? "110ms" : "0ms" }}
        >
          {/* Separator */}
          <div
            aria-hidden
            className={cn(
              "h-px w-full origin-left transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
              isRevealed ? "scale-x-100" : "md:scale-x-0",
            )}
            style={{
              backgroundImage:
                "repeating-linear-gradient(to right, color-mix(in srgb, var(--color-forest) 36%, transparent) 0 4px, transparent 4px 8px)",
            }}
          />

          {/* Body */}
          <p className="mt-3 font-mono text-[11px] leading-snug text-quill">
            {chapter.body}
          </p>

          {/* Benchmarks */}
          <div className="mt-4 flex gap-6">
            {chapter.benchmarks.map((b) => (
              <div key={b.label}>
                <p className="font-mono text-[1.25rem] font-medium tabular-nums leading-none text-ink">
                  {b.value}
                </p>
                <p className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-stone">
                  {b.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── CornerBracket ─────────────────────────────────────────────────────── */

function CornerBracket({
  position,
  active,
}: {
  position: CornerPosition;
  active: boolean;
}) {
  return (
    <svg
      aria-hidden
      width={BRACKET_LEN}
      height={BRACKET_LEN}
      className="pointer-events-none absolute"
      style={{
        ...CORNER_STYLE[position],
        transformOrigin: "center",
        transitionDelay: "50ms",
      }}
    >
      <path
        d={`M 0 0 L ${BRACKET_LEN} 0 M 0 0 L 0 ${BRACKET_LEN}`}
        stroke={active ? STROKE_HOVER : STROKE_IDLE}
        strokeWidth={active ? 1.5 : 1}
        fill="none"
        strokeLinecap="square"
        className="transition-[stroke,stroke-width] duration-200"
      />
    </svg>
  );
}
