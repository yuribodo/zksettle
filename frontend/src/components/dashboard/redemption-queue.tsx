"use client";

import { useState, type ReactNode } from "react";

import { ConfirmActionDialog } from "@/components/dashboard/confirm-action-dialog";
import { StatusPill } from "@/components/dashboard/status-pill";
import { Button } from "@/components/ui/button";
import { useRedemptionRequests } from "@/hooks/use-redemption-requests";
import {
  type StablecoinActionResult,
  useStablecoinAction,
} from "@/hooks/use-stablecoin-action";
import {
  formatAmount,
  formatDuration,
  formatPubkey,
  getStablecoinAdapter,
  redemptionExpiry,
  type RedemptionRequest,
  type Treasury,
} from "@/lib/stablecoin";

interface RedemptionQueueProps {
  treasury: Treasury;
  onActionComplete: (result: StablecoinActionResult, summary: string) => void;
}

interface PendingAction {
  request: RedemptionRequest;
  kind: "approve" | "cancel";
  title: string;
  description: ReactNode;
  summary: string;
}

interface RedemptionRowProps {
  treasury: Treasury;
  request: RedemptionRequest;
  onApprove: () => void;
  onCancel: () => void;
}

function RedemptionRow({
  treasury,
  request,
  onApprove,
  onCancel,
}: Readonly<RedemptionRowProps>) {
  const expiry = redemptionExpiry(request);
  const amountText = formatAmount(request.amount, treasury.decimals);

  let timeIndicator: ReactNode;
  if (expiry.expired) {
    timeIndicator = <StatusPill kind="warning" label="Expired" />;
  } else {
    timeIndicator = (
      <span className="font-mono text-[11px] text-muted">
        {formatDuration(expiry.secondsRemaining)} left
      </span>
    );
  }

  let actionButton: ReactNode;
  if (expiry.expired) {
    actionButton = (
      <Button size="sm" variant="ghost" onClick={onCancel}>
        Cancel (expired)
      </Button>
    );
  } else {
    actionButton = (
      <Button size="sm" onClick={onApprove} disabled={treasury.paused}>
        Approve
      </Button>
    );
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-col">
        <span className="font-mono text-xs text-quill">
          {formatPubkey(request.holder, 6, 6)}
        </span>
        <span className="text-xs text-stone">
          {amountText} tokens · nonce {request.nonce.toString()}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {timeIndicator}
        {actionButton}
      </div>
    </li>
  );
}

interface RedemptionListProps {
  treasury: Treasury;
  isError: boolean;
  error: unknown;
  isLoading: boolean;
  requests: RedemptionRequest[];
  onApprove: (request: RedemptionRequest) => void;
  onCancel: (request: RedemptionRequest) => void;
}

function RedemptionList({
  treasury,
  isError,
  error,
  isLoading,
  requests,
  onApprove,
  onCancel,
}: Readonly<RedemptionListProps>) {
  if (isError) {
    return (
      <p role="alert" className="mt-4 font-mono text-xs text-rust">
        Failed to load redemptions:{" "}
        {error instanceof Error ? error.message : "unknown error"}
      </p>
    );
  }
  if (isLoading) {
    return <p className="mt-4 font-mono text-xs text-muted">Loading…</p>;
  }
  if (requests.length === 0) {
    return (
      <p className="mt-4 font-mono text-xs text-muted">No pending redemptions.</p>
    );
  }
  return (
    <ul className="mt-4 flex flex-col divide-y divide-border-subtle">
      {requests.map((request) => (
        <RedemptionRow
          key={request.pda.toBase58()}
          treasury={treasury}
          request={request}
          onApprove={() => onApprove(request)}
          onCancel={() => onCancel(request)}
        />
      ))}
    </ul>
  );
}

export function RedemptionQueue({
  treasury,
  onActionComplete,
}: Readonly<RedemptionQueueProps>) {
  const adapter = getStablecoinAdapter();
  const { data, isLoading, isError, error } = useRedemptionRequests(
    treasury.mint,
  );
  const [pending, setPending] = useState<PendingAction | null>(null);

  const mutation = useStablecoinAction({ mint: treasury.mint });

  const closeDialog = () => {
    if (mutation.isPending) return;
    setPending(null);
    mutation.reset();
  };

  const submit = async () => {
    if (!pending) return;
    const { request, kind } = pending;
    try {
      const result = await mutation.mutateAsync(({ payer }) =>
        kind === "approve"
          ? adapter.buildApproveRedemption({ payer }, treasury.mint, request)
          : adapter.buildCancelRedemption({ payer }, treasury.mint, request),
      );
      onActionComplete(result, pending.summary);
      setPending(null);
      mutation.reset();
    } catch {
      // surfaced via mutation.error
    }
  };

  const onApprove = (request: RedemptionRequest) => {
    const amountText = formatAmount(request.amount, treasury.decimals);
    setPending({
      request,
      kind: "approve",
      title: "Approve redemption?",
      description: (
        <>
          Approve redemption of <code>{amountText}</code> tokens for{" "}
          <code>{formatPubkey(request.holder, 6, 6)}</code>? Tokens will be
          burned.
        </>
      ),
      summary: `Redemption approved for ${formatPubkey(request.holder)}`,
    });
  };

  const onCancel = (request: RedemptionRequest) => {
    setPending({
      request,
      kind: "cancel",
      title: "Cancel redemption?",
      description:
        "The holder regains transfer ability and the request is closed.",
      summary: `Redemption cancelled for ${formatPubkey(request.holder)}`,
    });
  };

  const errorMessage =
    mutation.error instanceof Error ? mutation.error.message : null;

  const requests = data ?? [];

  return (
    <section className="rounded-[var(--radius-6)] border border-border-subtle bg-surface p-5">
      <div className="flex items-baseline justify-between">
        <h3 className="font-display text-base text-ink">Redemption queue</h3>
        <span className="font-mono text-[11px] text-muted">
          {requests.length} open
        </span>
      </div>

      <RedemptionList
        treasury={treasury}
        isError={isError}
        error={error}
        isLoading={isLoading}
        requests={requests}
        onApprove={onApprove}
        onCancel={onCancel}
      />

      <ConfirmActionDialog
        open={!!pending}
        title={pending?.title ?? ""}
        description={pending?.description ?? null}
        confirmLabel={pending?.kind === "approve" ? "Approve" : "Cancel"}
        destructive={pending?.kind === "cancel"}
        pending={mutation.isPending}
        errorMessage={errorMessage}
        onConfirm={submit}
        onCancel={closeDialog}
      />
    </section>
  );
}
