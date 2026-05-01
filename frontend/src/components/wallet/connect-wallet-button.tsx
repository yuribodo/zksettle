"use client";

import {
  WalletModalButton,
  WalletMultiButton,
} from "@solana/wallet-adapter-react-ui";

import { buttonVariants, type ButtonProps } from "@/components/ui/button";
import { useWallet } from "@/hooks/use-wallet-connection";
import { cn } from "@/lib/cn";
import { truncateWallet } from "@/lib/format";

interface ConnectWalletButtonProps {
  addressClassName?: string;
  className?: string;
  showAddress?: boolean;
  size?: NonNullable<ButtonProps["size"]>;
  variant?: NonNullable<ButtonProps["variant"]>;
}

export function ConnectWalletButton({
  addressClassName,
  className,
  showAddress = false,
  size = "md",
  variant = "primary",
}: ConnectWalletButtonProps) {
  const { connected, publicKey } = useWallet();
  const truncatedAddress = publicKey ? truncateWallet(publicKey.toBase58()) : null;
  const buttonClassName = cn(
    buttonVariants({ variant, size }),
    "min-w-fit px-3",
    className,
  );

  return (
    <div className="flex items-center gap-2">
      {connected ? (
        <WalletMultiButton className={buttonClassName}>
          {showAddress ? "Wallet" : truncatedAddress}
        </WalletMultiButton>
      ) : (
        <WalletModalButton className={buttonClassName}>
          Connect Wallet
        </WalletModalButton>
      )}
      {showAddress && truncatedAddress ? (
        <span
          className={cn(
            "inline-flex items-center rounded-[var(--radius-3)] border border-border-subtle bg-surface px-2.5 py-1.5 font-mono text-xs text-quill",
            addressClassName,
          )}
        >
          {truncatedAddress}
        </span>
      ) : null}
    </div>
  );
}
