"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Section, SectionHeader } from "@/components/landing/section";
import { ProofConsole, type ConsoleLine } from "@/components/landing/proof-console";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { COPY } from "@/content/copy";
import { DEMO_STEPS, EXPIRED_DEMO_STEPS, type DemoStep } from "@/lib/demo-script";
import { truncateWallet } from "@/lib/format";
import { DEVNET_TX_HASH, NULLIFIER, SOLSCAN_URL, VALID_PROOF } from "@/lib/proof-bytes";

type Phase =
  | "idle"
  | "generating"
  | "generated"
  | "submitting"
  | "submitted"
  | "expired";

function sumDuration(steps: readonly DemoStep[]): number {
  return steps.reduce((total, step) => total + step.durationMs, 0);
}

function shortHash(hex: string): string {
  return truncateWallet(hex, 10, 6);
}

export function DemoSection() {
  const { eyebrow, headline, initialTerminal, form, honestyFooter, expiredError } =
    COPY.demo;

  const defaultAmount =
    typeof form.amount.defaultValue === "number" ? form.amount.defaultValue : 1200;
  const defaultJurisdiction =
    typeof form.jurisdiction.defaultValue === "string"
      ? form.jurisdiction.defaultValue
      : "US";
  const defaultRecipient =
    typeof form.recipient.defaultValue === "string" ? form.recipient.defaultValue : "";

  const [phase, setPhase] = useState<Phase>("idle");
  const [lines, setLines] = useState<readonly ConsoleLine[]>([]);
  const [recipient, setRecipient] = useState(defaultRecipient);
  const [amount, setAmount] = useState(defaultAmount);
  const [jurisdiction, setJurisdiction] = useState(defaultJurisdiction);
  const [expired, setExpired] = useState(false);

  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timeoutsRef.current.forEach((t) => clearTimeout(t));
    timeoutsRef.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const schedule = useCallback((delay: number, fn: () => void) => {
    const id: ReturnType<typeof setTimeout> = setTimeout(() => {
      timeoutsRef.current = timeoutsRef.current.filter((t) => t !== id);
      fn();
    }, delay);
    timeoutsRef.current.push(id);
  }, []);

  const handleGenerate = useCallback(() => {
    clearTimers();
    setLines([]);
    setPhase("generating");

    const script: readonly DemoStep[] = expired ? EXPIRED_DEMO_STEPS : DEMO_STEPS;
    const totalMs = sumDuration(script);

    let elapsed = 0;
    script.forEach((step) => {
      elapsed += step.durationMs;
      const tick = elapsed;
      schedule(tick, () => {
        setLines((prev) => {
          const next: ConsoleLine[] = [
            ...prev,
            { kind: step.status === "ok" ? "ok" : "fail", text: step.label },
          ];
          if (step.status === "fail" && step.error) {
            next.push({ kind: "fail", text: step.error });
          }
          return next;
        });
      });
    });

    schedule(totalMs + 80, () => {
      if (expired) {
        setPhase("expired");
        return;
      }
      const durationSec = (totalMs / 1000).toFixed(2);
      setLines((prev) => [
        ...prev,
        { kind: "blank", text: "" },
        { kind: "result", text: `proof:     ${shortHash(VALID_PROOF)}` },
        { kind: "result", text: `nullifier: ${shortHash(NULLIFIER)}` },
        { kind: "result", text: `duration:  ${durationSec}s` },
      ]);
      setPhase("generated");
    });
  }, [clearTimers, expired, schedule]);

  const handleSubmit = useCallback(() => {
    setPhase("submitting");
    setLines((prev) => [
      ...prev,
      { kind: "blank", text: "" },
      { kind: "muted", text: "› submitting to devnet..." },
    ]);
    schedule(1500, () => {
      setLines((prev) => [
        ...prev,
        {
          kind: "success",
          text: `Transaction confirmed · ${shortHash(DEVNET_TX_HASH)} · View on Solscan ↗`,
          href: SOLSCAN_URL,
        },
      ]);
      setPhase("submitted");
    });
  }, [schedule]);

  const handleReset = useCallback(() => {
    clearTimers();
    setLines([]);
    setPhase("idle");
  }, [clearTimers]);

  const isWorking = phase === "generating" || phase === "submitting";
  const formDisabled = isWorking || phase === "generated";

  let ctaLabel: string;
  let ctaAction: () => void;
  if (phase === "idle") {
    ctaLabel = form.generateCta;
    ctaAction = handleGenerate;
  } else if (phase === "generating") {
    ctaLabel = "Generating…";
    ctaAction = handleGenerate;
  } else if (phase === "generated") {
    ctaLabel = form.submitCta;
    ctaAction = handleSubmit;
  } else if (phase === "submitting") {
    ctaLabel = "Submitting…";
    ctaAction = handleSubmit;
  } else {
    ctaLabel = "Run again";
    ctaAction = handleReset;
  }

  const statusMessage =
    phase === "idle"
      ? "Idle."
      : phase === "generating"
        ? "Generating proof."
        : phase === "generated"
          ? "Proof generated. Ready to submit to devnet."
          : phase === "submitting"
            ? "Submitting to devnet."
            : phase === "submitted"
              ? "Transaction confirmed on devnet."
              : expiredError;

  return (
    <Section id="demo" aria-labelledby="demo-heading">
      <SectionHeader
        eyebrow={eyebrow}
        headline={<span id="demo-heading">{headline}</span>}
        level="l"
      />
      <div className="mt-16 grid gap-8 md:mt-20 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-12">
        <form
          aria-label="Proof request"
          onSubmit={(e) => {
            e.preventDefault();
            ctaAction();
          }}
          className="flex flex-col gap-6 rounded-[var(--radius-6)] border border-border-subtle bg-surface p-6 md:p-8"
        >
          <label className="flex flex-col gap-2">
            <span className="font-mono text-xs uppercase tracking-[0.08em] text-quill">
              {form.recipient.label}
            </span>
            <Input
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder={form.recipient.placeholder}
              disabled={formDisabled}
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="flex items-baseline justify-between font-mono text-xs uppercase tracking-[0.08em] text-quill">
              <span>{form.amount.label}</span>
              <span className="text-stone">
                {amount} / {form.amount.max} USDC
              </span>
            </span>
            <Slider
              min={form.amount.min}
              max={form.amount.max}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              disabled={formDisabled}
              aria-label={form.amount.label}
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="font-mono text-xs uppercase tracking-[0.08em] text-quill">
              {form.jurisdiction.label}
            </span>
            <Select
              value={jurisdiction}
              onChange={(e) => setJurisdiction(e.target.value)}
              disabled={formDisabled}
            >
              {form.jurisdiction.options?.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </Select>
          </label>
          <div className="flex flex-col gap-3">
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={isWorking}
              className="w-full"
            >
              {ctaLabel}
            </Button>
            <label className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.08em] text-stone">
              <input
                type="checkbox"
                className="h-4 w-4 rounded-[2px] border border-border accent-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
                checked={expired}
                onChange={(e) => setExpired(e.target.checked)}
                disabled={formDisabled}
              />
              {form.expiredToggle}
            </label>
          </div>
        </form>
        <div className="flex flex-col gap-3">
          <ProofConsole initial={initialTerminal} lines={lines} />
          <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
            {statusMessage}
          </div>
          <p className="font-mono text-xs text-muted">{honestyFooter}</p>
        </div>
      </div>
    </Section>
  );
}
