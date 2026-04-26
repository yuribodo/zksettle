"use client";

import Link from "next/link";
import { useRef } from "react";

import { buttonVariants } from "@/components/ui/button";
import { COPY } from "@/content/copy";
import { DisplayHeading } from "@/components/ui/display-heading";
import { cn } from "@/lib/cn";

import { useActPin } from "./use-act-pin";
import { MarketCell } from "./market-cell";

const ACT_DURATION = "+=120%";

export function ActFiveMarkets() {
  const containerRef = useRef<HTMLDivElement>(null);

  useActPin(containerRef, { duration: ACT_DURATION });

  const { markets, closer } = COPY.move;

  return (
    <section
      ref={containerRef}
      aria-labelledby="act-five-heading"
      className="relative isolate min-h-screen overflow-hidden bg-ink text-canvas"
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 80% 60% at 75% 25%, rgba(12,61,46,0.40), transparent 70%), radial-gradient(ellipse 60% 50% at 20% 80%, rgba(12,61,46,0.22), transparent 65%)",
        }}
      />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col justify-center gap-14 px-6 py-24 md:px-8">
        <p
          className="font-mono text-xs uppercase tracking-[0.18em] text-canvas/55"
          data-markets-eyebrow
        >
          One primitive. Six markets.
        </p>

        <div
          className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
          data-markets-grid
        >
          {markets.map((m, i) => (
            <MarketCell key={m.name} market={m} index={i} total={markets.length} />
          ))}
        </div>

        <div
          className="h-px w-full bg-forest/30"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to right, rgba(12,61,46,0.5) 0 8px, transparent 8px 14px)",
            backgroundColor: "transparent",
          }}
          data-markets-divider
        />

        <div data-markets-closer>
          <DisplayHeading
            id="act-five-heading"
            level="m"
            className="max-w-[20ch] text-canvas"
          >
            {closer.headline}
          </DisplayHeading>
          <p className="mt-4 max-w-[40ch] text-base leading-relaxed text-canvas/65">
            {closer.sub}
          </p>
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
      </div>
    </section>
  );
}
