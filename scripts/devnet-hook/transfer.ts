/**
 * Devnet transfer script for zksettle Token-2022 transfer hook.
 *
 * Loads `devnet-state.json` (created by setup.ts), then:
 *  1. set_hook_payload — stages proof + settlement args into the payload PDA
 *  2. settle_hook      — direct-call settlement path (no Token-2022 Execute)
 *
 * With a dummy proof, settle_hook fails at the gnark boundary (MalformedProof)
 * which proves full wiring is correct. To run the real flow, pass a fixture:
 *
 *   PROOF_FIXTURE=path/to/proof_and_witness.bin npx ts-node transfer.ts
 *
 * Usage:
 *   npx ts-node transfer.ts [--amount N] [--close-only]
 */

import { AnchorProvider, Program, Wallet, BN } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import idlJson from "../../backend/target/idl/zksettle.json";

const ZKSETTLE_PROGRAM_ID = new PublicKey(
  "AyZk4CYFAFFJiFC2WqqXY2oq2pgN6vvrWwYbbWz7z7Jo"
);

const MPL_BUBBLEGUM_ID = new PublicKey(
  "BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY"
);
const SPL_ACCOUNT_COMPRESSION_ID = new PublicKey(
  "cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK"
);
const SPL_NOOP_ID = new PublicKey(
  "noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV"
);

const ISSUER_SEED = Buffer.from("issuer");
const HOOK_PAYLOAD_SEED = Buffer.from("hook-payload");
const BUBBLEGUM_REGISTRY_SEED = Buffer.from("bubblegum-registry");
const BUBBLEGUM_TREE_CREATOR_SEED = Buffer.from("bubblegum-tree-creator");

const STATE_FILE = path.join(__dirname, "devnet-state.json");

interface DevnetState {
  mint: string;
  mintSecret: number[];
  issuerPda: string;
  extraMetaPda: string;
  registryPda: string;
  hookPayloadPda: string;
  senderAta: string;
  recipientAta: string;
  recipient: string;
  recipientSecret: number[];
  merkleTree: string;
  merkleTreeSecret: number[];
}

function loadWallet(): Keypair {
  const walletPath =
    process.env.ANCHOR_WALLET ||
    path.join(os.homedir(), ".config/solana/id.json");
  const raw = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

function findPda(seeds: Buffer[], programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(seeds, programId);
}

function treeConfigPda(merkleTree: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [merkleTree.toBuffer()],
    MPL_BUBBLEGUM_ID
  );
}

function loadState(): DevnetState {
  if (!fs.existsSync(STATE_FILE)) {
    console.error("No devnet-state.json found. Run setup.ts first.");
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
}

function loadProofFixture(): Buffer {
  const fixturePath = process.env.PROOF_FIXTURE;
  if (fixturePath) {
    if (!fs.existsSync(fixturePath)) {
      throw new Error(`PROOF_FIXTURE not found: ${fixturePath}`);
    }
    console.log(`Loading proof fixture from ${fixturePath}`);
    return fs.readFileSync(fixturePath);
  }
  console.log("No PROOF_FIXTURE env — using dummy proof (will fail at gnark boundary)");
  return Buffer.alloc(256, 0xaa);
}

function parseArgs(): { amount: number; closeOnly: boolean } {
  const args = process.argv.slice(2);
  let amount = 500;
  let closeOnly = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--amount") {
      const raw = args[i + 1];
      if (!raw || raw.startsWith("--")) {
        throw new Error("--amount requires a positive integer value");
      }
      const parsed = parseInt(raw, 10);
      if (isNaN(parsed) || parsed <= 0) {
        throw new Error("--amount must be a positive integer");
      }
      amount = parsed;
      i++;
      continue;
    }
    if (args[i] === "--close-only") {
      closeOnly = true;
    }
  }
  return { amount, closeOnly };
}

function currentEpoch(): number {
  const override = process.env.PROOF_EPOCH;
  if (override) {
    const epoch = parseInt(override, 10);
    if (isNaN(epoch) || epoch < 0) {
      throw new Error("PROOF_EPOCH must be a non-negative integer");
    }
    return epoch;
  }
  return Math.floor(Date.now() / 1000 / 86400);
}

