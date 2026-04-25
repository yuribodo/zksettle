"use client";

import { useRef, useState } from "react";

import { COPY } from "@/content/copy";
import { DisplayHeading } from "@/components/ui/display-heading";
import { ProofConsole, type ConsoleLine } from "@/components/landing/proof-console";

import { useActPin } from "./use-act-pin";

const DEMO_RUNNING_LINES: readonly ConsoleLine[] = [
  { kind: "muted", text: "$ zksettle.prove(credential)" },
  { kind: "muted", text: "[..] proving..." },
];

const DEMO_DONE_LINES: readonly ConsoleLine[] = [
  { kind: "muted", text: "$ zksettle.prove(credential)" },
  { kind: "ok", text: "[ok] credential verified (issuer: zk-mock-1)" },
  { kind: "ok", text: "[ok] proof generated in 4.8s" },
  { kind: "result", text: "proof: 0xa3f1...c7e2" },
];

const ACT_DURATION = "+=300%"; // 3x viewport

export function ActThreeEngine() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useActPin(containerRef, {
    duration: ACT_DURATION,
    onUpdate: setProgress,
  });

  const { eyebrow, headline, chapters, benchmarks } = COPY.engine;

  return (
    <section
      ref={containerRef}
      aria-labelledby="act-three-heading"
      className="relative isolate min-h-screen overflow-hidden bg-canvas"
    >
      <div className="absolute inset-0 mx-auto grid h-full max-w-6xl grid-cols-1 gap-12 px-5 py-24 md:grid-cols-12 md:px-8">
        {/* Aside fixo (sticky) — diagrama evolui com progress */}
        <aside className="md:col-span-6 md:sticky md:top-24 md:self-start">
          <p className="font-mono text-xs uppercase tracking-[0.08em] text-stone">
            {eyebrow}
          </p>
          <DisplayHeading id="act-three-heading" level="l" className="mt-6">
            {headline}
          </DisplayHeading>
          <EngineDiagram progress={progress} benchmarks={benchmarks} />
        </aside>

        {/* Chapters scrolling */}
        <div className="md:col-span-6 md:col-start-7 flex flex-col gap-32 pt-12 md:pt-32">
          {chapters.map((ch, i) => (
            <ChapterBlock key={ch.title} index={i} progress={progress} chapter={ch} />
          ))}
          <DemoButton progress={progress} />
        </div>
      </div>
    </section>
  );
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function EngineDiagram({
  progress,
  benchmarks,
}: {
  progress: number;
  benchmarks: ReadonlyArray<{ value: string; label: string }>;
}) {
  // 3 fases: A=verify (0..0.33), B=prove (0.33..0.66), C=settle (0.66..1)
  const phaseA = clamp01(progress / 0.33);
  const phaseB = clamp01((progress - 0.33) / 0.33);
  const phaseC = clamp01((progress - 0.66) / 0.34);

  const proofTimer = (phaseB * 4.8).toFixed(1);

  return (
    <div className="mt-8 rounded-md bg-surface-deep p-8">
      <svg viewBox="0 0 320 200" className="w-full" aria-label="ZKSettle engine diagram" role="img">
        {/* Phase A: Merkle tree forming */}
        <g style={{ opacity: phaseA }}>
          <circle cx="60" cy="40" r="6" fill="var(--color-stone)" />
          <circle cx="100" cy="40" r="6" fill="var(--color-stone)" />
          <line x1="60" y1="40" x2="80" y2="80" stroke="var(--color-stone)" strokeWidth="1.2" opacity={phaseA} />
          <line x1="100" y1="40" x2="80" y2="80" stroke="var(--color-stone)" strokeWidth="1.2" opacity={phaseA} />
          <circle cx="80" cy="80" r="8" fill="var(--color-forest)" />
          <text x="80" y="105" textAnchor="middle" fontSize="9" fill="var(--color-quill)" fontFamily="ui-monospace, monospace">
            root
          </text>
        </g>

        {/* Phase B: Proof generation timer */}
        <g style={{ opacity: phaseB }} transform="translate(150 0)">
          <rect x="0" y="20" width="100" height="80" rx="6" fill="none" stroke="var(--color-forest)" strokeWidth="1.5" />
          <text x="50" y="58" textAnchor="middle" fontSize="18" fontWeight="700" fill="var(--color-forest)" fontFamily="ui-monospace, monospace">
            {proofTimer}s
          </text>
          <text x="50" y="78" textAnchor="middle" fontSize="9" fill="var(--color-stone)" fontFamily="ui-monospace, monospace">
            proving...
          </text>
        </g>

        {/* Phase C: Benchmarks explode in */}
        <g style={{ opacity: phaseC }} transform="translate(0 130)">
          {benchmarks.map((b, i) => {
            // Stagger: each benchmark fades in at its own threshold of phaseC
            const localProgress = clamp01((phaseC - i * 0.15) / 0.4);
            const yOffset = (1 - localProgress) * 12;
            return (
              <g
                key={b.label}
                transform={`translate(${i * 80} ${yOffset})`}
                style={{ opacity: localProgress }}
              >
                <text x="40" y="20" textAnchor="middle" fontSize="14" fontWeight="700" fill="var(--color-forest)" fontFamily="ui-monospace, monospace">
                  {b.value}
                </text>
                <text x="40" y="38" textAnchor="middle" fontSize="8" fill="var(--color-stone)">
                  {b.label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

function ChapterBlock({
  index,
  progress,
  chapter,
}: {
  index: number;
  progress: number;
  chapter: { title: string; body: string };
}) {
  // Cada chapter ativo na sua faixa: 0 → [0,1/3], 1 → [1/3, 2/3], 2 → [2/3, 1]
  const start = index / 3;
  const end = (index + 1) / 3;
  const isActive = progress >= start && progress < end;
  return (
    <article
      className={`transition-opacity duration-300 ${
        isActive ? "opacity-100" : "opacity-30"
      }`}
    >
      <h3 className="text-3xl font-semibold tracking-tight md:text-4xl">{chapter.title}</h3>
      <p className="mt-4 max-w-prose text-lg leading-relaxed text-quill">{chapter.body}</p>
    </article>
  );
}

function DemoButton({ progress }: { progress: number }) {
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const visible = progress > 0.85;

  if (!visible) return null;

  function runDemo() {
    setRunning(true);
    setDone(false);
    setTimeout(() => {
      setRunning(false);
      setDone(true);
    }, 2000);
  }

  const { demoCta } = COPY.engine;
  const buttonLabel = running ? "Generating proof..." : done ? "Generate again →" : demoCta;
  const lines = done ? DEMO_DONE_LINES : DEMO_RUNNING_LINES;

  return (
    <div className="mt-8 transition-opacity duration-500">
      <button
        type="button"
        onClick={runDemo}
        disabled={running}
        className="rounded-md bg-forest px-5 py-2 text-sm font-medium text-canvas hover:bg-forest-hover disabled:opacity-60"
      >
        {buttonLabel}
      </button>
      {(running || done) ? (
        <div className="mt-4">
          <ProofConsole initial="$ zksettle.prove(credential)" lines={lines} />
        </div>
      ) : null}
    </div>
  );
}
