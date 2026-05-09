"use client";

import { useEffect, useRef, useState } from "react";

const CHARS = "0123456789abcdef@#$%&*!?<>{}[]~^/\\|";

function randomChar(): string {
  return CHARS[Math.floor(Math.random() * CHARS.length)]!;
}

function scramble(text: string): string {
  return text
    .split("")
    .map((c) => (c === " " ? " " : randomChar()))
    .join("");
}

export type GlitchTextProps = {
  text: string;
  active?: boolean;
  className?: string;
};

export function GlitchText({
  text,
  active = false,
  className,
}: GlitchTextProps) {
  const [display, setDisplay] = useState(text);
  const rafRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    if (!active) {
      let lastUpdate = 0;
      const cycle = (now: number) => {
        if (cancelled) return;
        if (now - lastUpdate > 60) {
          setDisplay(scramble(text));
          lastUpdate = now;
        }
        rafRef.current = requestAnimationFrame(cycle);
      };
      rafRef.current = requestAnimationFrame(cycle);
      return () => {
        cancelled = true;
        cancelAnimationFrame(rafRef.current);
      };
    }

    let resolved = 0;
    let lastResolve = performance.now();
    let lastFrame = 0;
    let phase: "decode" | "idle" = "decode";
    let idleTimer = 0;
    let glitchIdx = -1;
    let glitchEnd = 0;

    const tick = (now: number) => {
      if (cancelled) return;

      if (phase === "decode") {
        if (now - lastResolve > 45) {
          while (resolved < text.length && text[resolved] === " ") resolved++;
          if (resolved < text.length) resolved++;
          lastResolve = now;
          if (resolved >= text.length) {
            phase = "idle";
            idleTimer = now;
            setDisplay(text);
            rafRef.current = requestAnimationFrame(tick);
            return;
          }
        }

        if (now - lastFrame > 35) {
          const chars = text.split("").map((c, i) => {
            if (c === " ") return " ";
            if (i < resolved) return c;
            return randomChar();
          });
          setDisplay(chars.join(""));
          lastFrame = now;
        }
      } else {
        if (glitchIdx >= 0 && now < glitchEnd) {
          setDisplay(
            text
              .split("")
              .map((c, i) => (i === glitchIdx ? randomChar() : c))
              .join(""),
          );
        } else if (glitchIdx >= 0) {
          setDisplay(text);
          glitchIdx = -1;
        }

        if (
          glitchIdx < 0 &&
          now - idleTimer > 3000 + Math.random() * 2000
        ) {
          const candidates: number[] = [];
          for (let i = 0; i < text.length; i++) {
            if (text[i] !== " ") candidates.push(i);
          }
          glitchIdx =
            candidates[Math.floor(Math.random() * candidates.length)]!;
          glitchEnd = now + 120;
          idleTimer = now;
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
    };
  }, [active, text]);

  return <span className={className}>{display}</span>;
}
