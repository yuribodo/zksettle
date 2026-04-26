"use client";

import { useEffect, useState, type RefObject } from "react";

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export function useScrollProgress(ref: RefObject<HTMLElement | null>): number {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (node === null || typeof window === "undefined") return;

    const compute = () => {
      const rect = node.getBoundingClientRect();
      const viewport = window.innerHeight || 0;
      const total = rect.height + viewport;
      if (total <= 0) {
        setProgress(0);
        return;
      }
      const traveled = viewport - rect.top;
      setProgress(clamp01(traveled / total));
    };

    compute();
    window.addEventListener("scroll", compute, { passive: true });
    window.addEventListener("resize", compute);

    return () => {
      window.removeEventListener("scroll", compute);
      window.removeEventListener("resize", compute);
    };
  }, [ref]);

  return progress;
}
