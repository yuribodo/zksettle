import { Connection, PublicKey } from "@solana/web3.js";
import type { AuditTrail } from "../types.js";
import { ZKSETTLE_PROGRAM_ID } from "../constants.js";
import { parseProofSettled } from "./event-parser.js";

export async function audit(
  connection: Connection,
  txSignature: string,
): Promise<AuditTrail> {
  const tx = await connection.getTransaction(txSignature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });

  if (!tx) {
    throw new Error(`Transaction not found: ${txSignature}`);
  }

  const logMessages = tx.meta?.logMessages ?? [];

  for (const log of logMessages) {
    if (!log.startsWith("Program data: ")) continue;

    const data = log.slice("Program data: ".length);
    const parsed = parseProofSettled(data);
    if (parsed) return parsed;
  }

  throw new Error(`No ProofSettled event found in transaction: ${txSignature}`);
}
