"use client";

import { PublicKey } from "@solana/web3.js";
import { useState, type ReactNode } from "react";

import { ConfirmActionDialog } from "@/components/dashboard/confirm-action-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type BuildTransactionFn,
  type StablecoinActionResult,
  useStablecoinAction,
} from "@/hooks/use-stablecoin-action";
import {
  formatAmount,
  formatPubkey,
  getStablecoinAdapter,
  isValidPubkey,
  parseAmountToUnits,
  pubkeysEqual,
  type Treasury,
} from "@/lib/stablecoin";

type OnActionComplete = (
  result: StablecoinActionResult,
  summary: string,
) => void;

interface PendingAction {
  title: string;
  description: ReactNode;
  destructive?: boolean;
  summary: string;
  confirmLabel: string;
  buildTransaction: BuildTransactionFn;
}

interface AdminControlsProps {
  treasury: Treasury;
  walletPublicKey: PublicKey;
  onActionComplete: OnActionComplete;
  isPendingAdmin: boolean;
}

interface SubPanelProps {
  treasury: Treasury;
  onActionComplete: OnActionComplete;
}

function PanelSection({
  title,
  description,
  children,
}: Readonly<{
  title: string;
  description: string;
  children: ReactNode;
}>) {
  return (
    <section className="rounded-[var(--radius-6)] border border-border-subtle bg-surface p-5">
      <h3 className="font-display text-base text-ink">{title}</h3>
      <p className="mt-1 text-xs text-stone">{description}</p>
      <div className="mt-4 flex flex-col gap-3">{children}</div>
    </section>
  );
}

interface UseConfirmAction {
  pending: PendingAction | null;
  queue: (action: PendingAction) => void;
  close: () => void;
  submit: () => Promise<void>;
  isSubmitting: boolean;
  errorMessage: string | null;
}

function useConfirmAction(
  mint: PublicKey,
  onActionComplete: OnActionComplete,
): UseConfirmAction {
  const [pending, setPending] = useState<PendingAction | null>(null);
  const mutation = useStablecoinAction({ mint });

  const close = () => {
    if (mutation.isPending) return;
    setPending(null);
    mutation.reset();
  };

  const submit = async () => {
    if (!pending) return;
    try {
      const result = await mutation.mutateAsync(pending.buildTransaction);
      onActionComplete(result, pending.summary);
      setPending(null);
      mutation.reset();
    } catch {
      // mutation.error surfaces below via errorMessage
    }
  };

  return {
    pending,
    queue: setPending,
    close,
    submit,
    isSubmitting: mutation.isPending,
    errorMessage:
      mutation.error instanceof Error ? mutation.error.message : null,
  };
}

function ActionConfirm({ action }: Readonly<{ action: UseConfirmAction }>) {
  return (
    <ConfirmActionDialog
      open={!!action.pending}
      title={action.pending?.title ?? ""}
      description={action.pending?.description ?? null}
      confirmLabel={action.pending?.confirmLabel ?? "Confirm"}
      destructive={action.pending?.destructive}
      pending={action.isSubmitting}
      errorMessage={action.errorMessage}
      onConfirm={action.submit}
      onCancel={action.close}
    />
  );
}

function AcceptAdminPanel({
  treasury,
  onActionComplete,
}: Readonly<SubPanelProps>) {
  const adapter = getStablecoinAdapter();
  const action = useConfirmAction(treasury.mint, onActionComplete);

  const queue = () => {
    action.queue({
      title: "Accept admin role?",
      description:
        "You become admin immediately after this transaction confirms.",
      summary: "Admin role accepted",
      confirmLabel: "Accept admin",
      buildTransaction: ({ payer }) =>
        adapter.buildAcceptAdmin({ payer }, treasury.mint),
    });
  };

  return (
    <PanelSection
      title="Incoming admin role"
      description="The current admin proposed you as the new admin. Accept to take over."
    >
      <Button onClick={queue}>Accept admin role</Button>
      <ActionConfirm action={action} />
    </PanelSection>
  );
}

