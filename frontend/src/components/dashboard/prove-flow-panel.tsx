"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Flash,
  ArrowUpRight,
  Copy,
  RefreshDouble,
  ShieldCheck,
  Timer,
  Sparks,
} from "iconoir-react";
import { AnimatePresence, motion } from "motion/react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConnectWalletButton } from "@/components/wallet/connect-wallet-button";
import { ProofStepCard } from "@/components/dashboard/proof-step-card";
import { ProveProgressBar } from "@/components/dashboard/prove-progress-bar";
import { useProveFlow } from "@/hooks/use-prove-flow";
import { STEPS, type FlowState } from "@/lib/prove-flow";
import { useWallet } from "@/hooks/use-wallet-connection";

/* ── Elapsed timer (shows live seconds on running steps) ─────────── */

function ElapsedTimer() {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(performance.now());

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.floor((performance.now() - startRef.current) / 1000));
    }, 200);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="inline-flex items-center gap-1 font-mono text-[11px] text-forest">
      <Timer className="size-3 animate-pulse" strokeWidth={2} aria-hidden="true" />
      {elapsed}s
    </span>
  );
}

/* ── Clipboard helper ────────────────────────────────────────────── */

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex items-center gap-1 rounded-[var(--radius-2)] px-1.5 py-0.5 font-mono text-[11px] text-muted transition-colors hover:bg-surface-deep hover:text-stone"
    >
      <Copy className="size-3" strokeWidth={1.5} aria-hidden="true" />
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

/* ── Step inline content ─────────────────────────────────────────── */

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

  if (step.status === "running") {
    return <ElapsedTimer />;
  }

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
        <Sparks className="size-4" strokeWidth={1.5} aria-hidden="true" />
        Run with test data instead
      </Button>
    );
  }

  if (index === 1 && step.status === "success" && step.data) {
    const d = step.data as { jurisdiction?: string; demo?: boolean };
    if (d.demo) {
      return (
        <Badge variant="default">
          <Sparks className="size-3" strokeWidth={1.5} aria-hidden="true" />
          Test data
        </Badge>
      );
    }
    if (d.jurisdiction) {
      return (
        <Badge variant="success">
          Jurisdiction: {d.jurisdiction}
        </Badge>
      );
    }
  }

  if (index === 2 && step.status === "success" && step.data) {
    const d = step.data as { root?: string; demo?: boolean };
    if (!d.demo && d.root) {
      return (
        <span className="font-mono text-[11px] text-muted">
          root: {d.root}...
        </span>
      );
    }
  }

  if (index === 3 && step.status === "success" && step.data) {
    const d = step.data as { proofPreview: string; publicInputCount: number };
    return (
      <div className="flex items-center gap-3">
        <span className="font-mono text-[11px] text-stone">
          {d.publicInputCount} public inputs
        </span>
        <CopyButton text={d.proofPreview} label="Copy proof bytes" />
      </div>
    );
  }

  if (index === 4 && step.status === "success") {
    if (state.mode === "demo") {
      return (
        <Badge variant="default">
          <Sparks className="size-3" strokeWidth={1.5} aria-hidden="true" />
          Skipped in demo
        </Badge>
      );
    }
    if (step.data) {
      const d = step.data as { signature: string };
      return (
        <div className="flex items-center gap-2">
          <code className="font-mono text-[11px] text-stone">
            {d.signature.slice(0, 16)}...{d.signature.slice(-8)}
          </code>
          <CopyButton text={d.signature} label="Copy transaction signature" />
        </div>
      );
    }
  }

  return null;
}

/* ── Intro card (shown before flow starts) ───────────────────────── */

function IntroCard({
  connected,
  canStart,
  onStart,
  onDemo,
}: {
  connected: boolean;
  canStart: boolean;
  onStart: () => void;
  onDemo: () => void;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6, transition: { duration: 0.2 } }}
      className="rounded-[var(--radius-6)] border border-forest/20 bg-surface p-6"
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-lg">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-forest" strokeWidth={1.5} aria-hidden="true" />
            <h2 className="text-sm font-medium text-ink">
              End-to-end compliance proof
            </h2>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-stone">
            This page generates a zero-knowledge proof that your wallet holds a valid issuer
            credential, is not on the sanctions list, and belongs to a permitted jurisdiction
            — then submits it on-chain for verification. The entire flow runs in your browser.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="default">Noir circuit</Badge>
            <Badge variant="default">Barretenberg WASM</Badge>
            <Badge variant="default">Solana devnet</Badge>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2">
          {connected ? (
            <>
              <Button onClick={onStart} disabled={!canStart}>
                <Flash className="size-4" strokeWidth={1.5} aria-hidden="true" />
                Start proof flow
              </Button>
              <Button variant="ghost" size="sm" onClick={onDemo}>
                <Sparks className="size-4" strokeWidth={1.5} aria-hidden="true" />
                Run demo
              </Button>
            </>
          ) : (
            <>
              <ConnectWalletButton />
              <p className="text-center text-[11px] text-muted">
                Connect a wallet to begin
              </p>
            </>
          )}
        </div>
      </div>
    </motion.section>
  );
}

/* ── Summary card (shown after flow completes) ───────────────────── */

