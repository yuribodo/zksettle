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
      className="relative isolate min-h-screen overflow-hidden bg-surface-deep text-canvas"
    >
      <div className="absolute inset-0 mx-auto flex max-w-6xl flex-col justify-center gap-16 px-5 py-24 md:px-8">
        <CodeReveal code={code} progress={progress} />
        <UseCaseChips useCases={useCases} progress={progress} />
        <ClosingCard closer={closer} progress={progress} />
      </div>
    </section>
  );
}

function CodeReveal({
  code,
  progress,
}: {
  code: { label: string; lines: ReadonlyArray<string> };
  progress: number;
}) {
  const reduceMotion = useReducedMotion();
  const [visibleLines, setVisibleLines] = useState(reduceMotion ? code.lines.length : 0);

  useEffect(() => {
    if (reduceMotion) return;
    if (progress < 0.05) {
      setVisibleLines(0);
      return;
    }
    const target = Math.min(
      code.lines.length,
      Math.floor((progress - 0.05) / 0.12) + 1,
    );
    setVisibleLines(target);
  }, [progress, code.lines.length, reduceMotion]);

  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-[0.08em] text-stone">
        {code.label}
      </p>
      <pre className="mt-4 rounded-md bg-black/30 p-6 font-mono text-base text-forest">
        {code.lines.slice(0, visibleLines).map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </pre>
    </div>
  );
}

function UseCaseChips({
  useCases,
  progress,
}: {
  useCases: ReadonlyArray<string>;
  progress: number;
}) {
  const visible = progress > 0.4;
  return (
    <div
      className="flex flex-wrap gap-2 transition-opacity duration-500"
      style={{ opacity: visible ? 1 : 0 }}
    >
      {useCases.map((uc) => (
        <span
          key={uc}
          className="rounded-full border border-canvas/20 px-3 py-1 text-sm"
        >
          {uc}
        </span>
      ))}
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
  const visible = progress > 0.7;
  return (
    <div
      className="transition-opacity duration-500"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <DisplayHeading id="act-four-heading" level="l" className="max-w-[18ch]">
        {closer.headline}
      </DisplayHeading>
      <p className="mt-4 max-w-[55ch] text-lg text-canvas/80">{closer.sub}</p>
      <div className="mt-8 flex flex-wrap gap-4">
        <Link
          href={closer.ctas.primary.href}
          className={cn(buttonVariants({ variant: "primary", size: "lg" }))}
        >
          {closer.ctas.primary.label}
        </Link>
        <Link
          href={closer.ctas.secondary.href}
          className={cn(buttonVariants({ variant: "ghost", size: "lg" }))}
        >
          {closer.ctas.secondary.label}
        </Link>
      </div>
    </div>
  );
}
