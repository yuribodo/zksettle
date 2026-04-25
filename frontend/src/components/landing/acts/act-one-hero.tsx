"use client";

import { useRef } from "react";

import { Hero } from "@/components/landing/hero/hero";

import { useActPin } from "./use-act-pin";

export function ActOneHero() {
  const containerRef = useRef<HTMLDivElement>(null);

  useActPin(containerRef, {
    duration: "+=150%", // pin por 1.5x viewport
  });

  return (
    <div ref={containerRef} className="relative">
      <Hero />
    </div>
  );
}
