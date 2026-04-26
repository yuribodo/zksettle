import { useMemo } from "react";

export type HeadlineChar = {
  /** Original character — including spaces. */
  char: string;
  /** Stable key for React. */
  key: string;
  /** True for whitespace; consumers may render an `&nbsp;` to preserve width. */
  isSpace: boolean;
  /** Word index (so spaces don't break ligatures of the same word visually). */
  wordIndex: number;
};

/**
 * Manual character split for entrance animation. SplitText is paid GSAP plugin
 * and is not in the dependency tree.
 */
export function useHeadlineSplit(text: string): HeadlineChar[] {
  return useMemo(() => {
    const chars: HeadlineChar[] = [];
    let wordIndex = 0;
    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i] ?? "";
      const isSpace = ch === " ";
      chars.push({ char: ch, key: `${i}-${ch}`, isSpace, wordIndex });
      if (isSpace) wordIndex += 1;
    }
    return chars;
  }, [text]);
}
