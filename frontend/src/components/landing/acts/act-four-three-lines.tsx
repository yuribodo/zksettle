"use client";

import { useRef } from "react";

import { COPY } from "@/content/copy";
import { DisplayHeading } from "@/components/ui/display-heading";

import { useActPin } from "./use-act-pin";

const ACT_DURATION = "+=80%";

const STEP_LABELS = ["install", "prove", "wrap"] as const;

export function ActFourThreeLines() {
  const containerRef = useRef<HTMLDivElement>(null);

  useActPin(containerRef, { duration: ACT_DURATION });

  const { lines } = COPY.move.code;

  return (
    <section
      ref={containerRef}
      aria-labelledby="act-four-heading"
      className="relative isolate min-h-screen overflow-hidden bg-ink text-canvas"
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 80% 60% at 25% 35%, rgba(12,61,46,0.45), transparent 70%), radial-gradient(ellipse 60% 50% at 80% 75%, rgba(12,61,46,0.25), transparent 65%)",
        }}
      />

      <div className="relative mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center gap-10 px-6 py-24 md:px-8">
        <DisplayHeading
          id="act-four-heading"
          level="l"
          className="text-center text-canvas"
        >
          Three lines.
        </DisplayHeading>

        <div className="w-full max-w-3xl">
          <hr className="border-0 border-t border-forest/30" data-three-lines-rule="top" />

          <ol className="my-10 flex flex-col gap-6 md:gap-7">
            {lines.map((line, i) => (
              <li
                key={line}
                className="grid grid-cols-[auto_1fr] items-baseline gap-x-6 md:gap-x-10"
                data-three-lines-step
              >
                <div className="flex items-baseline gap-3 font-mono text-xs uppercase tracking-[0.16em] text-canvas/55 tabular-nums">
                  <span className="text-canvas/80">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span aria-hidden className="text-canvas/30">─</span>
                  <span>{STEP_LABELS[i]}</span>
                </div>
                <code
                  className={
                    i === 0
                      ? "font-mono text-base text-canvas/55 md:text-lg"
                      : "font-mono text-base text-[#5fb88f] md:text-lg"
                  }
                >
                  {line}
                </code>
              </li>
            ))}
          </ol>

          <hr className="border-0 border-t border-forest/30" data-three-lines-rule="bottom" />

          <p
            className="mt-6 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-[#5fb88f]"
            data-three-lines-footer
          >
            ✓ ready · 0 PII leaked
          </p>
        </div>
      </div>
    </section>
  );
}
