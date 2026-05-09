import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  ComputeBudgetProgram,
  Transaction,
  VersionedTransaction,
  TransactionMessage,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { Program, BN } from "@coral-xyz/anchor";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

// ---------------------------------------------------------------------------
// Program & external IDs
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// PDA seeds
// ---------------------------------------------------------------------------

export const ISSUER_SEED = Buffer.from("issuer");
export const HOOK_PAYLOAD_SEED = Buffer.from("hook-payload");
export const BUBBLEGUM_REGISTRY_SEED = Buffer.from("bubblegum-registry");
export const BUBBLEGUM_TREE_CREATOR_SEED = Buffer.from("bubblegum-tree-creator");

// ---------------------------------------------------------------------------
// Fixture values (from Prover.toml)
// ---------------------------------------------------------------------------

export const MERKLE_ROOT = Buffer.from(
  "0408f1aa9155d9f7405d652b9c5dd4cd69602fff5fba80e1d6bd0a36c3add6d1", "hex"
);
export const NULLIFIER = Buffer.from(
  "1d6ac8cee9f7b2d8f092a9169a9f49d81bb1ef665e21732414dcbe559ea0d560", "hex"
);
export const SANCTIONS_ROOT = Buffer.from(
  "03f5d399d3a5403fafb12fdab7483b3170812ee4e66e812bc8587e6921da2b4a", "hex"
);
export const JURISDICTION_ROOT = Buffer.from(
  "0408f1aa9155d9f7405d652b9c5dd4cd69602fff5fba80e1d6bd0a36c3add6d1", "hex"
);

const FIXTURE_MINT_BYTES = Buffer.alloc(32);
for (let i = 16; i < 32; i++) FIXTURE_MINT_BYTES[i] = 0x01;
export const FIXTURE_MINT = new PublicKey(FIXTURE_MINT_BYTES);

const FIXTURE_RECIPIENT_BYTES = Buffer.alloc(32);
for (let i = 16; i < 32; i++) FIXTURE_RECIPIENT_BYTES[i] = 0x02;
export const FIXTURE_RECIPIENT = new PublicKey(FIXTURE_RECIPIENT_BYTES);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// ~450 bytes keeps each writeHookProof ix under the 1232-byte tx limit with 2 writes batched
export const CHUNK_SIZE = 450;
export const WRITES_PER_TX = 2;
// micro-lamports per CU
export const PRIORITY_FEE_MICRO_LAMPORTS = 5000;
export const BASE_FEE_LAMPORTS = 5000;
export const LAMPORTS_PER_SOL = 1_000_000_000;

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

export function pda(seeds: Buffer[]): PublicKey {
  return PublicKey.findProgramAddressSync(seeds, ZKSETTLE_PROGRAM_ID)[0];
}

export function solCostFromCu(cu: number): number {
  const priorityFee = (cu * PRIORITY_FEE_MICRO_LAMPORTS) / 1_000_000;
  return (BASE_FEE_LAMPORTS + priorityFee) / LAMPORTS_PER_SOL;
}

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

export async function exists(c: Connection, pk: PublicKey): Promise<boolean> {
  return (await c.getAccountInfo(pk)) !== null;
}

export function loadWallet(): Keypair {
  const p = process.env.ANCHOR_WALLET || path.join(os.homedir(), ".config/solana/id.json");
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(p, "utf-8"))));
}

// Expects zksettle_slice.proof (raw proof) + zksettle_slice.pw (public witness), concatenated
export function loadProofAndWitness(circuitsBase: string): Buffer {
  const proofPath = path.join(circuitsBase, "zksettle_slice.proof");
  const witnessPath = path.join(circuitsBase, "zksettle_slice.pw");

  if (!fs.existsSync(proofPath) || !fs.existsSync(witnessPath)) {
    console.error(
      "Missing circuit artifacts. Run from circuits/:\n" +
      "  nargo compile && nargo execute && sunspot prove ..."
    );
    process.exit(1);
  }

  return Buffer.concat([fs.readFileSync(proofPath), fs.readFileSync(witnessPath)]);
}

// ---------------------------------------------------------------------------
// Light Protocol args stub
// ---------------------------------------------------------------------------

export function defaultLightArgs() {
  return {
    bubblegumTail: 0,
    proofPresent: false,
    proofBytes: Array.from(Buffer.alloc(128)),
    addressMtIndex: 0,
    addressQueueIndex: 0,
    addressRootIndex: 0,
    outputStateTreeIndex: 0,
  };
}

// ---------------------------------------------------------------------------
// Proof upload (chunked flow)
// ---------------------------------------------------------------------------

