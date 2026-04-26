import { useEffect, useRef, useState } from "react";

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%&*+=?/\\|<>~^";

function randomGlyph(): string {
  return GLYPHS[Math.floor(Math.random() * GLYPHS.length)]!;
}

export type CipherState = {
  display: string[];
  decoded: boolean[];
  done: boolean;
};

export function useCipherDecode(
  text: string,
  opts: {
    startDelay?: number;
    charDelay?: number;
    scrambleDuration?: number;
    lastWordExtraDelay?: number;
    active?: boolean;
  } = {},
): CipherState {
  const {
    startDelay = 600,
    charDelay = 40,
    scrambleDuration = 400,
    lastWordExtraDelay = 500,
    active = true,
  } = opts;

  const [display, setDisplay] = useState<string[]>(() => Array.from(text));
  const [decoded, setDecoded] = useState<boolean[]>(() =>
    Array.from(text, () => true),
  );
  const [done, setDone] = useState(true);
  const rafRef = useRef(0);
  const startTimeRef = useRef(0);
  const mounted = useRef(false);

  const lastWordStart = text.lastIndexOf(" ") + 1;

  useEffect(() => {
    if (!active || mounted.current) return;
    mounted.current = true;

    setDisplay(Array.from(text, (ch) => (ch === " " ? " " : randomGlyph())));
    setDecoded(Array.from(text, () => false));
    setDone(false);

    const start = performance.now();
    startTimeRef.current = start;

    const tick = () => {
      const elapsed = performance.now() - start;
      const newDisplay = Array.from(text);
      const newDecoded = Array.from(text, () => false);
      let allDone = true;

      for (let i = 0; i < text.length; i++) {
        if (text[i] === " ") {
          newDisplay[i] = " ";
          newDecoded[i] = true;
          continue;
        }

        const isLastWord = i >= lastWordStart;
        const extraDelay = isLastWord ? lastWordExtraDelay : 0;
        const charStart = startDelay + i * charDelay + extraDelay;
        const charEnd = charStart + scrambleDuration;

        if (elapsed < charStart) {
          newDisplay[i] = randomGlyph();
          allDone = false;
        } else if (elapsed < charEnd) {
          newDisplay[i] = randomGlyph();
          allDone = false;
        } else {
          newDisplay[i] = text[i]!;
          newDecoded[i] = true;
        }
      }

      setDisplay(newDisplay);
      setDecoded(newDecoded);

      if (allDone) {
        setDone(true);
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [active, text, startDelay, charDelay, scrambleDuration, lastWordExtraDelay, lastWordStart]);

  return { display, decoded, done };
}
