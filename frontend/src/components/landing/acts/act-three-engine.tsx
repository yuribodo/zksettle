"use client";

import { useRef, useState } from "react";

import { COPY } from "@/content/copy";
import { DisplayHeading } from "@/components/ui/display-heading";

import { useActPin } from "./use-act-pin";

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

function EngineDiagram({
  progress: _progress,
  benchmarks: _benchmarks,
}: {
  progress: number;
  benchmarks: ReadonlyArray<{ value: string; label: string }>;
}) {
  // Stub — Task 4.2 implements the SVG diagram
  return <div className="mt-8 h-64 rounded-md bg-surface-deep" aria-hidden />;
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

function DemoButton({ progress: _progress }: { progress: number }) {
  // Stub — Task 4.3 implements the demo button + console
  return null;
}
