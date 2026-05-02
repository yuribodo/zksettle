"use client";

import React from "react";
import {
  useWalletModal,
  WalletMultiButton,
} from "@solana/wallet-adapter-react-ui";
import { Wallet } from "iconoir-react";

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
}: Readonly<ConnectWalletButtonProps>) {
  const { connected, publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const truncatedAddress = publicKey ? truncateWallet(publicKey.toBase58()) : null;
  const buttonClassName = cn(
    buttonVariants({ variant, size }),
    "min-w-fit px-3",
    className,
  );

  if (!connected) {
    return (
      <button
        type="button"
        onClick={() => setVisible(true)}
        className={buttonClassName}
      >
        <Wallet className="size-4" strokeWidth={1.5} aria-hidden="true" />
        <span>Connect</span>
      </button>
    );
  }

  return (
    <WalletMultiButton className={buttonClassName}>
      <span className="relative">
        <Wallet className="size-4" strokeWidth={1.5} aria-hidden="true" />
        <span
          aria-label="Connected"
          className="absolute -right-0.5 -bottom-0.5 size-[7px] rounded-full border-[1.5px] border-current bg-emerald"
        />
      </span>
      <span className={cn("font-mono text-xs tracking-tight", addressClassName)}>
        {truncatedAddress ?? "Connected"}
      </span>
    </WalletMultiButton>
  );
}
