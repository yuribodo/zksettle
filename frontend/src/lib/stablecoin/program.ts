import { PublicKey } from "@solana/web3.js";

export const STABLECOIN_PROGRAM_ID = new PublicKey(
  "8UCELgX3D64aWPJcJre7AtuoSre5eWjHdAFsRUkeqCMe",
);

export const STABLECOIN_DECIMALS = 6;

export const REDEMPTION_EXPIRY_SECS = 604_800;

export const SEEDS = {
  treasury: "treasury",
  mintAuthority: "mint-authority",
  freezeAuthority: "freeze-authority",
  redemption: "redemption",
  escrowAuthority: "escrow-authority",
} as const;

const FALLBACK_MINT = "11111111111111111111111111111111";

interface ResolvedMint {
  mint: PublicKey;
  configured: boolean;
}

function resolveMint(value: string | undefined): ResolvedMint {
  if (!value) {
    return { mint: new PublicKey(FALLBACK_MINT), configured: false };
  }
  try {
    return { mint: new PublicKey(value), configured: true };
  } catch {
    return { mint: new PublicKey(FALLBACK_MINT), configured: false };
  }
}

const resolvedMint = resolveMint(process.env.NEXT_PUBLIC_STABLECOIN_MINT);

export const STABLECOIN_MINT = resolvedMint.mint;
export const STABLECOIN_MINT_CONFIGURED = resolvedMint.configured;