function SummaryCard({
  state,
  txUrl,
  onReset,
}: {
  state: FlowState;
  txUrl: string | null;
  onReset: () => void;
}) {
  const totalMs = state.steps.reduce((sum, s) => sum + (s.durationMs ?? 0), 0);
  const proofStep = state.steps[3];
  const proofData = proofStep?.data as
    | { proofPreview?: string; publicInputCount?: number }
    | undefined;
  const submitData = state.steps[4]?.data as
    | { signature?: string }
    | undefined;
  const isDemo = state.mode === "demo";

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="rounded-[var(--radius-6)] border border-emerald/30 bg-surface p-6"
      aria-label="Flow result"
    >
      <div className="flex items-center gap-2">
        <div className="flex size-7 items-center justify-center rounded-full bg-mint">
          <ShieldCheck className="size-4 text-forest" strokeWidth={2} aria-hidden="true" />
        </div>
        <h2 className="text-sm font-medium text-ink">
          {isDemo ? "Demo complete" : "Settlement verified"}
        </h2>
        <Badge variant={isDemo ? "default" : "success"}>
          {isDemo ? "Demo" : "Devnet"}
        </Badge>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-stone">
        {isDemo
          ? "A real ZK proof was generated in-browser using test data. Connect a credentialed wallet and run the live flow to submit on-chain."
          : "Your compliance proof was verified on Solana devnet. The transaction is final and publicly auditable."}
      </p>

      {/* Stats row */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat label="Total time" value={formatDuration(totalMs)} />
        <MiniStat
          label="Proof gen"
          value={formatDuration(proofStep?.durationMs ?? 0)}
        />
        <MiniStat
          label="Public inputs"
          value={String(proofData?.publicInputCount ?? "—")}
        />
        <MiniStat
          label="Mode"
          value={isDemo ? "Demo" : "Live"}
        />
      </div>

      {/* Proof preview */}
      {proofData?.proofPreview && (
        <div className="mt-4 rounded-[var(--radius-3)] bg-surface-deep px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
              Proof bytes (first 32)
            </span>
            <CopyButton text={proofData.proofPreview} label="Copy proof bytes" />
          </div>
          <code className="mt-1 block break-all font-mono text-xs text-stone">
            {proofData.proofPreview}
          </code>
        </div>
      )}

      {/* Transaction link */}
      {!isDemo && submitData?.signature && (
        <div className="mt-4 rounded-[var(--radius-3)] bg-surface-deep px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
              Transaction
            </span>
            <CopyButton text={submitData.signature} label="Copy transaction signature" />
          </div>
          <code className="mt-1 block break-all font-mono text-xs text-stone">
            {submitData.signature}
          </code>
        </div>
      )}

      {/* Actions */}
      <div className="mt-5 flex items-center gap-3">
        {txUrl && (
          <a
            href={txUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex h-8 items-center gap-2 rounded-[var(--radius-3)] bg-forest px-3 text-sm font-medium text-canvas transition-colors hover:bg-forest-hover"
          >
            View on Solscan
            <ArrowUpRight className="size-3.5" strokeWidth={2} aria-hidden="true" />
          </a>
        )}
        <Button variant="ghost" size="sm" onClick={onReset}>
          <RefreshDouble className="size-4" strokeWidth={1.5} aria-hidden="true" />
          Run again
        </Button>
      </div>
    </motion.section>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[10px] tracking-[0.06em] text-muted uppercase">
        {label}
      </span>
      <span className="font-mono text-sm font-medium text-ink">{value}</span>
    </div>
  );
}

function formatDuration(ms: number): string {
  if (ms === 0) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/* ── Main panel ──────────────────────────────────────────────────── */

export function ProveFlowPanel() {
  const { connected } = useWallet();
  const { state, startFlow, startDemo, reset, canStart, isRunning, isDone, txUrl } =
    useProveFlow();

  const hasStarted = state.currentStep >= 0;
  const hasError = state.steps.some((s) => s.status === "error");

  const progressSteps = STEPS.map((meta, i) => ({
    id: meta.id,
    label: meta.title,
    status: state.steps[i]!.status,
  }));

  return (
    <div className="flex flex-col gap-6">
      <AnimatePresence mode="wait">
        {/* Intro card — only before flow starts */}
        {!hasStarted && !isDone && (
          <IntroCard
            key="intro"
            connected={connected}
            canStart={canStart}
            onStart={startFlow}
            onDemo={startDemo}
          />
        )}

        {/* Summary card — after flow completes */}
        {isDone && (
          <SummaryCard
            key="summary"
            state={state}
            txUrl={txUrl}
            onReset={reset}
          />
        )}
      </AnimatePresence>

      {/* Progress bar — visible during and after flow */}
      {hasStarted && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[var(--radius-6)] border border-border-subtle bg-surface px-5 py-4"
        >
          <ProveProgressBar steps={progressSteps} currentStep={state.currentStep} />
        </motion.div>
      )}

      {/* Step cards — visible during and after flow */}
      {hasStarted && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.05 }}
          className="flex flex-col gap-3"
        >
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
        </motion.div>
      )}

      {/* Error reset — only on error */}
      {hasError && !isDone && (
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={reset}>
            <RefreshDouble className="size-4" strokeWidth={1.5} aria-hidden="true" />
            Reset and try again
          </Button>
        </div>
      )}
    </div>
  );
}