export async function uploadProof(
  program: Program,
  wallet: Keypair,
  connection: Connection,
  proofAndWitness: Buffer,
  issuerPda: PublicKey,
  hookPayloadPda: PublicKey,
  mint: PublicKey,
  recipient: PublicKey,
): Promise<void> {
  if (await exists(connection, hookPayloadPda)) {
    try {
      await program.methods.closeHookPayload()
        .accounts({ authority: wallet.publicKey, hookPayload: hookPayloadPda })
        .signers([wallet]).rpc({ commitment: "confirmed" });
    } catch (err: any) {
      console.warn(`closeHookPayload (pre-upload cleanup) failed: ${err.message?.slice(0, 120)}`);
    }
  }

  await program.methods
    .initHookPayload(proofAndWitness.length)
    .accounts({
      authority: wallet.publicKey, issuer: issuerPda,
      hookPayload: hookPayloadPda, systemProgram: SystemProgram.programId,
    })
    .signers([wallet]).rpc({ commitment: "confirmed" });

  const writeIxs: Array<{ offset: number; chunk: Buffer }> = [];
  for (let off = 0; off < proofAndWitness.length; off += CHUNK_SIZE) {
    writeIxs.push({
      offset: off,
      chunk: Buffer.from(proofAndWitness.subarray(off, off + CHUNK_SIZE)),
    });
  }

  for (let i = 0; i < writeIxs.length; i += WRITES_PER_TX) {
    const tx = new Transaction();
    for (const w of writeIxs.slice(i, i + WRITES_PER_TX)) {
      const ix = await program.methods
        .writeHookProof(w.offset, w.chunk)
        .accounts({
          authority: wallet.publicKey, issuer: issuerPda,
          hookPayload: hookPayloadPda,
        })
        .instruction();
      tx.add(ix);
    }
    await sendAndConfirmTransaction(connection, tx, [wallet], { commitment: "confirmed" });
  }

  await program.methods
    .finalizeHookPayload(
      Array.from(NULLIFIER), mint, new BN(0), recipient, new BN(1000), defaultLightArgs(),
    )
    .accounts({
      authority: wallet.publicKey, issuer: issuerPda,
      hookPayload: hookPayloadPda,
    })
    .signers([wallet]).rpc({ commitment: "confirmed" });
}

// ---------------------------------------------------------------------------
// settle_hook accounts builder
// ---------------------------------------------------------------------------

export function buildSettleAccounts(
  wallet: PublicKey,
  hookPayloadPda: PublicKey,
  issuerPda: PublicKey,
  mint: PublicKey,
  recipient: PublicKey,
  registryPda: PublicKey,
  merkleTree: PublicKey,
): Record<string, PublicKey> {
  const treeCreator = pda([BUBBLEGUM_TREE_CREATOR_SEED]);
  const [treeConfig] = PublicKey.findProgramAddressSync([merkleTree.toBuffer()], MPL_BUBBLEGUM_ID);

  return {
    authority: wallet,
    mint,
    destinationToken: recipient,
    hookPayload: hookPayloadPda,
    leafOwner: recipient,
    issuer: issuerPda,
    registry: registryPda,
    merkleTree,
    treeConfig,
    treeCreator,
    bubblegumProgram: MPL_BUBBLEGUM_ID,
    compressionProgram: SPL_ACCOUNT_COMPRESSION_ID,
    logWrapper: SPL_NOOP_ID,
    systemProgram: SystemProgram.programId,
  };
}

// ---------------------------------------------------------------------------
// Simulate settle_hook
// ---------------------------------------------------------------------------

export async function simulateSettle(
  program: Program,
  wallet: Keypair,
  connection: Connection,
  hookPayloadPda: PublicKey,
  issuerPda: PublicKey,
  mint: PublicKey,
  recipient: PublicKey,
  registryPda: PublicKey,
  merkleTree: PublicKey,
): Promise<{ cu: number; logs: string[] }> {
  const accounts = buildSettleAccounts(
    wallet.publicKey, hookPayloadPda, issuerPda, mint, recipient, registryPda, merkleTree,
  );

  const ix = await program.methods
    .settleHook(new BN(1000))
    .accounts(accounts)
    .instruction();

  const bh = (await connection.getLatestBlockhash()).blockhash;
  const msg = new TransactionMessage({
    payerKey: wallet.publicKey, recentBlockhash: bh,
    instructions: [ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }), ix],
  }).compileToV0Message();

  const vtx = new VersionedTransaction(msg);
  vtx.sign([wallet]);

  const sim = await connection.simulateTransaction(vtx, { sigVerify: false });

  if (sim.value.err) {
    const err = new Error(`settle_hook simulation failed: ${JSON.stringify(sim.value.err)}`);
    (err as any).logs = sim.value.logs ?? [];
    throw err;
  }

  return {
    cu: sim.value.unitsConsumed ?? 0,
    logs: sim.value.logs ?? [],
  };
}

// ---------------------------------------------------------------------------
// Live settle_hook
// ---------------------------------------------------------------------------

export async function liveSettle(
  program: Program,
  wallet: Keypair,
  connection: Connection,
  hookPayloadPda: PublicKey,
  issuerPda: PublicKey,
  mint: PublicKey,
  recipient: PublicKey,
  registryPda: PublicKey,
  merkleTree: PublicKey,
): Promise<{ cu: number; logs: string[] }> {
  const accounts = buildSettleAccounts(
    wallet.publicKey, hookPayloadPda, issuerPda, mint, recipient, registryPda, merkleTree,
  );

  const sig = await program.methods
    .settleHook(new BN(1000))
    .accounts(accounts)
    .signers([wallet])
    .rpc({ commitment: "confirmed" });

  const tx = await connection.getTransaction(sig, {
    commitment: "confirmed", maxSupportedTransactionVersion: 0,
  });

  return {
    cu: tx?.meta?.computeUnitsConsumed ?? 0,
    logs: tx?.meta?.logMessages ?? [],
  };
}
