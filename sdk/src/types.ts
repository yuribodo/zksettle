import type { PublicKey, Connection } from "@solana/web3.js";
import type { BN } from "@coral-xyz/anchor";
import type { CompiledCircuit } from "@noir-lang/noir_js";

export interface ProofInputs {
  merkleRoot: string;
  nullifier: string;
  mintLo: string;
  mintHi: string;
  epoch: string;
  recipientLo: string;
  recipientHi: string;
  amount: string;
  sanctionsRoot: string;
  jurisdictionRoot: string;
  timestamp: string;
  wallet: string;
  path: string[];
  pathIndices: number[];
  privateKey: string;
  sanctionsPath: string[];
  sanctionsPathIndices: number[];
  sanctionsLeafValue: string;
  jurisdiction: string;
  jurisdictionPath: string[];
  jurisdictionPathIndices: number[];
  credentialExpiry: string;
}

export interface ProofResult {
  proof: Uint8Array;
  publicInputs: string[];
  durationMs: number;
}

export interface TransferContext {
  mint: PublicKey;
  recipient: PublicKey;
  amount: BN;
  epoch?: number;
}

export interface StagedLightArgs {
  bubblegumTail: number;
  proofPresent: boolean;
  proofBytes: number[];
  addressMtIndex: number;
  addressQueueIndex: number;
  addressRootIndex: number;
  outputStateTreeIndex: number;
}

export interface WrapOptions {
  connection: Connection;
  wallet: PublicKey;
  proof: Uint8Array;
  nullifierHash: Uint8Array;
  transferContext: TransferContext;
  lightArgs?: StagedLightArgs;
}

export interface AuditTrail {
  issuer: PublicKey;
  nullifierHash: Uint8Array;
  merkleRoot: Uint8Array;
  sanctionsRoot: Uint8Array;
  jurisdictionRoot: Uint8Array;
  mint: PublicKey;
  recipient: PublicKey;
  amount: bigint;
  epoch: bigint;
  timestamp: bigint;
  slot: bigint;
  payer: PublicKey;
}

export interface IssuerRoots {
  merkleRoot: Uint8Array;
  sanctionsRoot: Uint8Array;
  jurisdictionRoot: Uint8Array;
}

export interface ZkSettleConfig {
  programId?: PublicKey;
  issuerServiceUrl?: string;
  circuitSource?: string | Uint8Array | CompiledCircuit;
  threads?: number;
}
