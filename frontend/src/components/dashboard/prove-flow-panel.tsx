"use client";

import type { ReactNode } from "react";
import { Flash } from "iconoir-react";

import { Button } from "@/components/ui/button";
import { ConnectWalletButton } from "@/components/wallet/connect-wallet-button";
import { ProofStepCard } from "@/components/dashboard/proof-step-card";
import { ProveProgressBar } from "@/components/dashboard/prove-progress-bar";
import { useProveFlow } from "@/hooks/use-prove-flow";
import { STEPS, type FlowState } from "@/lib/prove-flow";
import { useWallet } from "@/hooks/use-wallet-connection";

function StepContent({
  index,
  state,
  startDemo,
  isRunning,
  txUrl,
}: {
  index: number;
  state: FlowState;
  startDemo: () => void;
  isRunning: boolean;
  txUrl: string | null;
}): ReactNode {
  const step = state.steps[index]!;

  if (index === 0 && step.status === "error") {
    return <ConnectWalletButton size="sm" />;
  }

  if (
    index === 1 &&
    step.status === "error" &&
    step.error?.includes("No credential")
  ) {
    return (
      <Button size="sm" variant="ghost" onClick={startDemo} disabled={isRunning}>
        <Flash className="size-4" strokeWidth={1.5} aria-hidden="true" />
        Run with test data
      </Button>
    );
  }

  if (index === 3 && step.status === "success" && step.data) {
    const d = step.data as { proofPreview: string; publicInputCount: number };
    return (
      <div className="font-mono text-[11px] text-muted">
        <span className="text-stone">proof:</span> {d.proofPreview}…
        <br />
        <span className="text-stone">public inputs:</span> {d.publicInputCount} fields
      </div>
    );
  }

  if (index === 4 && step.status === "success") {
    if (state.mode === "demo") {
      return (
        <p className="font-mono text-[11px] text-muted">
          Skipped in demo mode — no on-chain transaction submitted.
        </p>
      );
    }
    if (step.data) {
      const d = step.data as { signature: string };
      return (
        <div className="font-mono text-[11px] text-muted">
          <span className="text-stone">tx:</span> {d.signature.slice(0, 24)}…
        </div>
      );
    }
  }

  if (index === 5 && step.status === "success") {
    if (state.mode === "demo") {
      return (
        <p className="text-xs text-forest">
          Demo complete. Proof was generated successfully in-browser.
        </p>
      );
    }
    if (txUrl) {
      return (
        <a
          href={txUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="text-xs text-forest underline decoration-forest decoration-1 underline-offset-4 hover:text-forest-hover"
        >
          View on Solscan
        </a>
      );
    }
  }

  return null;
}

export function ProveFlowPanel() {
  const { connected } = useWallet();
  const { state, startFlow, startDemo, reset, canStart, isRunning, isDone, txUrl } =
    useProveFlow();

  const progressSteps = STEPS.map((meta, i) => ({
    id: meta.id,
    label: meta.title,
    status: state.steps[i]!.status,
  }));

  return (
    <div className="flex flex-col gap-6">
      {/* Progress bar */}
      <div className="rounded-[var(--radius-6)] border border-border-subtle bg-surface px-5 py-4">
        <ProveProgressBar steps={progressSteps} currentStep={state.currentStep} />
      </div>

      {/* Step cards */}
      <div className="flex flex-col gap-3">
        {STEPS.map((meta, i) => (
          <ProofStepCard
            key={meta.id}
            stepNumber={i + 1}
            title={meta.title}
            description={meta.description}
            status={state.steps[i]!.status}
            durationMs={state.steps[i]!.durationMs}
            error={state.steps[i]!.error}
          >
            <StepContent
              index={i}
              state={state}
              startDemo={startDemo}
              isRunning={isRunning}
              txUrl={txUrl}
            />
          </ProofStepCard>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        {!isDone && !isRunning && (
          <>
            {connected ? (
              <Button onClick={startFlow} disabled={!canStart}>
                <Flash className="size-4" strokeWidth={1.5} aria-hidden="true" />
                Start proof flow
              </Button>
            ) : (
              <ConnectWalletButton />
            )}
            {connected && (
              <Button variant="ghost" onClick={startDemo} disabled={isRunning}>
                Run demo
              </Button>
            )}
          </>
        )}
        {(isDone || state.steps.some((s) => s.status === "error")) && (
          <Button variant="ghost" onClick={reset}>
            Reset
          </Button>
        )}
      </div>
    </div>
  );
}
