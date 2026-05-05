import { PublicKey } from "@solana/web3.js";

export const ZKSETTLE_PROGRAM_ID = new PublicKey(
  "AyZk4CYFAFFJiFC2WqqXY2oq2pgN6vvrWwYbbWz7z7Jo"
);

export const MPL_BUBBLEGUM_ID = new PublicKey(
  "BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY"
);

export const SPL_ACCOUNT_COMPRESSION_ID = new PublicKey(
  "cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK"
);

export const SPL_NOOP_ID = new PublicKey(
  "noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV"
);

export const ISSUER_SEED = Buffer.from("issuer");
export const HOOK_PAYLOAD_SEED = Buffer.from("hook-payload");
export const EXTRA_ACCOUNT_META_SEED = Buffer.from("extra-account-metas");
export const BUBBLEGUM_REGISTRY_SEED = Buffer.from("bubblegum-registry");
export const BUBBLEGUM_TREE_CREATOR_SEED = Buffer.from("bubblegum-tree-creator");

export const PROOF_SETTLED_DISCRIMINATOR = new Uint8Array([108, 6, 201, 20, 0, 169, 42, 135]);
