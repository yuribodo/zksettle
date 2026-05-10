"use client";

import { useState } from "react";
import { Copy, Check } from "iconoir-react";
import { toast } from "sonner";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";

interface TruncatedHashProps {
  value: string;
  head?: number;
  tail?: number;
  className?: string;
  copyable?: boolean;
}

function truncate(value: string, head: number, tail: number): string {
  if (value.length <= head + tail + 3) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

export function TruncatedHash({
  value,
  head = 6,
  tail = 4,
  className,
  copyable = true,
}: Readonly<TruncatedHashProps>) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Tooltip>
      <TooltipTrigger
        className={cn(
          "inline-flex cursor-default items-center gap-1 font-mono",
          copyable && "cursor-pointer",
          className,
        )}
        onClick={copyable ? handleCopy : undefined}
      >
        <span>{truncate(value, head, tail)}</span>
        {copyable && (
          <span className="text-ghost transition-colors hover:text-stone">
            {copied ? (
              <Check className="size-3 text-emerald" />
            ) : (
              <Copy className="size-3" />
            )}
          </span>
        )}
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs break-all font-mono text-[11px]">
        {value}
      </TooltipContent>
    </Tooltip>
  );
}
