import { PublicKey } from "@solana/web3.js";

export const STABLECOIN_PROGRAM_ID = new PublicKey(
  "2CdXRSPo6QLfLBJTikmrqmBiWwa1HpuuYJ2Qu6Yy3Liv"
);

export const TREASURY_SEED = Buffer.from("treasury");
export const MINT_AUTHORITY_SEED = Buffer.from("mint-authority");
export const FREEZE_AUTHORITY_SEED = Buffer.from("freeze-authority");
export const ESCROW_AUTHORITY_SEED = Buffer.from("escrow-authority");
export const REDEMPTION_SEED = Buffer.from("redemption");
