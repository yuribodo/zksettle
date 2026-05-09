import {
  Keypair,
  SystemProgram,
  Transaction,
  type Connection,
  type PublicKey,
  type TransactionInstruction,
} from "@solana/web3.js";
import BN from "bn.js";
import type { BN as AnchorBN, Program } from "@coral-xyz/anchor";
import type {
  StagedLightArgs,
  ChunkedUploadOptions,
  ChunkedUploadResult,
} from "../types.js";
import { loadAnchorBrowser } from "../anchor.js";
import { ZKSETTLE_PROGRAM_ID } from "../constants.js";
import { findIssuerPda, findHookPayloadPda } from "./pda.js";
import idl from "../idl/zksettle.json" with { type: "json" };

// Minimal wallet shim that satisfies AnchorProvider without importing
// the Node-only `nodewallet.js` from @coral-xyz/anchor.
class DummyWallet {
  readonly payer: Keypair;
  readonly publicKey: PublicKey;
  constructor() {
    this.payer = Keypair.generate();
    this.publicKey = this.payer.publicKey;
  }
  async signTransaction<T extends Transaction>(tx: T): Promise<T> { return tx; }
  async signAllTransactions<T extends Transaction>(txs: T[]): Promise<T[]> { return txs; }
}

const DEFAULT_LIGHT_ARGS: StagedLightArgs = {
  bubblegumTail: 0,
  proofPresent: false,
  proofBytes: Array.from(new Uint8Array(128)),
  addressMtIndex: 0,
  addressQueueIndex: 0,
  addressRootIndex: 0,
  outputStateTreeIndex: 0,
};

// Solana txn limit ~1232 bytes. Per writeHookProof IX: 8 (discriminator) +
// 4 (offset) + 4 (vec prefix) + CHUNK_SIZE + ~228 (accounts/header). Two
// batched IXs at 450 bytes ≈ 1172 bytes, fitting within the limit.
export const CHUNK_SIZE = 450;
export const WRITES_PER_TX = 2;

async function makeProgram(connection: Connection): Promise<Program> {
  const { AnchorProvider, Program } = await loadAnchorBrowser();
  const dummyWallet = new DummyWallet();
  const provider = new AnchorProvider(connection, dummyWallet as any, {});
  return new Program(idl as any, provider);
}

export async function buildInitHookPayloadIx(
  wallet: PublicKey,
  proofLen: number,
  connection: Connection,
  programId = ZKSETTLE_PROGRAM_ID,
  program?: Program,
): Promise<TransactionInstruction> {
  const [issuerPda] = findIssuerPda(wallet, programId);
  const [hookPayloadPda] = findHookPayloadPda(wallet, programId);
  const prog = program ?? await makeProgram(connection);

  return prog.methods
    .initHookPayload(proofLen)
    .accounts({
      authority: wallet,
      issuer: issuerPda,
      hookPayload: hookPayloadPda,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export async function buildWriteChunkIx(
  wallet: PublicKey,
  offset: number,
  chunk: Uint8Array,
  connection: Connection,
  programId = ZKSETTLE_PROGRAM_ID,
  program?: Program,
): Promise<TransactionInstruction> {
  const [issuerPda] = findIssuerPda(wallet, programId);
  const [hookPayloadPda] = findHookPayloadPda(wallet, programId);
  const prog = program ?? await makeProgram(connection);

  return prog.methods
    .writeHookProof(offset, Buffer.from(chunk))
    .accounts({
      authority: wallet,
      issuer: issuerPda,
      hookPayload: hookPayloadPda,
    })
    .instruction();
}

export async function buildFinalizeHookPayloadIx(
  wallet: PublicKey,
  metadata: {
    nullifierHash: Uint8Array;
    mint: PublicKey;
    epoch: number;
    recipient: PublicKey;
    amount: AnchorBN;
    lightArgs?: StagedLightArgs;
  },
  connection: Connection,
  programId = ZKSETTLE_PROGRAM_ID,
  program?: Program,
): Promise<TransactionInstruction> {
  const [issuerPda] = findIssuerPda(wallet, programId);
  const [hookPayloadPda] = findHookPayloadPda(wallet, programId);
  const prog = program ?? await makeProgram(connection);

  const lightArgs = metadata.lightArgs ?? DEFAULT_LIGHT_ARGS;

  return prog.methods
    .finalizeHookPayload(
      Array.from(metadata.nullifierHash),
      metadata.mint,
      new BN(metadata.epoch),
      metadata.recipient,
      metadata.amount,
      lightArgs,
    )
    .accounts({
      authority: wallet,
      issuer: issuerPda,
      hookPayload: hookPayloadPda,
    })
    .instruction();
}

export async function uploadProofChunked(
  opts: ChunkedUploadOptions,
  signAndSend: (tx: Transaction) => Promise<string>,
): Promise<ChunkedUploadResult> {
  const programId = ZKSETTLE_PROGRAM_ID;
  const raw = opts.chunkSize ?? CHUNK_SIZE;
  const chunkSize = Math.max(1, Math.floor(raw));
  const proofBytes = opts.proof;
  const program = await makeProgram(opts.connection);

  const initIx = await buildInitHookPayloadIx(
    opts.wallet,
    proofBytes.length,
    opts.connection,
    programId,
    program,
  );
  const initSignature = await signAndSend(new Transaction().add(initIx));

  const writeIxs: TransactionInstruction[] = [];
  for (let offset = 0; offset < proofBytes.length; offset += chunkSize) {
    const end = Math.min(offset + chunkSize, proofBytes.length);
    const chunk = proofBytes.slice(offset, end);
    writeIxs.push(
      await buildWriteChunkIx(
        opts.wallet,
        offset,
        chunk,
        opts.connection,
        programId,
        program,
      ),
    );
  }

  const chunkSignatures: string[] = [];
  for (let i = 0; i < writeIxs.length; i += WRITES_PER_TX) {
    const tx = new Transaction();
    for (const ix of writeIxs.slice(i, i + WRITES_PER_TX)) {
      tx.add(ix);
    }
    const sig = await signAndSend(tx);
    chunkSignatures.push(sig);
  }

  const epoch =
    opts.transferContext.epoch ?? Math.floor(Date.now() / 1000 / 86400);
  const finalizeIx = await buildFinalizeHookPayloadIx(
    opts.wallet,
    {
      nullifierHash: opts.nullifierHash,
      mint: opts.transferContext.mint,
      epoch,
      recipient: opts.transferContext.recipient,
      amount: opts.transferContext.amount,
      lightArgs: opts.lightArgs,
    },
    opts.connection,
    programId,
    program,
  );
  const finalizeSignature = await signAndSend(new Transaction().add(finalizeIx));

  return { initSignature, chunkSignatures, finalizeSignature };
}
