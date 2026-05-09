/**
 * Devnet wiring script for zksettle Token-2022 transfer hook.
 *
 * Steps:
 *  1. Load wallet from ANCHOR_WALLET or ~/.config/solana/id.json
 *  2. Create Token-2022 mint with TransferHook extension -> zksettle program
 *  3. register_issuer with test roots
 *  4. init_extra_account_meta_list with TLV entries
 *  5. init_attestation_tree (Bubblegum)
 *  6. Create ATAs for sender/recipient
 *  7. Mint tokens to sender
 *  8. Persist devnet-state.json
 *
 * Idempotent: if devnet-state.json exists, loads addresses and skips creation.
 *
 * Usage:
 *   ANCHOR_WALLET=~/.config/solana/id.json npx ts-node setup.ts
 */

import { AnchorProvider, Program, Wallet, BN } from "@coral-xyz/anchor";
import {
  createInitializeTransferHookInstruction,
  createInitializeMintInstruction,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  getAssociatedTokenAddress,
  ExtensionType,
  getMintLen,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";

import idlJson from "../../sdk/src/idl/zksettle.json";
import { loadWallet } from "../lib/benchmark-utils";

const ZKSETTLE_PROGRAM_ID = new PublicKey(
  "2HexcvYg6zvQo6kf1ompmvG78GUKMTW292kp1wDdKzFk"
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
const EXTRA_ACCOUNT_META_LIST_SEED = Buffer.from("extra-account-metas");
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


function findPda(seeds: Buffer[], programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(seeds, programId);
}

function treeConfigPda(merkleTree: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [merkleTree.toBuffer()],
    MPL_BUBBLEGUM_ID
  );
}

function loadState(): DevnetState | null {
  if (fs.existsSync(STATE_FILE)) {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
  }
  return null;
}

function saveState(state: DevnetState): void {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function main() {
  const wallet = loadWallet();
  const connection = new Connection(
    process.env.RPC_URL || "https://api.devnet.solana.com",
    "confirmed"
  );

  console.log(`Wallet: ${wallet.publicKey.toBase58()}`);

  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`Balance: ${balance / 1e9} SOL`);

  if (balance < 0.5 * 1e9) {
    console.error("Insufficient balance. Need at least 0.5 SOL on devnet.");
    console.error("Run: solana airdrop 2 --url devnet");
    process.exit(1);
  }

  // Check for existing state
  const existing = loadState();
  if (existing) {
    console.log("\nLoaded existing devnet-state.json — skipping creation.");
    printSummary(existing);
    return;
  }

  // --- Anchor Program setup ---
  const anchorWallet = new Wallet(wallet);
  const provider = new AnchorProvider(connection, anchorWallet, {
    commitment: "confirmed",
  });
  const program = new Program(idlJson as any, provider);

  // --- Step 2: Create Token-2022 mint with TransferHook extension ---
  const mintKeypair = Keypair.generate();
  const mintLen = getMintLen([ExtensionType.TransferHook]);
  const mintRent = await connection.getMinimumBalanceForRentExemption(mintLen);

  const createMintTx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: wallet.publicKey,
      newAccountPubkey: mintKeypair.publicKey,
      space: mintLen,
      lamports: mintRent,
      programId: TOKEN_2022_PROGRAM_ID,
    }),
    createInitializeTransferHookInstruction(
      mintKeypair.publicKey,
      wallet.publicKey,
      ZKSETTLE_PROGRAM_ID,
      TOKEN_2022_PROGRAM_ID
    ),
    createInitializeMintInstruction(
      mintKeypair.publicKey,
      6,
      wallet.publicKey,
      null,
      TOKEN_2022_PROGRAM_ID
    )
  );

  const mintSig = await sendAndConfirmTransaction(
    connection,
    createMintTx,
    [wallet, mintKeypair],
    { commitment: "confirmed" }
  );
  console.log(`Mint created: ${mintKeypair.publicKey.toBase58()}`);
  console.log(`  tx: ${mintSig}`);

  // --- Step 3: register_issuer ---
  const [issuerPda] = findPda(
    [ISSUER_SEED, wallet.publicKey.toBuffer()],
    ZKSETTLE_PROGRAM_ID
  );

  const testMerkleRoot = Buffer.alloc(32, 1);
  const testSanctionsRoot = Buffer.alloc(32, 10);
  const testJurisdictionRoot = Buffer.alloc(32, 11);

  const issuerInfo = await connection.getAccountInfo(issuerPda);
  if (issuerInfo) {
    console.log(`Issuer PDA already exists: ${issuerPda.toBase58()} — skipping register`);
  } else {
    const registerSig = await program.methods
      .registerIssuer(
        Array.from(testMerkleRoot),
        Array.from(testSanctionsRoot),
        Array.from(testJurisdictionRoot)
      )
      .accounts({
        authority: wallet.publicKey,
        issuer: issuerPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log(`Issuer registered: ${issuerPda.toBase58()}`);
    console.log(`  tx: ${registerSig}`);
  }

  // --- Step 4: init_extra_account_meta_list ---
  const [extraMetaPda] = findPda(
    [EXTRA_ACCOUNT_META_LIST_SEED, mintKeypair.publicKey.toBuffer()],
    ZKSETTLE_PROGRAM_ID
  );

  // TLV entries for accounts Token-2022 resolves during Execute:
  //   [5] hook_payload PDA: derived from owner (position 3 in Execute layout)
  //   [6] issuer PDA: derived from owner
  //   [7] registry PDA: literal [b"bubblegum-registry"]
  //   [8] bubblegum_program: literal BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY
  const extras = buildExtraAccountMetas(wallet.publicKey);

  const extraMetaInfo = await connection.getAccountInfo(extraMetaPda);
  if (extraMetaInfo) {
    console.log(`Extra account meta list already exists: ${extraMetaPda.toBase58()} — skipping init`);
  } else {
    const initMetaSig = await program.methods
      .initExtraAccountMetaList(extras)
      .accounts({
        authority: wallet.publicKey,
        issuer: issuerPda,
        mint: mintKeypair.publicKey,
        extraAccountMetaList: extraMetaPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log(`Extra account meta list initialized: ${extraMetaPda.toBase58()}`);
    console.log(`  tx: ${initMetaSig}`);
  }

  // --- Step 5: init_attestation_tree ---
  const [registryPda] = findPda([BUBBLEGUM_REGISTRY_SEED], ZKSETTLE_PROGRAM_ID);
  const registryInfo = await connection.getAccountInfo(registryPda);
  let merkleTreeKp: Keypair;
  if (registryInfo) {
    // Registry already on-chain — load keypair from previous state file.
    const prev = loadState();
    if (!prev) throw new Error("Registry PDA exists but no devnet-state.json found to recover merkle tree keypair");
    merkleTreeKp = Keypair.fromSecretKey(Uint8Array.from(prev.merkleTreeSecret));
    console.log(`Attestation tree registry already exists: ${registryPda.toBase58()} — skipping init`);
  } else {
    // Pre-allocate the merkle tree account client-side (>10KB exceeds the
    // inner-instruction realloc limit on mainnet/devnet).
    merkleTreeKp = Keypair.generate();
    const [treeCreatorPda] = findPda([BUBBLEGUM_TREE_CREATOR_SEED], ZKSETTLE_PROGRAM_ID);
    const [treeConfigKey] = treeConfigPda(merkleTreeKp.publicKey);

    // HEADER_SIZE_V1 (2 + 54) + size_of::<ConcurrentMerkleTree<14, 64>>()
    // = 56 + (8 + 8 + 4 + 32 + 32*14 + (32+32)*64*14 + 32*64)
    // = 31800 bytes. Must match bubblegum_merkle_tree_account_size() in Rust.
    // If BUBBLEGUM_MAX_DEPTH (14) or BUBBLEGUM_MAX_BUFFER_SIZE (64) change,
    // recompute this value.
    const MERKLE_TREE_ACCOUNT_SIZE = 31800;
    const treeRent = await connection.getMinimumBalanceForRentExemption(
      MERKLE_TREE_ACCOUNT_SIZE
    );
    const createTreeAccTx = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: merkleTreeKp.publicKey,
        space: MERKLE_TREE_ACCOUNT_SIZE,
        lamports: treeRent,
        programId: SPL_ACCOUNT_COMPRESSION_ID,
      })
    );
    const createTreeSig = await sendAndConfirmTransaction(
      connection,
      createTreeAccTx,
      [wallet, merkleTreeKp],
      { commitment: "confirmed" }
    );
    console.log(`Merkle tree account created: ${merkleTreeKp.publicKey.toBase58()}`);
    console.log(`  tx: ${createTreeSig}`);

    const initTreeSig = await program.methods
      .initAttestationTree()
      .accounts({
        authority: wallet.publicKey,
        issuer: issuerPda,
        registry: registryPda,
        merkleTree: merkleTreeKp.publicKey,
        treeConfig: treeConfigKey,
        treeCreator: treeCreatorPda,
        bubblegumProgram: MPL_BUBBLEGUM_ID,
        compressionProgram: SPL_ACCOUNT_COMPRESSION_ID,
        logWrapper: SPL_NOOP_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([merkleTreeKp])
      .rpc();
    console.log(`Attestation tree initialized: ${merkleTreeKp.publicKey.toBase58()}`);
    console.log(`  tx: ${initTreeSig}`);
  }

  // --- Step 6: Create ATAs ---
  const recipient = Keypair.generate();
  const senderAta = await getAssociatedTokenAddress(
    mintKeypair.publicKey,
    wallet.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID
  );
  const recipientAta = await getAssociatedTokenAddress(
    mintKeypair.publicKey,
    recipient.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID
  );

  const atasTx = new Transaction().add(
    createAssociatedTokenAccountInstruction(
      wallet.publicKey,
      senderAta,
      wallet.publicKey,
      mintKeypair.publicKey,
      TOKEN_2022_PROGRAM_ID
    ),
    createAssociatedTokenAccountInstruction(
      wallet.publicKey,
      recipientAta,
      recipient.publicKey,
      mintKeypair.publicKey,
      TOKEN_2022_PROGRAM_ID
    )
  );

  const ataSig = await sendAndConfirmTransaction(
    connection,
    atasTx,
    [wallet],
    { commitment: "confirmed" }
  );
  console.log(`ATAs created: tx ${ataSig}`);
  console.log(`  Sender ATA:    ${senderAta.toBase58()}`);
  console.log(`  Recipient ATA: ${recipientAta.toBase58()}`);

  // --- Step 7: Mint tokens to sender ---
  const mintToTx = new Transaction().add(
    createMintToInstruction(
      mintKeypair.publicKey,
      senderAta,
      wallet.publicKey,
      1_000_000,
      [],
      TOKEN_2022_PROGRAM_ID
    )
  );

  const mintToSig = await sendAndConfirmTransaction(
    connection,
    mintToTx,
    [wallet],
    { commitment: "confirmed" }
  );
  console.log(`Minted 1.0 tokens to sender: tx ${mintToSig}`);

  // --- Step 8: Persist state ---
  const [hookPayloadPda] = findPda(
    [HOOK_PAYLOAD_SEED, wallet.publicKey.toBuffer()],
    ZKSETTLE_PROGRAM_ID
  );

  const state: DevnetState = {
    mint: mintKeypair.publicKey.toBase58(),
    mintSecret: Array.from(mintKeypair.secretKey),
    issuerPda: issuerPda.toBase58(),
    extraMetaPda: extraMetaPda.toBase58(),
    registryPda: registryPda.toBase58(),
    hookPayloadPda: hookPayloadPda.toBase58(),
    senderAta: senderAta.toBase58(),
    recipientAta: recipientAta.toBase58(),
    recipient: recipient.publicKey.toBase58(),
    recipientSecret: Array.from(recipient.secretKey),
    merkleTree: merkleTreeKp.publicKey.toBase58(),
    merkleTreeSecret: Array.from(merkleTreeKp.secretKey),
  };
  saveState(state);
  console.log(`\nState saved to ${STATE_FILE}`);

  printSummary(state);
}

function buildExtraAccountMetas(
  _authority: PublicKey
): Array<{
  discriminator: number;
  addressConfig: number[];
  isSigner: boolean;
  isWritable: boolean;
}> {
  // Entry for hook_payload PDA: seeded by owner (Execute account index 3)
  // discriminator=1 means "PDA derived from program_id + seeds"
  // addressConfig encodes: [seed_count(1), seed_config(account_index=3)]
  const hookPayloadConfig = new Uint8Array(32);
  hookPayloadConfig[0] = 1; // one seed component
  hookPayloadConfig[1] = HOOK_PAYLOAD_SEED.length; // seed literal length
  HOOK_PAYLOAD_SEED.copy(Buffer.from(hookPayloadConfig.buffer), 2);
  // NOTE: the actual TLV encoding for PDA seeds from account indices is more
  // complex. For devnet testing with a single authority, a literal address
  // config pointing to the known PDA works. Production should use proper
  // spl-tlv-account-resolution seed encoding.

  // For devnet, use literal (discriminator=0) entries pointing to known addresses
  const [hookPayloadPda] = findPda(
    [HOOK_PAYLOAD_SEED, _authority.toBuffer()],
    ZKSETTLE_PROGRAM_ID
  );
  const [issuerPda] = findPda(
    [ISSUER_SEED, _authority.toBuffer()],
    ZKSETTLE_PROGRAM_ID
  );
  const [registryPda] = findPda([BUBBLEGUM_REGISTRY_SEED], ZKSETTLE_PROGRAM_ID);

  return [
    {
      discriminator: 0,
      addressConfig: Array.from(hookPayloadPda.toBytes()),
      isSigner: false,
      isWritable: true,
    },
    {
      discriminator: 0,
      addressConfig: Array.from(issuerPda.toBytes()),
      isSigner: false,
      isWritable: false,
    },
    {
      discriminator: 0,
      addressConfig: Array.from(registryPda.toBytes()),
      isSigner: false,
      isWritable: false,
    },
    {
      discriminator: 0,
      addressConfig: Array.from(MPL_BUBBLEGUM_ID.toBytes()),
      isSigner: false,
      isWritable: false,
    },
  ];
}

function printSummary(state: DevnetState): void {
  console.log("\n--- Devnet wiring summary ---");
  console.log(`  Program:        ${ZKSETTLE_PROGRAM_ID.toBase58()}`);
  console.log(`  Mint:           ${state.mint}`);
  console.log(`  Issuer PDA:     ${state.issuerPda}`);
  console.log(`  Extra Meta:     ${state.extraMetaPda}`);
  console.log(`  Registry:       ${state.registryPda}`);
  console.log(`  Merkle Tree:    ${state.merkleTree}`);
  console.log(`  Hook Payload:   ${state.hookPayloadPda}`);
  console.log(`  Sender ATA:     ${state.senderAta}`);
  console.log(`  Recipient ATA:  ${state.recipientAta}`);
  console.log(`  Recipient:      ${state.recipient}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