function SetOperatorPanel({
  treasury,
  onActionComplete,
}: Readonly<SubPanelProps>) {
  const adapter = getStablecoinAdapter();
  const action = useConfirmAction(treasury.mint, onActionComplete);
  const [newOperator, setNewOperator] = useState("");
  const valid = isValidPubkey(newOperator);

  const queue = () => {
    const next = new PublicKey(newOperator.trim());
    action.queue({
      title: "Change operator?",
      description: (
        <>
          Change operator to <code>{formatPubkey(next, 6, 6)}</code>? The
          current operator will lose minting and redemption approval rights.
        </>
      ),
      summary: `Operator changed to ${formatPubkey(next)}`,
      confirmLabel: "Change operator",
      buildTransaction: ({ payer }) =>
        adapter.buildSetOperator({ payer }, treasury.mint, next),
    });
  };

  return (
    <PanelSection
      title="Operator"
      description={`Current: ${formatPubkey(treasury.operator, 6, 6)}`}
    >
      <Input
        value={newOperator}
        onChange={(e) => setNewOperator(e.target.value)}
        placeholder="New operator pubkey"
        className="font-mono text-xs"
      />
      <div>
        <Button size="sm" onClick={queue} disabled={!valid}>
          Change operator
        </Button>
      </div>
      <ActionConfirm action={action} />
    </PanelSection>
  );
}

function AdminTransferPanel({
  treasury,
  onActionComplete,
}: Readonly<SubPanelProps>) {
  const adapter = getStablecoinAdapter();
  const action = useConfirmAction(treasury.mint, onActionComplete);
  const [newAdmin, setNewAdmin] = useState("");
  const valid = isValidPubkey(newAdmin);

  const queueProposeAdmin = () => {
    const next = new PublicKey(newAdmin.trim());
    action.queue({
      title: "Propose new admin?",
      description: (
        <>
          Propose <code>{formatPubkey(next, 6, 6)}</code> as new admin. They
          must call accept_admin to complete the transfer.
        </>
      ),
      summary: `Proposed ${formatPubkey(next)} as new admin`,
      confirmLabel: "Propose admin",
      buildTransaction: ({ payer }) =>
        adapter.buildProposeAdmin({ payer }, treasury.mint, next),
    });
  };

  const queueCancelPendingAdmin = () => {
    action.queue({
      title: "Cancel admin transfer?",
      description: "The pending admin will no longer be able to accept the role.",
      summary: "Pending admin transfer cancelled",
      confirmLabel: "Cancel transfer",
      destructive: true,
      buildTransaction: ({ payer }) =>
        adapter.buildCancelPendingAdmin({ payer }, treasury.mint),
    });
  };

  const description = treasury.pendingAdmin
    ? `Pending admin: ${formatPubkey(treasury.pendingAdmin, 6, 6)}`
    : "Two-step transfer: propose, then the new admin accepts.";

  return (
    <PanelSection title="Admin transfer" description={description}>
      {treasury.pendingAdmin ? (
        <div>
          <Button size="sm" variant="ghost" onClick={queueCancelPendingAdmin}>
            Cancel pending transfer
          </Button>
        </div>
      ) : (
        <>
          <Input
            value={newAdmin}
            onChange={(e) => setNewAdmin(e.target.value)}
            placeholder="New admin pubkey"
            className="font-mono text-xs"
          />
          <div>
            <Button size="sm" onClick={queueProposeAdmin} disabled={!valid}>
              Propose admin
            </Button>
          </div>
        </>
      )}
      <ActionConfirm action={action} />
    </PanelSection>
  );
}

function MintCapPanel({
  treasury,
  onActionComplete,
}: Readonly<SubPanelProps>) {
  const adapter = getStablecoinAdapter();
  const action = useConfirmAction(treasury.mint, onActionComplete);
  const [newCap, setNewCap] = useState("");

  const decimals = treasury.decimals;
  const capRaw = newCap.trim();
  const capUnits = capRaw === "" ? null : parseAmountToUnits(capRaw, decimals);
  const valid = capUnits !== null;

  const queue = () => {
    if (!capUnits) return;
    const belowMinted = capUnits.lt(treasury.totalMinted);
    action.queue({
      title: "Update mint cap?",
      description: (
        <>
          Set mint cap to <code>{capRaw}</code>{" "}
          {belowMinted ? (
            <span className="block pt-1 text-rust">
              Warning: new cap is below current total minted (
              {formatAmount(treasury.totalMinted, decimals)}).
            </span>
          ) : null}
        </>
      ),
      summary: `Mint cap updated to ${capRaw}`,
      confirmLabel: "Update cap",
      buildTransaction: ({ payer }) =>
        adapter.buildUpdateMintCap({ payer }, treasury.mint, capUnits),
    });
  };

  const description = treasury.mintCap.isZero()
    ? "Currently uncapped."
    : `Current: ${formatAmount(treasury.mintCap, decimals)}`;

  return (
    <PanelSection title="Mint cap" description={description}>
      <Input
        value={newCap}
        onChange={(e) => setNewCap(e.target.value)}
        placeholder="New cap (token units, e.g. 1000000)"
        inputMode="decimal"
        className="font-mono text-xs"
      />
      <div>
        <Button size="sm" onClick={queue} disabled={!valid}>
          Update cap
        </Button>
      </div>
      <ActionConfirm action={action} />
    </PanelSection>
  );
}

