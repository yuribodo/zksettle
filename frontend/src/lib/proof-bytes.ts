/**
 * Pre-generated Groth16 (BN254) proof bytes for the landing-page demo.
 *
 * The real bytes are produced by the backend team in Week 2 (see PRD §12 and
 * design spec R5) via `barretenberg` from Noir. This module ships a static
 * placeholder so the demo flow renders deterministically before the real
 * bytes land. Replace `VALID_PROOF`, `NULLIFIER`, and `DEVNET_TX_HASH` with
 * the real values when available; the format and length must stay identical.
 *
 * `VALID_PROOF` is 256 bytes (= 512 hex characters) — the constant Groth16
 * proof size advertised in the Benchmarks section. `NULLIFIER` is 32 bytes.
 */

/** 256 bytes (= 512 hex chars), a valid-length Groth16 proof placeholder. */
export const VALID_PROOF =
  "0x" +
  "8a3f7e2c4b1d9f0a17d4e8b3c5a2f1e09d4c7b6a5f3e2d1c8b9a0f7e6d5c4b3a" +
  "21089f0e7d6c5b4a39281706f5e4d3c2b1a09f8e7d6c5b4a3928170f6e5d4c3b" +
  "7e2c4b1d9f0a17d4e8b3c5a2f1e09d4c7b6a5f3e2d1c8b9a0f7e6d5c4b3a8a3f" +
  "28170f6e5d4c3b21089f0e7d6c5b4a39281706f5e4d3c2b1a09f8e7d6c5b4a39" +
  "b3c5a2f1e09d4c7b6a5f3e2d1c8b9a0f7e6d5c4b3a8a3f7e2c4b1d9f0a17d4e8" +
  "9f8e7d6c5b4a3928170f6e5d4c3b21089f0e7d6c5b4a39281706f5e4d3c2b1a0" +
  "5f3e2d1c8b9a0f7e6d5c4b3a8a3f7e2c4b1d9f0a17d4e8b3c5a2f1e09d4c7b6a" +
  "6f5e4d3c2b1a09f8e7d6c5b4a3928170f6e5d4c3b21089f0e7d6c5b4a3928170";

/** 32 bytes of nullifier hex; globally unique per credential per nullifier seed. */
export const NULLIFIER =
  "0x4c917a2b3e8f5d6c0a1b2e3f4d5c6b7a8d9e0f1c2b3a4d5e6f7c8b9a0d1e8e2f";

/** Solana devnet block at which the expired credential's epoch closed. */
export const EXPIRED_BLOCK = 287_901_433;

/** Exact terminal error line rendered when the "Try with expired credential" toggle is on. */
export const EXPIRED_PROOF_ERROR = `proof rejected · credential expired (block ${EXPIRED_BLOCK.toLocaleString("en-US")})`;

/**
 * Placeholder Solana devnet transaction signature. Replace with a real
 * pre-existing devnet tx signature before the demo gate (PRD §12 / spec R4);
 * the landing's honesty footer tells users they can click Solscan to verify.
 */
export const DEVNET_TX_HASH =
  "5g8H4nP3eR2tQ7mK9vL8xY6cB1jH4dF2kM3nP9qR5sT7uV1wXzYa";

export const SOLSCAN_URL = `https://solscan.io/tx/${DEVNET_TX_HASH}?cluster=devnet`;
