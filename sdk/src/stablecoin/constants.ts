import { PublicKey } from "@solana/web3.js";

export const STABLECOIN_PROGRAM_ID = new PublicKey(
  "8UCELgX3D64aWPJcJre7AtuoSre5eWjHdAFsRUkeqCMe"
);

export const TREASURY_SEED = Buffer.from("treasury");
export const MINT_AUTHORITY_SEED = Buffer.from("mint-authority");
export const FREEZE_AUTHORITY_SEED = Buffer.from("freeze-authority");
export const ESCROW_AUTHORITY_SEED = Buffer.from("escrow-authority");
export const REDEMPTION_SEED = Buffer.from("redemption");
