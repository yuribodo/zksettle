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

function ActTwoVideoSlot({ progress: _progress }: { progress: number }) {
  // Stub — Task 3.2 implements the actual placeholder/video
  return null;
}

function ActTwoRecapSlot({ progress: _progress }: { progress: number }) {
  // Stub — Task 3.3 implements the recap
  return null;
}
