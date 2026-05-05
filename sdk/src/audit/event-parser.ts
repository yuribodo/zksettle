import { PublicKey } from "@solana/web3.js";
import type { AuditTrail } from "../types.js";
import { PROOF_SETTLED_DISCRIMINATOR } from "../constants.js";

export function parseProofSettled(logData: string): AuditTrail | null {
  const buffer = Buffer.from(logData, "base64");

  if (buffer.length < 8) return null;
  for (let i = 0; i < 8; i++) {
    if (buffer[i] !== PROOF_SETTLED_DISCRIMINATOR[i]) return null;
  }

  // Layout: 8 (disc) + 1 (version) + 5*32 (pubkeys) + 4*32 (byte arrays) + 4*8 (u64s) = 329
  if (buffer.length < 329) return null;

  let offset = 8;

  // version: u8 (skip — not exposed in AuditTrail)
  offset += 1;

  const issuer = new PublicKey(buffer.subarray(offset, offset + 32));
  offset += 32;

  const nullifierHash = new Uint8Array(buffer.subarray(offset, offset + 32));
  offset += 32;

  const merkleRoot = new Uint8Array(buffer.subarray(offset, offset + 32));
  offset += 32;

  const sanctionsRoot = new Uint8Array(buffer.subarray(offset, offset + 32));
  offset += 32;

  const jurisdictionRoot = new Uint8Array(buffer.subarray(offset, offset + 32));
  offset += 32;

  const mint = new PublicKey(buffer.subarray(offset, offset + 32));
  offset += 32;

  const recipient = new PublicKey(buffer.subarray(offset, offset + 32));
  offset += 32;

  const amount = buffer.readBigUInt64LE(offset);
  offset += 8;

  const epoch = buffer.readBigUInt64LE(offset);
  offset += 8;

  const timestamp = buffer.readBigUInt64LE(offset);
  offset += 8;

  const slot = buffer.readBigUInt64LE(offset);
  offset += 8;

  const payer = new PublicKey(buffer.subarray(offset, offset + 32));

  return {
    issuer,
    nullifierHash,
    merkleRoot,
    sanctionsRoot,
    jurisdictionRoot,
    mint,
    recipient,
    amount,
    epoch,
    timestamp,
    slot,
    payer,
  };
}