async function main() {
  const wallet = loadWallet();
  const state = loadState();
  const { amount, closeOnly } = parseArgs();
  const proofBytes = loadProofFixture();

  const connection = new Connection(
    process.env.RPC_URL || "https://api.devnet.solana.com",
    "confirmed"
  );

  console.log(`Wallet:    ${wallet.publicKey.toBase58()}`);
  console.log(`Mint:      ${state.mint}`);
  console.log(`Recipient: ${state.recipient}`);
  console.log(`Amount:    ${amount}`);

  const anchorWallet = new Wallet(wallet);
  const provider = new AnchorProvider(connection, anchorWallet, {
    commitment: "confirmed",
  });
  const program = new Program(idlJson as any, provider);

  const mintPk = new PublicKey(state.mint);
  const recipientPk = new PublicKey(state.recipient);
  const issuerPda = new PublicKey(state.issuerPda);
  const registryPda = new PublicKey(state.registryPda);
  const merkleTreePk = new PublicKey(state.merkleTree);
  const [treeConfigKey] = treeConfigPda(merkleTreePk);
  const [treeCreatorPda] = findPda([BUBBLEGUM_TREE_CREATOR_SEED], ZKSETTLE_PROGRAM_ID);
  const [hookPayloadPda] = findPda(
    [HOOK_PAYLOAD_SEED, wallet.publicKey.toBuffer()],
    ZKSETTLE_PROGRAM_ID
  );

  // --- Close-only mode: reclaim rent from an existing payload ---
  if (closeOnly) {
    console.log("\n--- Closing existing hook payload ---");
    try {
      const closeSig = await program.methods
        .closeHookPayload()
        .accounts({
          authority: wallet.publicKey,
          hookPayload: hookPayloadPda,
        })
        .rpc();
      console.log(`Payload closed: tx ${closeSig}`);
    } catch (err: any) {
      console.error(`Close failed: ${err.message}`);
    }
    return;
  }

  // --- Step 1: set_hook_payload ---
  console.log("\n--- Staging hook payload ---");

  const nullifierHash = crypto.randomBytes(32);
  nullifierHash[0] = nullifierHash[0] || 1;

  const epoch = currentEpoch();

  const lightArgs = {
    bubblegumTail: 0,
    proofPresent: false,
    proofBytes: Array.from(Buffer.alloc(128)),
    addressMtIndex: 0,
    addressQueueIndex: 0,
    addressRootIndex: 0,
    outputStateTreeIndex: 0,
  };

  try {
    const stageSig = await program.methods
      .setHookPayload(
        proofBytes,
        Array.from(nullifierHash),
        mintPk,
        new BN(epoch),
        recipientPk,
        new BN(amount),
        lightArgs
      )
      .accounts({
        authority: wallet.publicKey,
        issuer: issuerPda,
        hookPayload: hookPayloadPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log(`Payload staged: tx ${stageSig}`);
    console.log(`  nullifier: 0x${nullifierHash.toString("hex").slice(0, 16)}...`);
    console.log(`  epoch:     ${epoch}`);
  } catch (err: any) {
    if (err.message?.includes("already in use")) {
      console.log("Payload PDA already exists — close it first with --close-only");
      return;
    }
    throw err;
  }

  // --- Step 2: settle_hook ---
  console.log("\n--- Calling settle_hook ---");

  try {
    const settleSig = await program.methods
      .settleHook(new BN(amount))
      .accounts({
        authority: wallet.publicKey,
        mint: mintPk,
        destinationToken: recipientPk,
        hookPayload: hookPayloadPda,
        leafOwner: recipientPk,
        issuer: issuerPda,
        registry: registryPda,
        merkleTree: merkleTreePk,
        treeConfig: treeConfigKey,
        treeCreator: treeCreatorPda,
        bubblegumProgram: MPL_BUBBLEGUM_ID,
        compressionProgram: SPL_ACCOUNT_COMPRESSION_ID,
        logWrapper: SPL_NOOP_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log(`Settlement succeeded! tx ${settleSig}`);
  } catch (err: any) {
    const errMsg = err.message || String(err);
    if (errMsg.includes("MalformedProof")) {
      console.log("Got MalformedProof — expected with dummy proof.");
      console.log("Full wiring is correct up to the gnark verification boundary.");
      console.log("\nTo run with a real proof:");
      console.log("  PROOF_FIXTURE=path/to/proof_and_witness.bin npx ts-node transfer.ts");
    } else if (errMsg.includes("RootStale")) {
      console.log("Got RootStale — issuer merkle root needs refresh (update_issuer_root).");
    } else {
      console.error(`Settlement failed: ${errMsg}`);
    }
  }

  // --- Step 3: cleanup ---
  console.log("\n--- Closing hook payload (reclaim rent) ---");
  try {
    const closeSig = await program.methods
      .closeHookPayload()
      .accounts({
        authority: wallet.publicKey,
        hookPayload: hookPayloadPda,
      })
      .rpc();
    console.log(`Payload closed: tx ${closeSig}`);
  } catch (err: any) {
    // settle_hook already closes it on the direct-call path
    if (err.message?.includes("AccountNotInitialized")) {
      console.log("Payload already closed by settle_hook.");
    } else {
      console.log(`Close note: ${err.message}`);
    }
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
