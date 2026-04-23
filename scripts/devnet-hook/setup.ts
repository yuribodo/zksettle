/**
 * Devnet wiring script for zksettle Token-2022 transfer hook.
 *
 * Steps:
 *  1. Load wallet from ANCHOR_WALLET or ~/.config/solana/id.json
 *  2. Create Token-2022 mint with TransferHook extension → zksettle program
 *  3. register_issuer with dummy roots
 *  4. init_extra_account_meta_list with TLV entries
 *  5. Create ATAs for sender/recipient
 *  6. Mint tokens to sender
 *  7. set_hook_payload (dummy proof for devnet)
 *  8. transferChecked via Token-2022 — runtime auto-invokes hook
 *  9. Log tx signature + result
 *
 * Usage:
 *   ANCHOR_WALLET=~/.config/solana/id.json npx ts-node setup.ts
 */

import * as anchor from "@coral-xyz/anchor";
import {
  createInitializeTransferHookInstruction,
  createInitializeMintInstruction,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  createTransferCheckedInstruction,
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

const ZKSETTLE_PROGRAM_ID = new PublicKey(
  "AyZk4CYFAFFJiFC2WqqXY2oq2pgN6vvrWwYbbWz7z7Jo"
);

const ISSUER_SEED = Buffer.from("issuer");
const HOOK_PAYLOAD_SEED = Buffer.from("hook-payload");
const EXTRA_ACCOUNT_META_LIST_SEED = Buffer.from("extra-account-metas");
const BUBBLEGUM_REGISTRY_SEED = Buffer.from("bubblegum-registry");

function loadWallet(): Keypair {
  const walletPath =
    process.env.ANCHOR_WALLET ||
    path.join(process.env.HOME || "~", ".config/solana/id.json");
  const raw = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

function findPda(seeds: Buffer[], programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(seeds, programId);
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

  // --- Steps 3-8: zksettle program instructions (NOT YET IMPLEMENTED) ---
  // TODO: register_issuer, init_extra_account_meta_list, set_hook_payload,
  //       and transferChecked require the deployed program IDL to build
  //       Anchor discriminators. Use `anchor-client` or generate from IDL.
  const [issuerPda] = findPda(
    [ISSUER_SEED, wallet.publicKey.toBuffer()],
    ZKSETTLE_PROGRAM_ID
  );

  console.log(`\nIssuer PDA: ${issuerPda.toBase58()}`);
  console.log(
    "\nNote: This script only creates the Token-2022 mint and ATAs."
  );
  console.log(
    "Steps 3-8 (register_issuer, init_extra_account_meta_list, set_hook_payload,"
  );
  console.log(
    "transferChecked) are NOT implemented yet — they need IDL-based instruction building."
  );
  console.log(
    "Deploy program first: anchor deploy --provider.cluster devnet --program-name zksettle"
  );

  // --- Step 4: init_extra_account_meta_list ---
  const [extraMetaPda] = findPda(
    [EXTRA_ACCOUNT_META_LIST_SEED, mintKeypair.publicKey.toBuffer()],
    ZKSETTLE_PROGRAM_ID
  );
  console.log(`Extra account meta list PDA: ${extraMetaPda.toBase58()}`);

  // --- Step 5: Create ATAs ---
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
  console.log(`  Recipient:     ${recipient.publicKey.toBase58()}`);

  // --- Step 6: Mint tokens to sender ---
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

  // --- Steps 7-8 require zksettle program on devnet ---
  const [hookPayloadPda] = findPda(
    [HOOK_PAYLOAD_SEED, wallet.publicKey.toBuffer()],
    ZKSETTLE_PROGRAM_ID
  );
  const [registryPda] = findPda(
    [BUBBLEGUM_REGISTRY_SEED],
    ZKSETTLE_PROGRAM_ID
  );

  console.log("\n--- Devnet wiring complete (Token-2022 infrastructure) ---");
  console.log("Addresses for manual hook testing:");
  console.log(`  Program:        ${ZKSETTLE_PROGRAM_ID.toBase58()}`);
  console.log(`  Mint:           ${mintKeypair.publicKey.toBase58()}`);
  console.log(`  Issuer PDA:     ${issuerPda.toBase58()}`);
  console.log(`  Hook Payload:   ${hookPayloadPda.toBase58()}`);
  console.log(`  Extra Meta:     ${extraMetaPda.toBase58()}`);
  console.log(`  Registry:       ${registryPda.toBase58()}`);
  console.log(`  Sender ATA:     ${senderAta.toBase58()}`);
  console.log(`  Recipient ATA:  ${recipientAta.toBase58()}`);

  console.log(
    "\nTo complete the test (once zksettle is deployed on devnet):"
  );
  console.log("  1. Call register_issuer");
  console.log("  2. Call init_extra_account_meta_list with TLV entries");
  console.log("  3. Call set_hook_payload with dummy proof");
  console.log("  4. Call transferChecked — hook executes automatically");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
