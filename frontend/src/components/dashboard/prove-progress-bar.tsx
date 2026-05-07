"use client";

import { cn } from "@/lib/cn";
import type { StepStatus } from "@/lib/prove-flow";

interface ProgressStep {
  id: string;
  label: string;
  status: StepStatus;
}

interface ProveProgressBarProps {
  steps: ProgressStep[];
  currentStep: number;
}

const DOT_CLASS: Record<StepStatus, string> = {
  idle: "border-border-subtle bg-surface",
  running: "border-forest bg-forest animate-pulse",
  success: "border-emerald bg-emerald",
  error: "border-danger-text bg-danger-text",
};

export function ProveProgressBar({ steps, currentStep }: Readonly<ProveProgressBarProps>) {
  const completedCount = steps.filter((s) => s.status === "success").length;

  return (
    <>
      <progress className="sr-only" value={completedCount} max={steps.length}>
        {completedCount}/{steps.length} steps complete
      </progress>
      {/* Desktop: dot indicators */}
      <div className="hidden items-center gap-1 md:flex" aria-label="Proof flow progress">
        {steps.map((step, i) => (
          <div key={step.id} className="flex items-center">
            <div
              className={cn(
                "size-2.5 rounded-full border-[1.5px] transition-colors duration-200",
                DOT_CLASS[step.status],
              )}
              title={step.label}
            />
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "mx-1 h-px w-6 transition-colors duration-200",
                  step.status === "success" ? "bg-emerald" : "bg-border-subtle",
                )}
              />
            )}
          </div>
        ))}
        <span className="ml-3 font-mono text-[11px] text-muted">
          {completedCount}/{steps.length}
        </span>
      </div>

      {/* Mobile: compact bar */}
      <div className="flex items-center gap-3 md:hidden">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-border-subtle">
          <div
            className="h-full rounded-full bg-forest transition-all duration-300"
            style={{ width: `${steps.length > 0 ? (completedCount / steps.length) * 100 : 0}%` }}
          />
        </div>
        <span className="shrink-0 font-mono text-[11px] text-muted">
          {currentStep >= 0
            ? `Step ${Math.min(currentStep + 1, steps.length)} of ${steps.length}`
            : "Ready"}
        </span>
      </div>
    </>
  );
}
