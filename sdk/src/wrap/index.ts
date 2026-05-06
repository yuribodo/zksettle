import {
  Keypair,
  SystemProgram,
  Transaction,
  type Connection,
  type PublicKey,
  type TransactionInstruction,
} from "@solana/web3.js";
import { AnchorProvider, BN, Program, Wallet } from "@coral-xyz/anchor";
import type {
  WrapOptions,
  ZkSettleConfig,
  StagedLightArgs,
  ChunkedUploadOptions,
  ChunkedUploadResult,
} from "../types.js";
import { ZKSETTLE_PROGRAM_ID } from "../constants.js";
import { findIssuerPda, findHookPayloadPda } from "./pda.js";
import idl from "../idl/zksettle.json" with { type: "json" };

const DEFAULT_LIGHT_ARGS: StagedLightArgs = {
  bubblegumTail: 0,
  proofPresent: false,
  proofBytes: Array.from(new Uint8Array(128)),
  addressMtIndex: 0,
  addressQueueIndex: 0,
  addressRootIndex: 0,
  outputStateTreeIndex: 0,
};

export async function wrap(
  options: WrapOptions,
  config?: ZkSettleConfig,
): Promise<Transaction> {
  const programId = config?.programId ?? ZKSETTLE_PROGRAM_ID;

  const [issuerPda] = findIssuerPda(options.wallet, programId);
  const [hookPayloadPda] = findHookPayloadPda(options.wallet, programId);

  const dummyWallet = new Wallet(Keypair.generate());
  const provider = new AnchorProvider(options.connection, dummyWallet, {});
  const program = new Program(idl as any, provider);

  const lightArgs = options.lightArgs ?? DEFAULT_LIGHT_ARGS;
  const epoch = options.transferContext.epoch ?? Math.floor(Date.now() / 1000 / 86400);

  const instruction = await program.methods
    .setHookPayload(
      Buffer.from(options.proof),
      Array.from(options.nullifierHash),
      options.transferContext.mint,
      new BN(epoch),
      options.transferContext.recipient,
      options.transferContext.amount,
      lightArgs,
    )
    .accounts({
      authority: options.wallet,
      issuer: issuerPda,
      hookPayload: hookPayloadPda,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  return new Transaction().add(instruction);
}

// Solana txn limit ~1232 bytes. Per writeHookProof IX: 8 (discriminator) +
// 4 (offset) + 4 (vec prefix) + CHUNK_SIZE + ~228 (accounts/header). Two
// batched IXs at 450 bytes ≈ 1172 bytes, fitting within the limit.
export const CHUNK_SIZE = 450;
export const WRITES_PER_TX = 2;

function makeProgram(connection: Connection): Program {
  const dummyWallet = new Wallet(Keypair.generate());
  const provider = new AnchorProvider(connection, dummyWallet, {});
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
  const prog = program ?? makeProgram(connection);

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
  const prog = program ?? makeProgram(connection);

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
    amount: BN;
    lightArgs?: StagedLightArgs;
  },
  connection: Connection,
  programId = ZKSETTLE_PROGRAM_ID,
  program?: Program,
): Promise<TransactionInstruction> {
  const [issuerPda] = findIssuerPda(wallet, programId);
  const [hookPayloadPda] = findHookPayloadPda(wallet, programId);
  const prog = program ?? makeProgram(connection);

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
  const program = makeProgram(opts.connection);

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
