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
import {
  ZKSETTLE_PROGRAM_ID,
  MPL_BUBBLEGUM_ID,
  SPL_ACCOUNT_COMPRESSION_ID,
  SPL_NOOP_ID,
} from "../constants.js";
import {
  findIssuerPda,
  findHookPayloadPda,
  findRegistryPda,
  findTreeCreatorPda,
  findTreeConfigPda,
} from "./pda.js";
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

export async function checkIssuerExists(
  wallet: PublicKey,
  connection: Connection,
  programId = ZKSETTLE_PROGRAM_ID,
): Promise<boolean> {
  const [issuerPda] = findIssuerPda(wallet, programId);
  const info = await connection.getAccountInfo(issuerPda);
  return info !== null;
}

export async function buildRegisterIssuerIx(
  wallet: PublicKey,
  roots: { merkleRoot: Uint8Array; sanctionsRoot: Uint8Array; jurisdictionRoot: Uint8Array },
  connection: Connection,
  programId = ZKSETTLE_PROGRAM_ID,
  program?: Program,
): Promise<TransactionInstruction> {
  const [issuerPda] = findIssuerPda(wallet, programId);
  const prog = program ?? await makeProgram(connection, programId);

  return prog.methods
    .registerIssuer(
      Array.from(roots.merkleRoot),
      Array.from(roots.sanctionsRoot),
      Array.from(roots.jurisdictionRoot),
    )
    .accounts({
      authority: wallet,
      issuer: issuerPda,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export async function checkHookPayloadExists(
  wallet: PublicKey,
  connection: Connection,
  programId = ZKSETTLE_PROGRAM_ID,
): Promise<boolean> {
  const [hookPayloadPda] = findHookPayloadPda(wallet, programId);
  const info = await connection.getAccountInfo(hookPayloadPda);
  return info !== null;
}

export async function buildCloseHookPayloadIx(
  wallet: PublicKey,
  connection: Connection,
  programId = ZKSETTLE_PROGRAM_ID,
  program?: Program,
): Promise<TransactionInstruction> {
  const [hookPayloadPda] = findHookPayloadPda(wallet, programId);
  const prog = program ?? await makeProgram(connection, programId);

  return prog.methods
    .closeHookPayload()
    .accounts({
      authority: wallet,
      hookPayload: hookPayloadPda,
    })
    .instruction();
}

async function makeProgram(
  connection: Connection,
  programId: PublicKey = ZKSETTLE_PROGRAM_ID,
): Promise<Program> {
  const { AnchorProvider, Program } = await loadAnchorBrowser();
  const dummyWallet = new DummyWallet();
  const provider = new AnchorProvider(connection, dummyWallet as any, {});
  // Anchor 0.31 reads the program address from `idl.address`; the old
  // `new Program(idl, programId, provider)` form was removed. Honor a
  // caller-supplied override by cloning the IDL with a new address — otherwise
  // PDAs derived from `programId` would mismatch the ix target address.
  const idlWithAddress = { ...(idl as any), address: programId.toBase58() };
  return new Program(idlWithAddress, provider);
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
  const prog = program ?? await makeProgram(connection, programId);

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

export async function buildResizeHookPayloadIx(
  wallet: PublicKey,
  connection: Connection,
  programId = ZKSETTLE_PROGRAM_ID,
  program?: Program,
): Promise<TransactionInstruction> {
  const [issuerPda] = findIssuerPda(wallet, programId);
  const [hookPayloadPda] = findHookPayloadPda(wallet, programId);
  const prog = program ?? await makeProgram(connection, programId);

  return prog.methods
    .resizeHookPayload()
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
  const prog = program ?? await makeProgram(connection, programId);

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
  const prog = program ?? await makeProgram(connection, programId);

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

export async function buildSettleHookIx(
  wallet: PublicKey,
  amount: AnchorBN,
  connection: Connection,
  programId = ZKSETTLE_PROGRAM_ID,
  program?: Program,
): Promise<TransactionInstruction> {
  const [issuerPda] = findIssuerPda(wallet, programId);
  const [hookPayloadPda] = findHookPayloadPda(wallet, programId);
  const [registryPda] = findRegistryPda(programId);
  const [treeCreatorPda] = findTreeCreatorPda(programId);
  const prog = program ?? await makeProgram(connection, programId);

  // Fetch registry (resolves merkle_tree; settle_hook enforces
  // `merkle_tree == registry.merkle_tree`) and hook_payload (recipient/mint
  // staged at finalize; both `destination_token` and `leaf_owner` must equal
  // recipient) in parallel — independent reads.
  const [registry, payload] = await Promise.all([
    (prog.account as any).bubblegumTreeRegistry.fetch(registryPda),
    (prog.account as any).hookPayload.fetch(hookPayloadPda),
  ]);
  const merkleTree: PublicKey = registry.merkleTree;
  const [treeConfigPda] = findTreeConfigPda(merkleTree);
  const recipient: PublicKey = payload.recipient;
  const mint: PublicKey = payload.mint;

  return prog.methods
    .settleHook(amount)
    .accounts({
      authority: wallet,
      mint,
      destinationToken: recipient,
      hookPayload: hookPayloadPda,
      leafOwner: recipient,
      issuer: issuerPda,
      registry: registryPda,
      merkleTree,
      treeConfig: treeConfigPda,
      treeCreator: treeCreatorPda,
      bubblegumProgram: MPL_BUBBLEGUM_ID,
      compressionProgram: SPL_ACCOUNT_COMPRESSION_ID,
      logWrapper: SPL_NOOP_ID,
      systemProgram: SystemProgram.programId,
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
  const program = await makeProgram(opts.connection, programId);

  console.log("[zksettle-sdk] uploadProofChunked: building initHookPayload ix", {
    wallet: opts.wallet.toBase58(),
    proofLen: proofBytes.length,
  });
  const initIx = await buildInitHookPayloadIx(
    opts.wallet,
    proofBytes.length,
    opts.connection,
    programId,
    program,
  );
  console.log("[zksettle-sdk] uploadProofChunked: sending initHookPayload tx...");
  // Pre-set blockhash + feePayer so we can use the non-deprecated
  // strategy-form confirmTransaction below. Wallet adapters preserve
  // these when already set.
  const initTx = new Transaction().add(initIx);
  initTx.feePayer = opts.wallet;
  const initBh = await opts.connection.getLatestBlockhash("confirmed");
  initTx.recentBlockhash = initBh.blockhash;
  const initSignature = await signAndSend(initTx);
  console.log("[zksettle-sdk] uploadProofChunked: initHookPayload sig:", initSignature);
  // `signAndSend` is caller-supplied — wallet adapters typically resolve after
  // broadcast, not after confirmation. Explicitly confirm before any
  // getAccountInfo read so the loop below doesn't race a null/stale account.
  await opts.connection.confirmTransaction(
    {
      signature: initSignature,
      blockhash: initBh.blockhash,
      lastValidBlockHeight: initBh.lastValidBlockHeight,
    },
    "confirmed",
  );

  // resize_hook_payload grows the PDA AND allocates `proof_and_witness`.
  // Without it write_hook_proof panics copying into a zero-length Vec.
  // Solana realloc cap = 10 KiB / ix, so large proofs need multiple calls.
  // Loop terminates on observed on-chain account size: capture the
  // header-only baseline right after init, then resize until the account
  // has grown by `proofBytes.length` bytes. This avoids hardcoding
  // HookPayload::BASE_SPACE (which can drift if StagedLightArgs changes).
  const [hookPayloadPda] = findHookPayloadPda(opts.wallet, programId);
  const baselineInfo = await opts.connection.getAccountInfo(hookPayloadPda);
  if (!baselineInfo) {
    throw new Error("hook_payload PDA missing after init");
  }
  const headerSize = baselineInfo.data.length;
  const targetSize = headerSize + proofBytes.length;
  let currentSize = headerSize;
  while (currentSize < targetSize) {
    const resizeIx = await buildResizeHookPayloadIx(
      opts.wallet,
      opts.connection,
      programId,
      program,
    );
    const resizeTx = new Transaction().add(resizeIx);
    resizeTx.feePayer = opts.wallet;
    const resizeBh = await opts.connection.getLatestBlockhash("confirmed");
    resizeTx.recentBlockhash = resizeBh.blockhash;
    const resizeSig = await signAndSend(resizeTx);
    // Same rationale as the post-init confirm: the loop terminates on
    // observed account size, so we must wait for the resize to land before
    // reading or the loop can hang reading the pre-resize size.
    await opts.connection.confirmTransaction(
      {
        signature: resizeSig,
        blockhash: resizeBh.blockhash,
        lastValidBlockHeight: resizeBh.lastValidBlockHeight,
      },
      "confirmed",
    );
    const after = await opts.connection.getAccountInfo(hookPayloadPda);
    if (!after) {
      throw new Error("hook_payload PDA missing after resize");
    }
    currentSize = after.data.length;
  }

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
    tx.feePayer = opts.wallet;
    const writeBh = await opts.connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = writeBh.blockhash;
    const sig = await signAndSend(tx);
    // `write_hook_proof` enforces `offset == high_water_mark` on-chain. If
    // `signAndSend` resolves on broadcast (typical wallet-adapter behavior),
    // the next chunk's submit can race ahead of the previous one and the
    // program rejects it. There is no SDK-side retry, so confirm before the
    // next write.
    await opts.connection.confirmTransaction(
      {
        signature: sig,
        blockhash: writeBh.blockhash,
        lastValidBlockHeight: writeBh.lastValidBlockHeight,
      },
      "confirmed",
    );
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
