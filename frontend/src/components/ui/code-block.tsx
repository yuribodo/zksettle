"use client";

import { useEffect, useState } from "react";
import { codeToHtml, type SupportedLang } from "@/lib/shiki";
import { cn } from "@/lib/cn";

export interface CodeBlockProps {
  code: string;
  lang: SupportedLang;
  className?: string;
  ariaLabel?: string;
}

export function CodeBlock({ code, lang, className, ariaLabel }: CodeBlockProps) {
  const [html, setHtml] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    codeToHtml(code, lang).then((result) => {
      if (!cancelled) setHtml(result);
    });
    return () => { cancelled = true; };
  }, [code, lang]);

  return (
    <div
      aria-label={ariaLabel}
      className={cn(
        "zks-code overflow-x-auto rounded-[var(--radius-6)] border border-border-subtle bg-surface-deep",
        "[&>pre]:m-0 [&>pre]:bg-transparent [&>pre]:p-6 [&>pre]:font-mono [&>pre]:text-sm [&>pre]:leading-relaxed",
        className,
      )}
      dangerouslySetInnerHTML={html ? { __html: html } : undefined}
    />
  );
}
