"use client";

import Image from "next/image";
import { useRef, useState } from "react";

import { COPY } from "@/content/copy";
import { DisplayHeading } from "@/components/ui/display-heading";
import { ProofConsole, type ConsoleLine } from "@/components/landing/proof-console";
import { cn } from "@/lib/cn";

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

const ACT_DURATION = "+=300%";

const ENGINE_FRAMES = [
  {
    src: "/engine-frames/verify-once.png",
    alt: "Credential verification illustration showing a signed KYC card becoming a Merkle root.",
  },
  {
    src: "/engine-frames/prove-anywhere.png",
    alt: "Proof generation illustration showing private inputs producing a zero-knowledge proof.",
  },
  {
    src: "/engine-frames/settle-forever.png",
    alt: "Settlement illustration showing a proof verified by a transfer hook and recorded for audit.",
  },
] as const;

export function ActThreeEngine() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [activeStep, setActiveStep] = useState(0);

  useActPin(containerRef, {
    duration: ACT_DURATION,
    scrub: 0.5,
    onUpdate: (progress) => {
      setProgress(progress);
      const nextStep = Math.min(2, Math.floor(progress * 3));
      setActiveStep((current) => (current === nextStep ? current : nextStep));
    },
  });

  const { eyebrow, headline, chapters } = COPY.engine;

  return (
    <section
      ref={containerRef}
      id="act-three-engine"
      aria-labelledby="act-three-heading"
      className="relative isolate min-h-screen overflow-hidden bg-canvas"
    >
      <div className="absolute inset-0 mx-auto grid h-full max-w-6xl grid-cols-1 gap-12 px-5 py-24 md:grid-cols-12 md:px-8">
        <aside className="md:col-span-6 md:sticky md:top-24 md:self-start">
          <p className="font-mono text-xs uppercase tracking-[0.08em] text-stone">
            {eyebrow}
          </p>
          <DisplayHeading id="act-three-heading" level="l" className="mt-6">
            {headline}
          </DisplayHeading>
          <EngineFrame activeStep={activeStep} />
        </aside>

        <div className="flex flex-col gap-32 pt-12 md:col-span-6 md:col-start-7 md:pt-32">
          {chapters.map((chapter, index) => (
            <ChapterBlock
              key={chapter.title}
              index={index}
              progress={progress}
              chapter={chapter}
            />
          ))}
          <DemoButton progress={progress} />
        </div>
      </div>
    </section>
  );
}

function EngineFrame({ activeStep }: { activeStep: number }) {
  return (
    <div className="mt-8 overflow-hidden rounded-md bg-surface-deep p-3">
      <div className="relative aspect-[16/10] overflow-hidden rounded-[var(--radius-3)] bg-canvas">
        {ENGINE_FRAMES.map((frame, index) => (
          <Image
            key={frame.src}
            src={frame.src}
            alt={frame.alt}
            width={1200}
            height={750}
            priority={index === 0}
            className={cn(
              "absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ease-[var(--ease-brand)]",
              activeStep === index ? "opacity-100" : "opacity-0",
            )}
          />
        ))}
      </div>
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
      {running || done ? (
        <div className="mt-4">
          <ProofConsole initial="$ zksettle.prove(credential)" lines={lines} />
        </div>
      ) : null}
    </div>
  );
}
