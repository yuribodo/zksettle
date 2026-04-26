"use client";

import { useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { useMounted } from "@/hooks/use-mounted";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

export interface CountUpProps {
  target: number;
  duration?: number;
  formatter: (value: number) => string;
  teaseTo?: number;
  className?: string;
}

export function CountUp({
  target,
  duration = 1800,
  formatter,
  teaseTo = 0,
  className,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const mounted = useMounted();
  const reduced = useReducedMotion();
  const [value, setValue] = useState(teaseTo);

  useEffect(() => {
    if (!inView) return;
    if (reduced) {
      setValue(target);
      return;
    }

    setValue(teaseTo);
    const startTime = performance.now();
    let rafId = requestAnimationFrame(function tick(now) {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      const current = teaseTo + (target - teaseTo) * eased;
      setValue(current);
      if (t < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        setValue(target);
      }
    });

    return () => cancelAnimationFrame(rafId);
  }, [inView, reduced, target, teaseTo, duration]);

  const displayValue = mounted ? value : target;

  return (
    <span ref={ref} className={className}>
      <span className="sr-only">{formatter(target)}</span>
      <span aria-hidden="true">{formatter(displayValue)}</span>
    </span>
  );
}

CountUp.displayName = "CountUp";
