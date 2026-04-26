"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { ScrollTrigger, brandMatchMedia } from "@/lib/gsap";
import { cn } from "@/lib/cn";

export interface PinnedSectionProps {
  children: ReactNode;
  pinDuration?: number;
  onProgress?: (progress: number) => void;
  showProgress?: boolean;
  className?: string;
}

export function PinnedSection({
  children,
  pinDuration = 1.5,
  onProgress,
  showProgress = false,
  className,
}: PinnedSectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const onProgressRef = useRef(onProgress);
  const [progress, setProgress] = useState(0);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    onProgressRef.current = onProgress;
  }, [onProgress]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    let trigger: ScrollTrigger | null = null;

    const mm = brandMatchMedia((conditions) => {
      if (!conditions.isDesktop) return;

      setPinned(true);
      trigger = ScrollTrigger.create({
        trigger: node,
        start: "top top",
        end: () => `+=${window.innerHeight * pinDuration}`,
        pin: true,
        pinSpacing: true,
        scrub: true,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          const p = self.progress;
          setProgress(p);
          onProgressRef.current?.(p);
        },
      });

      return () => {
        setPinned(false);
        setProgress(0);
        trigger?.kill();
        trigger = null;
      };
    });

    return () => {
      mm.kill();
    };
  }, [pinDuration]);

  return (
    <div ref={ref} className={cn("relative", className)}>
      {children}
      {showProgress ? (
        <div
          aria-hidden="true"
          data-pinned={pinned ? "true" : "false"}
          className={cn(
            "pointer-events-none absolute bottom-8 left-1/2 z-10 hidden h-px w-40 -translate-x-1/2 bg-border-subtle",
            "md:block",
          )}
        >
          <div
            className="h-full origin-left bg-forest"
            style={{ transform: `scaleX(${progress})` }}
          />
          <span className="mt-3 block text-center font-mono text-[10px] uppercase tracking-[0.12em] text-stone">
            Scroll progress · {Math.round(progress * 100)}%
          </span>
        </div>
      ) : null}
    </div>
  );
}
