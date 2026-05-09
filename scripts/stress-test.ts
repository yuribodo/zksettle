/**
 * Stress test: fire N concurrent wrap+transfer flows on devnet and collect
 * latency / CU / success-rate metrics for docs/benchmarks.md (PRD §12 Week 4).
 *
 * Prerequisites:
 *   - Deployed zksettle program on devnet
 *   - Funded wallet (≥ 2 SOL for rent + fees)
 *   - Working Token-2022 mint with TransferHook extension
 *
 * Usage:
 *   npx ts-node scripts/stress-test.ts [options]
 *
 * Options:
 *   --rpc <url>          RPC endpoint (default: devnet)
 *   --count <n>          Total transfers (default: 50)
 *   --concurrency <n>    Max parallel transfers (default: 10)
 *   --mint <pubkey>      Token-2022 mint address (required)
 *   --output <path>      Write JSON results (default: stdout)
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  SystemProgram,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
  getOrCreateAssociatedTokenAccount,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";
import { loadWallet } from "./lib/benchmark-utils";

interface TransferResult {
  index: number;
  success: boolean;
  latencyMs: number;
  signature?: string;
  computeUnits?: number;
  error?: string;
}

interface StressTestReport {
  timestamp: string;
  config: {
    rpc: string;
    count: number;
    concurrency: number;
    mint: string;
  };
  results: TransferResult[];
  summary: {
    total: number;
    succeeded: number;
    failed: number;
    successRate: string;
    latency: {
      min: number;
      max: number;
      median: number;
      p95: number;
      mean: number;
    };
    totalComputeUnits: number;
  };
}

function parseArgs(): {
  rpc: string;
  count: number;
  concurrency: number;
  mint: string;
  output: string | null;
} {
  const args = process.argv.slice(2);
  const opts: Record<string, string> = {};

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace(/^--/, "");
    const val = args[i + 1];
    if (key && val) opts[key] = val;
  }

  if (!opts.mint) {
    console.error("Error: --mint <pubkey> is required");
    console.error(
      "Usage: npx ts-node scripts/stress-test.ts --mint <pubkey> [--rpc <url>] [--count <n>] [--concurrency <n>]"
    );
    process.exit(1);
  }

  return {
    rpc: opts.rpc || "https://api.devnet.solana.com",
    count: parseInt(opts.count || "50", 10),
    concurrency: parseInt(opts.concurrency || "10", 10),
    mint: opts.mint,
    output: opts.output || null,
  };
}

// loadWallet imported from shared util — single source of truth.

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

async function getComputeUnits(
  connection: Connection,
  signature: string
): Promise<number | undefined> {
  const tx = await connection.getTransaction(signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });
  return tx?.meta?.computeUnitsConsumed ?? undefined;
}

async function executeTransfer(
  connection: Connection,
  wallet: Keypair,
  mint: PublicKey,
  recipient: Keypair,
  senderAta: PublicKey,
  recipientAta: PublicKey,
  index: number
): Promise<TransferResult> {
  const start = performance.now();

  try {
    const tx = new Transaction().add(
      createTransferCheckedInstruction(
        senderAta,
        mint,
        recipientAta,
        wallet.publicKey,
        1_000, // 0.001 tokens (6 decimals)
        6,
        [],
        TOKEN_2022_PROGRAM_ID
      )
    );

    const signature = await sendAndConfirmTransaction(
      connection,
      tx,
      [wallet],
      { commitment: "confirmed" }
    );

    const latencyMs = Math.round(performance.now() - start);
    const computeUnits = await getComputeUnits(connection, signature);

    return { index, success: true, latencyMs, signature, computeUnits };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start);
    return {
      index,
      success: false,
      latencyMs,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function runBatch(
  tasks: Array<() => Promise<TransferResult>>,
  concurrency: number
): Promise<TransferResult[]> {
  const results: TransferResult[] = [];
  let cursor = 0;

  async function worker() {
    while (cursor < tasks.length) {
      const idx = cursor++;
      results.push(await tasks[idx]());
      process.stderr.write(`\r  ${results.length}/${tasks.length} transfers`);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker())
  );

  process.stderr.write("\n");
  return results;
}

async function main() {
  const config = parseArgs();
  const wallet = loadWallet();
  const connection = new Connection(config.rpc, "confirmed");
  const mint = new PublicKey(config.mint);

  console.error(`Wallet:      ${wallet.publicKey.toBase58()}`);
  console.error(`Mint:        ${mint.toBase58()}`);
  console.error(`Transfers:   ${config.count}`);
  console.error(`Concurrency: ${config.concurrency}`);
  console.error(`RPC:         ${config.rpc}`);

  const balance = await connection.getBalance(wallet.publicKey);
  console.error(`Balance:     ${(balance / 1e9).toFixed(4)} SOL\n`);

  if (balance < 1e9) {
    console.error("Need at least 1 SOL. Run: solana airdrop 2 --url devnet");
    process.exit(1);
  }

  const senderAtaAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    wallet,
    mint,
    wallet.publicKey,
    false,
    "confirmed",
    undefined,
    TOKEN_2022_PROGRAM_ID
  );
  const senderAta = senderAtaAccount.address;

  // Derive-only + batch-create: avoids N serial RPC round-trips that getOrCreateAssociatedTokenAccount would need
  console.error("Setting up recipient accounts...");
  const recipients: Array<{ keypair: Keypair; ata: PublicKey }> = [];

  for (let i = 0; i < config.count; i++) {
    const kp = Keypair.generate();
    const ata = await getAssociatedTokenAddress(
      mint,
      kp.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID
    );
    recipients.push({ keypair: kp, ata });
  }

  // Batch-create ATAs (groups of 5 to avoid tx size limits)
  console.error("Creating recipient ATAs...");
  const ATA_BATCH = 5;
  for (let i = 0; i < recipients.length; i += ATA_BATCH) {
    const batch = recipients.slice(i, i + ATA_BATCH);
    const tx = new Transaction();
    for (const r of batch) {
      tx.add(
        createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          r.ata,
          r.keypair.publicKey,
          mint,
          TOKEN_2022_PROGRAM_ID
        )
      );
    }
    await sendAndConfirmTransaction(connection, tx, [wallet], {
      commitment: "confirmed",
    });
    process.stderr.write(
      `\r  ${Math.min(i + ATA_BATCH, recipients.length)}/${recipients.length} ATAs`
    );
  }
  process.stderr.write("\n");

  // Execute transfers
  console.error("\nRunning transfers...");
  const tasks = recipients.map((r, i) => () =>
    executeTransfer(connection, wallet, mint, r.keypair, senderAta, r.ata, i)
  );

  const results = await runBatch(tasks, config.concurrency);

  // Compute summary
  const succeeded = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);
  const latencies = succeeded.map((r) => r.latencyMs).sort((a, b) => a - b);
  const totalCU = succeeded.reduce(
    (sum, r) => sum + (r.computeUnits ?? 0),
    0
  );

  const report: StressTestReport = {
    timestamp: new Date().toISOString(),
    config: { rpc: config.rpc, count: config.count, concurrency: config.concurrency, mint: config.mint },
    results: results.sort((a, b) => a.index - b.index),
    summary: {
      total: config.count,
      succeeded: succeeded.length,
      failed: failed.length,
      successRate:
        ((succeeded.length / config.count) * 100).toFixed(1) + "%",
      latency: {
        min: latencies[0] ?? 0,
        max: latencies[latencies.length - 1] ?? 0,
        median: percentile(latencies, 50),
        p95: percentile(latencies, 95),
        mean: Math.round(
          latencies.reduce((s, l) => s + l, 0) / (latencies.length || 1)
        ),
      },
      totalComputeUnits: totalCU,
    },
  };

  const json = JSON.stringify(report, null, 2);

  if (config.output) {
    fs.writeFileSync(config.output, json);
    console.error(`\nResults written to ${config.output}`);
  } else {
    console.log(json);
  }

  // Print summary table to stderr
  console.error("\n=== Stress test summary ===");
  console.error(`Total:        ${report.summary.total}`);
  console.error(`Succeeded:    ${report.summary.succeeded}`);
  console.error(`Failed:       ${report.summary.failed}`);
  console.error(`Success rate: ${report.summary.successRate}`);
  console.error(`Latency min:  ${report.summary.latency.min} ms`);
  console.error(`Latency med:  ${report.summary.latency.median} ms`);
  console.error(`Latency p95:  ${report.summary.latency.p95} ms`);
  console.error(`Latency max:  ${report.summary.latency.max} ms`);
  console.error(`Total CU:     ${report.summary.totalComputeUnits}`);

  if (failed.length > 0) {
    console.error(`\nFailed transfers:`);
    for (const f of failed) {
      console.error(`  #${f.index}: ${f.error}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
