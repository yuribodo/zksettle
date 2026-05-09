"use client";

import { PublicKey } from "@solana/web3.js";
import { useState } from "react";

import { ConfirmActionDialog } from "@/components/dashboard/confirm-action-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type StablecoinActionResult,
  useStablecoinAction,
} from "@/hooks/use-stablecoin-action";
import {
  formatAmount,
  formatPubkey,
  getStablecoinAdapter,
  isValidPubkey,
  mintCapProgress,
  parseAmountToUnits,
  type Treasury,
} from "@/lib/stablecoin";

interface OperatorControlsProps {
  treasury: Treasury;
  onActionComplete: (result: StablecoinActionResult, summary: string) => void;
}

export function OperatorControls({
  treasury,
  onActionComplete,
}: Readonly<OperatorControlsProps>) {
  const adapter = getStablecoinAdapter();
  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const decimals = treasury.decimals;
  const destValid = isValidPubkey(destination);
  const amountUnits = parseAmountToUnits(amount.trim(), decimals);
  const amountValid = amountUnits !== null && !amountUnits.isZero();
  const wouldExceedCap =
    !treasury.mintCap.isZero() &&
    amountUnits !== null &&
    treasury.totalMinted.add(amountUnits).gt(treasury.mintCap);

  const mutation = useStablecoinAction({ mint: treasury.mint });

  const closeDialog = () => {
    if (mutation.isPending) return;
    setConfirmOpen(false);
    mutation.reset();
  };

  const submit = async () => {
    if (!destValid || !amountUnits) return;
    const dest = new PublicKey(destination.trim());
    try {
      const result = await mutation.mutateAsync(({ payer }) =>
        adapter.buildMintTokens({ payer }, treasury.mint, dest, amountUnits),
      );
      onActionComplete(result, `Minted ${amount} to ${formatPubkey(dest)}`);
      setConfirmOpen(false);
      setAmount("");
      setDestination("");
      mutation.reset();
    } catch {
      // surfaced via mutation.error
    }
  };

  const errorMessage =
    mutation.error instanceof Error ? mutation.error.message : null;
  const progress = mintCapProgress(treasury);

  const supplyText = progress.capped
    ? `${formatAmount(treasury.totalMinted, decimals)} / ${formatAmount(treasury.mintCap, decimals)}`
    : `${formatAmount(treasury.totalMinted, decimals)} (uncapped)`;

  const destFormatted = destValid
    ? formatPubkey(new PublicKey(destination.trim()), 6, 6)
    : "—";
  const capSuffix = progress.capped
    ? ` / ${formatAmount(treasury.mintCap, decimals)}`
    : "";

  return (
    <section className="rounded-[var(--radius-6)] border border-border-subtle bg-surface p-5">
      <div className="flex items-baseline justify-between">
        <h3 className="font-display text-base text-ink">Mint tokens</h3>
        <span className="font-mono text-[11px] text-stone">{supplyText}</span>
      </div>

      {progress.capped ? (
        <div
          className="mt-3 h-1.5 overflow-hidden rounded-[2px] bg-surface-deep"
          aria-label="Mint cap progress"
        >
          <div
            className="h-full bg-forest"
            style={{ width: `${Math.min(100, progress.ratio * 100)}%` }}
          />
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-3">
        <Input
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder="Destination wallet pubkey"
          className="font-mono text-xs"
        />
        <Input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount (e.g. 1000)"
          inputMode="decimal"
          className="font-mono text-xs"
        />
        {wouldExceedCap ? (
          <p className="font-mono text-xs text-rust">
            Amount would exceed the mint cap.
          </p>
        ) : null}
        <div>
          <Button
            size="sm"
            disabled={
              !destValid || !amountValid || wouldExceedCap || treasury.paused
            }
            onClick={() => setConfirmOpen(true)}
          >
            {treasury.paused ? "Paused" : "Mint"}
          </Button>
        </div>
      </div>

      <ConfirmActionDialog
        open={confirmOpen}
        title="Mint tokens?"
        description={
          <>
            Mint <code>{amount}</code> tokens to <code>{destFormatted}</code>?
            Current supply: {formatAmount(treasury.totalMinted, decimals)}
            {capSuffix}.
          </>
        }
        confirmLabel="Mint"
        pending={mutation.isPending}
        errorMessage={errorMessage}
        onConfirm={submit}
        onCancel={closeDialog}
      />
    </section>
  );
}
