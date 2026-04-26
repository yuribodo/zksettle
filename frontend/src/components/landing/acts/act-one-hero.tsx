"use client";

import { useRef } from "react";

import { HeroCopy } from "@/components/landing/hero/hero-copy";

import { useActPin } from "./use-act-pin";

export function ActOneHero() {
  const containerRef = useRef<HTMLDivElement>(null);

  useActPin(containerRef, {
    duration: "+=150%", // pin por 1.5x viewport
  });

  return (
    <div ref={containerRef} className="relative">
      <HeroCopy />
    </div>
  );
}
