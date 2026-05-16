"use client";

import { useEffect, useRef, useState, useCallback, type ReactNode } from "react";
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
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConnectWalletButton } from "@/components/wallet/connect-wallet-button";
import { ProofStepCard } from "@/components/dashboard/proof-step-card";
import { ProveProgressBar } from "@/components/dashboard/prove-progress-bar";
import { PublicKey as SolPublicKey } from "@solana/web3.js";
import { useProveFlow, type TransferParams } from "@/hooks/use-prove-flow";
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

function CopyButton({ text, label }: Readonly<{ text: string; label: string }>) {
  const [copied, setCopied] = useState(false);

  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copied to clipboard");
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
      className="inline-flex cursor-pointer items-center gap-1 rounded-[var(--radius-2)] px-1.5 py-0.5 font-mono text-[11px] text-muted transition-colors hover:bg-surface-deep hover:text-stone"
    >
      <Copy className="size-3" strokeWidth={1.5} aria-hidden="true" />
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

/* ── Step inline content ─────────────────────────────────────────── */

interface StepContentProps {
  readonly index: number;
  readonly state: FlowState;
  readonly startDemo: () => void;
  readonly isRunning: boolean;
}

function StepRunningContent(): ReactNode {
  return <ElapsedTimer />;
}

function StepErrorContent({ index, step, startDemo, isRunning }: Readonly<{ index: number; step: { error?: string }; startDemo: () => void; isRunning: boolean }>): ReactNode {
  if (index === 0) return <ConnectWalletButton size="sm" />;
  if (index === 1 && step.error?.includes("No credential")) {
    return (
      <Button size="sm" variant="ghost" onClick={startDemo} disabled={isRunning}>
        <Sparks className="size-4" strokeWidth={1.5} aria-hidden="true" />
        Run with test data instead
      </Button>
    );
  }
  return null;
}

function CredentialSuccess({ data }: Readonly<{ data: unknown }>): ReactNode {
  const d = data as { jurisdiction?: string; demo?: boolean };
  if (d.demo) return <Badge variant="default"><Sparks className="size-3" strokeWidth={1.5} aria-hidden="true" />Test data</Badge>;
  if (d.jurisdiction) return <Badge variant="success">Jurisdiction: {d.jurisdiction}</Badge>;
  return null;
}

function SubmitSuccess({ data, mode }: Readonly<{ data: unknown; mode: string }>): ReactNode {
  const d = data as { signature?: string; skipped?: boolean } | undefined;
  if (mode === "demo" || d?.skipped) {
    return <Badge variant="default"><Sparks className="size-3" strokeWidth={1.5} aria-hidden="true" />Skipped in demo</Badge>;
  }
  if (d?.signature) {
    return (
      <div className="flex items-center gap-2">
        <code className="font-mono text-[11px] text-stone">{d.signature.slice(0, 16)}...{d.signature.slice(-8)}</code>
        <CopyButton text={d.signature} label="Copy transaction signature" />
      </div>
    );
  }
  return null;
}

function StepSuccessContent({ index, step, state }: Readonly<{ index: number; step: { data?: unknown }; state: FlowState }>): ReactNode {
  if (!step.data && index !== 4) return null;
  switch (index) {
    case 1: return <CredentialSuccess data={step.data} />;
    case 2: {
      const d = step.data as { root?: string; demo?: boolean };
      return (!d.demo && d.root) ? <span className="font-mono text-[11px] text-muted">root: {d.root}...</span> : null;
    }
    case 3: {
      const d = step.data as { proofPreview: string; publicInputCount: number };
      return (
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] text-stone">{d.publicInputCount} public inputs</span>
          <CopyButton text={d.proofPreview} label="Copy proof bytes" />
        </div>
      );
    }
    case 4: return <SubmitSuccess data={step.data} mode={state.mode} />;
    default: return null;
  }
}

function StepContent({ index, state, startDemo, isRunning }: StepContentProps): ReactNode {
  const step = state.steps[index]!;

  switch (step.status) {
    case "running": return <StepRunningContent />;
    case "error": return <StepErrorContent index={index} step={step} startDemo={startDemo} isRunning={isRunning} />;
    case "success": return <StepSuccessContent index={index} step={step} state={state} />;
    default: return null;
  }
}

/* ── Intro card (shown before flow starts) ───────────────────────── */

