import { BN } from "@coral-xyz/anchor";
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

import { STABLECOIN_PROGRAM_ID } from "./program";
import type {
  AdapterContext,
  RedemptionRequest,
  StablecoinAdapter,
  Treasury,
} from "./types";

// Type-only imports never trigger module resolution at test-collection time,
// so this file loads cleanly even before `sdk/dist/` exists. Runtime values
// are loaded lazily via `loadSdk()` below.
type SdkModule = typeof import("@zksettle/sdk");
type SdkTreasury = import("@zksettle/sdk").Treasury;
type SdkRedemptionRequest = import("@zksettle/sdk").RedemptionRequest;

let sdkPromise: Promise<SdkModule> | null = null;

function loadSdk(): Promise<SdkModule> {
  sdkPromise ??= import("@zksettle/sdk") as Promise<SdkModule>;
  return sdkPromise;
}

// Byte offset of the `treasury` field inside an Anchor RedemptionRequest:
//   8  (Anchor account discriminator)
// + 32 (`holder` Pubkey)
// = 40
const REDEMPTION_TREASURY_OFFSET = 8 + 32;

function toLocalTreasury(sdk: SdkTreasury): Treasury {
  return {
    admin: sdk.admin,
    operator: sdk.operator,
    mint: sdk.mint,
    totalMinted: new BN(sdk.totalMinted.toString()),
    totalBurned: new BN(sdk.totalBurned.toString()),
    decimals: sdk.decimals,
    paused: sdk.paused,
    pendingAdmin: sdk.pendingAdmin,
    mintCap: new BN(sdk.mintCap.toString()),
    redemptionNonce: new BN(sdk.redemptionNonce.toString()),
  };
}

function toLocalRedemption(
  pda: PublicKey,
  sdk: SdkRedemptionRequest,
): RedemptionRequest {
  return {
    pda,
    holder: sdk.holder,
    treasury: sdk.treasury,
    mint: sdk.mint,
    tokenAccount: sdk.tokenAccount,
    amount: new BN(sdk.amount.toString()),
    nonce: new BN(sdk.nonce.toString()),
    requestedAt: Number(sdk.requestedAt),
  };
}

function toBigInt(value: BN): bigint {
  return BigInt(value.toString());
}

function wrap(payer: PublicKey, ix: TransactionInstruction): Transaction {
  const tx = new Transaction();
  tx.feePayer = payer;
  tx.add(ix);
  return tx;
}

async function getTreasury(
  connection: Connection,
  mint: PublicKey,
): Promise<Treasury | null> {
  const sdk = await loadSdk();
  const [treasuryPda] = sdk.findTreasuryPda(mint);
  const info = await connection.getAccountInfo(treasuryPda);
  if (!info) return null;
  return toLocalTreasury(sdk.decodeTreasury(info.data));
}

async function listRedemptions(
  connection: Connection,
  mint: PublicKey,
): Promise<RedemptionRequest[]> {
  const sdk = await loadSdk();
  const [treasuryPda] = sdk.findTreasuryPda(mint);
  const accounts = await connection.getProgramAccounts(
    STABLECOIN_PROGRAM_ID,
    {
      filters: [
        { dataSize: sdk.REDEMPTION_REQUEST_DATA_LEN },
        {
          memcmp: {
            offset: REDEMPTION_TREASURY_OFFSET,
            bytes: treasuryPda.toBase58(),
          },
        },
      ],
    },
  );

  const decoded: RedemptionRequest[] = [];
  for (const { pubkey, account } of accounts) {
    try {
      decoded.push(
        toLocalRedemption(pubkey, sdk.decodeRedemptionRequest(account.data)),
      );
    } catch {
      // skip accounts that don't match the redemption discriminator
    }
  }
  return decoded;
}

export const sdkAdapter: StablecoinAdapter = {
  getTreasury,
  listRedemptions,
  async buildSetOperator(ctx: AdapterContext, mint, newOperator) {
    const sdk = await loadSdk();
    return wrap(ctx.payer, sdk.buildSetOperatorIx(ctx.payer, mint, newOperator));
  },
  async buildProposeAdmin(ctx: AdapterContext, mint, newAdmin) {
    const sdk = await loadSdk();
    return wrap(ctx.payer, sdk.buildProposeAdminIx(ctx.payer, mint, newAdmin));
  },
  async buildAcceptAdmin(ctx: AdapterContext, mint) {
    const sdk = await loadSdk();
    return wrap(ctx.payer, sdk.buildAcceptAdminIx(ctx.payer, mint));
  },
  async buildCancelPendingAdmin(ctx: AdapterContext, mint) {
    const sdk = await loadSdk();
    return wrap(ctx.payer, sdk.buildCancelPendingAdminIx(ctx.payer, mint));
  },
  async buildUpdateMintCap(ctx: AdapterContext, mint, newCap) {
    const sdk = await loadSdk();
    return wrap(
      ctx.payer,
      sdk.buildUpdateMintCapIx(ctx.payer, mint, toBigInt(newCap)),
    );
  },
  async buildPause(ctx: AdapterContext, mint) {
    const sdk = await loadSdk();
    return wrap(ctx.payer, sdk.buildPauseIx(ctx.payer, mint));
  },
  async buildUnpause(ctx: AdapterContext, mint) {
    const sdk = await loadSdk();
    return wrap(ctx.payer, sdk.buildUnpauseIx(ctx.payer, mint));
  },
  async buildFreezeAccount(ctx: AdapterContext, mint, tokenAccount) {
    const sdk = await loadSdk();
    return wrap(
      ctx.payer,
      sdk.buildFreezeAccountIx(ctx.payer, mint, tokenAccount),
    );
  },
  async buildThawAccount(ctx: AdapterContext, mint, tokenAccount) {
    const sdk = await loadSdk();
    return wrap(
      ctx.payer,
      sdk.buildThawAccountIx(ctx.payer, mint, tokenAccount),
    );
  },
  async buildMintTokens(ctx: AdapterContext, mint, destination, amount) {
    const sdk = await loadSdk();
    return wrap(
      ctx.payer,
      sdk.buildMintTokensIx(ctx.payer, mint, destination, toBigInt(amount)),
    );
  },
  async buildApproveRedemption(ctx: AdapterContext, mint, redemption) {
    const sdk = await loadSdk();
    return wrap(
      ctx.payer,
      sdk.buildApproveRedemptionIx(
        ctx.payer,
        redemption.holder,
        mint,
        redemption.tokenAccount,
        toBigInt(redemption.nonce),
      ),
    );
  },
  async buildCancelRedemption(ctx: AdapterContext, mint, redemption) {
    const sdk = await loadSdk();
    return wrap(
      ctx.payer,
      sdk.buildCancelRedemptionIx(
        ctx.payer,
        redemption.holder,
        mint,
        redemption.tokenAccount,
        toBigInt(redemption.nonce),
      ),
    );
  },
};
