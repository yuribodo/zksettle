"use client";

import { cn } from "@/lib/cn";

export type ConsoleLine =
  | { kind: "ok"; text: string }
  | { kind: "fail"; text: string }
  | { kind: "muted"; text: string }
  | { kind: "blank"; text: string }
  | { kind: "result"; text: string }
  | { kind: "success"; text: string; href: string };

const LINE_CLASS: Record<ConsoleLine["kind"], string> = {
  ok: "text-stone",
  fail: "text-danger-text",
  muted: "text-muted",
  blank: "",
  result: "text-forest",
  success: "text-forest",
};

export interface ProofConsoleProps {
  initial: string;
  lines: readonly ConsoleLine[];
  className?: string;
}

export function ProofConsole({ initial, lines, className }: ProofConsoleProps) {
  return (
    <div
      role="log"
      aria-live="polite"
      aria-atomic="false"
      aria-label="Proof console"
      className={cn(
        "min-h-[280px] rounded-[var(--radius-6)] border border-border-subtle bg-surface-deep p-6 font-mono text-sm leading-relaxed",
        className,
      )}
    >
      {lines.length === 0 ? (
        <p className="text-stone">{initial}</p>
      ) : (
        <ol className="flex flex-col gap-0.5">
          {lines.map((line, i) => (
            <li
              key={i}
              className={cn("whitespace-pre-wrap break-words", LINE_CLASS[line.kind])}
            >
              {line.kind === "blank" ? (
                "\u00a0"
              ) : line.kind === "success" ? (
                <a
                  href={line.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="underline decoration-forest decoration-1 underline-offset-4 hover:text-forest-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
                >
                  {line.text}
                </a>
              ) : (
                line.text
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