function IntroCard({
  connected,
  canStart,
  onStart,
  onDemo,
  transferParams,
  onTransferParamsChange,
  formError,
}: Readonly<{
  connected: boolean;
  canStart: boolean;
  onStart: () => void;
  onDemo: () => void;
  transferParams: TransferParams;
  onTransferParamsChange: (params: TransferParams) => void;
  formError: string | null;
}>) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6, transition: { duration: 0.2 } }}
      className="rounded-[var(--radius-6)] border border-forest/20 bg-surface p-6"
    >
      <div className="flex flex-col gap-5">
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
            {!connected && (
              <>
                <ConnectWalletButton />
                <p className="text-center text-[11px] text-muted">
                  Connect a wallet to begin
                </p>
              </>
            )}
          </div>
        </div>

        {connected && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase">Mint address</span>
                <input
                  type="text"
                  placeholder="Token mint public key"
                  value={transferParams.mint}
                  onChange={(e) => onTransferParamsChange({ ...transferParams, mint: e.target.value })}
                  className="h-9 w-full rounded-[var(--radius-2)] border border-border-subtle bg-canvas px-3 font-mono text-xs text-ink placeholder:text-muted transition-colors hover:border-border focus-visible:border-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
                />
                <span className="mt-1 text-[11px] leading-snug text-muted">
                  Public key of the Token-2022 mint you&apos;re transferring (the
                  asset itself, not a wallet). Paste an SPL mint deployed on
                  devnet — e.g. the stablecoin mint configured for this
                  environment.
                </span>
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase">Recipient address</span>
                <input
                  type="text"
                  placeholder="Destination wallet public key"
                  value={transferParams.recipient}
                  onChange={(e) => onTransferParamsChange({ ...transferParams, recipient: e.target.value })}
                  className="h-9 w-full rounded-[var(--radius-2)] border border-border-subtle bg-canvas px-3 font-mono text-xs text-ink placeholder:text-muted transition-colors hover:border-border focus-visible:border-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
                />
                <span className="mt-1 inline-flex items-center gap-1 self-start rounded-[var(--radius-2)] border border-warning-text/40 bg-warning-bg px-1.5 py-0.5 font-mono text-[10px] tracking-[0.05em] text-warning-text uppercase">
                  Devnet wallet only — no mainnet
                </span>
              </label>
            </div>
            <label className="flex flex-col gap-1 sm:max-w-[calc(50%-0.375rem)]">
              <span className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase">Amount</span>
              <input
                type="number"
                min={1}
                value={transferParams.amount}
                onChange={(e) => onTransferParamsChange({ ...transferParams, amount: Number(e.target.value) || 0 })}
                className="h-9 w-full rounded-[var(--radius-2)] border border-border-subtle bg-canvas px-3 font-mono text-xs text-ink placeholder:text-muted transition-colors hover:border-border focus-visible:border-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
              />
            </label>

            {formError && (
              <p className="text-xs text-red-500">{formError}</p>
            )}

            <div className="flex items-center gap-3">
              <Button onClick={onStart} disabled={!canStart}>
                <Flash className="size-4" strokeWidth={1.5} aria-hidden="true" />
                Start proof flow
              </Button>
              <Button variant="ghost" size="sm" onClick={onDemo}>
                <Sparks className="size-4" strokeWidth={1.5} aria-hidden="true" />
                Run demo
              </Button>
            </div>
          </>
        )}
      </div>
    </motion.section>
  );
}

/* ── Summary card (shown after flow completes) ───────────────────── */

function SummaryCard({
  state,
  txUrl,
  onReset,
}: Readonly<{
  state: FlowState;
  txUrl: string | null;
  onReset: () => void;
}>) {
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
            className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-[var(--radius-3)] bg-forest px-3 text-sm font-medium text-canvas transition-colors hover:bg-forest-hover"
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

function MiniStat({ label, value }: Readonly<{ label: string; value: string }>) {
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

  const [transferParams, setTransferParams] = useState<TransferParams>({
    mint: "",
    recipient: "",
    amount: 1000,
  });
  const [formError, setFormError] = useState<string | null>(null);

  const handleStart = useCallback(() => {
    if (!transferParams.mint.trim() || !transferParams.recipient.trim()) {
      setFormError("Mint and recipient addresses are required.");
      return;
    }
    try { new SolPublicKey(transferParams.mint); } catch {
      setFormError("Invalid mint address.");
      return;
    }
    try { new SolPublicKey(transferParams.recipient); } catch {
      setFormError("Invalid recipient address.");
      return;
    }
    if (transferParams.amount <= 0) {
      setFormError("Amount must be greater than zero.");
      return;
    }
    setFormError(null);
    startFlow(transferParams);
  }, [transferParams, startFlow]);

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
            onStart={handleStart}
            onDemo={startDemo}
            transferParams={transferParams}
            onTransferParamsChange={setTransferParams}
            formError={formError}
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
