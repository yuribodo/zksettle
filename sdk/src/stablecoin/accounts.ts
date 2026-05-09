import { PublicKey } from "@solana/web3.js";
import { DISC_TREASURY, DISC_REDEMPTION_REQUEST } from "./discriminators.js";

export interface Treasury {
  admin: PublicKey;
  operator: PublicKey;
  mint: PublicKey;
  mintAuthorityBump: number;
  freezeAuthorityBump: number;
  bump: number;
  totalMinted: bigint;
  totalBurned: bigint;
  decimals: number;
  paused: boolean;
  pendingAdmin: PublicKey | null;
  mintCap: bigint;
  redemptionNonce: bigint;
  escrowAuthorityBump: number;
}

export interface RedemptionRequest {
  holder: PublicKey;
  treasury: PublicKey;
  mint: PublicKey;
  tokenAccount: PublicKey;
  amount: bigint;
  nonce: bigint;
  requestedAt: bigint;
  bump: number;
}

// Borsh Option<Pubkey> is variable: None=1 byte, Some=33 bytes.
// Account is allocated at max size (8+167=175), but minimum valid payload is 8+135=143.
export const TREASURY_ACCOUNT_SIZE = 8 + 167;
export const TREASURY_MIN_DATA_LEN = 8 + 135;
export const REDEMPTION_REQUEST_DATA_LEN = 8 + 153;

export function decodeTreasury(data: Buffer): Treasury {
  if (data.length < TREASURY_MIN_DATA_LEN) {
    throw new Error(`Treasury data too short: ${data.length} < ${TREASURY_MIN_DATA_LEN}`);
  }

  const disc = data.subarray(0, 8);
  if (!disc.equals(Buffer.from(DISC_TREASURY))) {
    throw new Error("Invalid Treasury account discriminator");
  }

  let offset = 8;
  const admin = new PublicKey(data.subarray(offset, offset + 32)); offset += 32;
  const operator = new PublicKey(data.subarray(offset, offset + 32)); offset += 32;
  const mint = new PublicKey(data.subarray(offset, offset + 32)); offset += 32;
  const mintAuthorityBump = data.readUInt8(offset); offset += 1;
  const freezeAuthorityBump = data.readUInt8(offset); offset += 1;
  const bump = data.readUInt8(offset); offset += 1;
  const totalMinted = data.readBigUInt64LE(offset); offset += 8;
  const totalBurned = data.readBigUInt64LE(offset); offset += 8;
  const decimals = data.readUInt8(offset); offset += 1;
  const paused = data.readUInt8(offset) !== 0; offset += 1;

  const pendingAdminTag = data.readUInt8(offset); offset += 1;
  let pendingAdmin: PublicKey | null = null;
  if (pendingAdminTag === 1) {
    pendingAdmin = new PublicKey(data.subarray(offset, offset + 32));
    offset += 32;
  }

  const mintCap = data.readBigUInt64LE(offset); offset += 8;
  const redemptionNonce = data.readBigUInt64LE(offset); offset += 8;
  const escrowAuthorityBump = data.readUInt8(offset);

  return {
    admin, operator, mint,
    mintAuthorityBump, freezeAuthorityBump, bump,
    totalMinted, totalBurned,
    decimals, paused, pendingAdmin,
    mintCap, redemptionNonce, escrowAuthorityBump,
  };
}

export function decodeRedemptionRequest(data: Buffer): RedemptionRequest {
  if (data.length < REDEMPTION_REQUEST_DATA_LEN) {
    throw new Error(`RedemptionRequest data too short: ${data.length} < ${REDEMPTION_REQUEST_DATA_LEN}`);
  }

  const disc = data.subarray(0, 8);
  if (!disc.equals(Buffer.from(DISC_REDEMPTION_REQUEST))) {
    throw new Error("Invalid RedemptionRequest account discriminator");
  }

  let offset = 8;
  const holder = new PublicKey(data.subarray(offset, offset + 32)); offset += 32;
  const treasury = new PublicKey(data.subarray(offset, offset + 32)); offset += 32;
  const mint = new PublicKey(data.subarray(offset, offset + 32)); offset += 32;
  const tokenAccount = new PublicKey(data.subarray(offset, offset + 32)); offset += 32;
  const amount = data.readBigUInt64LE(offset); offset += 8;
  const nonce = data.readBigUInt64LE(offset); offset += 8;
  const requestedAt = data.readBigInt64LE(offset); offset += 8;
  const bump = data.readUInt8(offset);

  return { holder, treasury, mint, tokenAccount, amount, nonce, requestedAt, bump };
}