function EmergencyPanel({
  treasury,
  onActionComplete,
}: Readonly<SubPanelProps>) {
  const adapter = getStablecoinAdapter();
  const action = useConfirmAction(treasury.mint, onActionComplete);

  const queue = () => {
    if (treasury.paused) {
      action.queue({
        title: "Unpause stablecoin?",
        description: "Minting, redemptions, and freezes will resume.",
        summary: "Stablecoin unpaused",
        confirmLabel: "Unpause",
        buildTransaction: ({ payer }) =>
          adapter.buildUnpause({ payer }, treasury.mint),
      });
      return;
    }
    action.queue({
      title: "Pause the stablecoin?",
      description:
        "This blocks ALL minting, redemptions, and freezing. Only thaw remains available.",
      summary: "Stablecoin paused",
      destructive: true,
      confirmLabel: "Pause",
      buildTransaction: ({ payer }) =>
        adapter.buildPause({ payer }, treasury.mint),
    });
  };

  return (
    <PanelSection
      title="Emergency"
      description="Pause halts every flow except thaw. Use for incident response."
    >
      <div>
        <Button
          size="sm"
          variant={treasury.paused ? "primary" : "ghost"}
          onClick={queue}
          className={
            treasury.paused
              ? undefined
              : "border-rust text-rust hover:bg-rust hover:text-canvas"
          }
        >
          {treasury.paused ? "Unpause" : "Pause"}
        </Button>
      </div>
      <ActionConfirm action={action} />
    </PanelSection>
  );
}

function FreezeThawPanel({
  treasury,
  onActionComplete,
}: Readonly<SubPanelProps>) {
  const adapter = getStablecoinAdapter();
  const action = useConfirmAction(treasury.mint, onActionComplete);
  const [target, setTarget] = useState("");
  const valid = isValidPubkey(target);

  const queue = (kind: "freeze" | "thaw") => {
    const tokenAccount = new PublicKey(target.trim());
    const isFreeze = kind === "freeze";
    action.queue({
      title: isFreeze ? "Freeze account?" : "Thaw account?",
      description: (
        <>
          {isFreeze ? "Freeze" : "Thaw"} token account{" "}
          <code>{formatPubkey(tokenAccount, 6, 6)}</code>?
          {isFreeze
            ? " The holder will not be able to transfer or request redemption."
            : " The holder regains transfer ability."}
        </>
      ),
      summary: isFreeze
        ? `Account ${formatPubkey(tokenAccount)} frozen`
        : `Account ${formatPubkey(tokenAccount)} thawed`,
      destructive: isFreeze,
      confirmLabel: isFreeze ? "Freeze" : "Thaw",
      buildTransaction: ({ payer }) =>
        isFreeze
          ? adapter.buildFreezeAccount({ payer }, treasury.mint, tokenAccount)
          : adapter.buildThawAccount({ payer }, treasury.mint, tokenAccount),
    });
  };

  const description = treasury.paused
    ? "While paused, only thaw is available."
    : "Block or restore transfers for a specific token account.";

  return (
    <PanelSection title="Freeze / thaw" description={description}>
      <Input
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        placeholder="Token account pubkey"
        className="font-mono text-xs"
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => queue("freeze")}
          disabled={!valid || treasury.paused}
        >
          Freeze
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => queue("thaw")}
          disabled={!valid}
        >
          Thaw
        </Button>
      </div>
      <ActionConfirm action={action} />
    </PanelSection>
  );
}

export function AdminControls({
  treasury,
  walletPublicKey,
  onActionComplete,
  isPendingAdmin,
}: Readonly<AdminControlsProps>) {
  const isAdmin = pubkeysEqual(walletPublicKey, treasury.admin);
  const showAcceptAdmin = isPendingAdmin && !isAdmin;

  return (
    <div className="flex flex-col gap-4">
      {showAcceptAdmin ? (
        <AcceptAdminPanel
          treasury={treasury}
          onActionComplete={onActionComplete}
        />
      ) : null}
      {isAdmin ? (
        <>
          <SetOperatorPanel
            treasury={treasury}
            onActionComplete={onActionComplete}
          />
          <AdminTransferPanel
            treasury={treasury}
            onActionComplete={onActionComplete}
          />
          <MintCapPanel
            treasury={treasury}
            onActionComplete={onActionComplete}
          />
          <EmergencyPanel
            treasury={treasury}
            onActionComplete={onActionComplete}
          />
          <FreezeThawPanel
            treasury={treasury}
            onActionComplete={onActionComplete}
          />
        </>
      ) : null}
    </div>
  );
}
