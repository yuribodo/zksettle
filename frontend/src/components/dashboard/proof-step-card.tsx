"use client";

import type { ReactNode } from "react";
import { Check, Xmark } from "iconoir-react";
import { AnimatePresence, motion } from "motion/react";

import { cn } from "@/lib/cn";
import type { StepStatus } from "@/lib/prove-flow";

interface ProofStepCardProps {
  stepNumber: number;
  title: string;
  description: string;
  status: StepStatus;
  durationMs?: number;
  error?: string;
  children?: ReactNode;
}

const STATUS_RING: Record<StepStatus, string> = {
  idle: "border-border-subtle bg-surface",
  running: "border-forest bg-surface",
  success: "border-emerald bg-mint",
  error: "border-danger-text bg-danger-bg",
};

export function ProofStepCard({
  stepNumber,
  title,
  description,
  status,
  durationMs,
  error,
  children,
}: ProofStepCardProps) {
  const isActive = status === "running" || status === "success" || status === "error";

  return (
    <div
      className={cn(
        "relative rounded-[var(--radius-6)] border px-5 py-4 transition-colors duration-200",
        status === "error"
          ? "border-danger-text/30 bg-surface"
          : status === "running"
            ? "border-forest/40 bg-surface"
            : status === "success"
              ? "border-emerald/40 bg-surface"
              : "border-border-subtle bg-surface",
        status === "idle" && "opacity-50",
      )}
    >
      <div className="flex items-start gap-4">
        {/* Step indicator */}
        <div
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full border-[1.5px] text-xs font-medium transition-colors",
            STATUS_RING[status],
          )}
          aria-hidden="true"
        >
          {status === "success" ? (
            <Check className="size-4 text-forest" strokeWidth={2} />
          ) : status === "error" ? (
            <Xmark className="size-4 text-danger-text" strokeWidth={2} />
          ) : status === "running" ? (
            <span className="size-2 animate-pulse rounded-full bg-forest" />
          ) : (
            <span className="text-muted">{stepNumber}</span>
          )}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <h3
              className={cn(
                "text-sm font-medium",
                isActive ? "text-ink" : "text-stone",
              )}
            >
              {title}
            </h3>
            {durationMs != null && status === "success" && (
              <span className="rounded-[var(--radius-2)] bg-mint px-1.5 py-0.5 font-mono text-[10px] font-medium text-forest">
                {durationMs < 1000
                  ? `${Math.round(durationMs)}ms`
                  : `${(durationMs / 1000).toFixed(1)}s`}
              </span>
            )}
          </div>

          <p
            className={cn(
              "mt-0.5 text-xs",
              isActive ? "text-stone" : "text-muted",
            )}
          >
            {description}
          </p>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 overflow-hidden rounded-[var(--radius-3)] border border-danger-text/20 bg-danger-bg px-3 py-2 font-mono text-xs text-danger-text"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {children && (
            <div className="mt-3">{children}</div>
          )}
        </div>
      </div>
    </div>
  );
}
