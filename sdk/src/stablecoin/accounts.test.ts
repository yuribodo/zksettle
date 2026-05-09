import { describe, it, expect } from "vitest";
import { Keypair, PublicKey } from "@solana/web3.js";
import {
  decodeTreasury,
  decodeRedemptionRequest,
  TREASURY_ACCOUNT_SIZE,
  TREASURY_MIN_DATA_LEN,
  REDEMPTION_REQUEST_DATA_LEN,
} from "./accounts.js";
import { DISC_TREASURY, DISC_REDEMPTION_REQUEST } from "./discriminators.js";

// Builds a borsh-encoded Treasury buffer matching on-chain layout.
// Option<Pubkey> is variable-length: None=1 byte, Some=33 bytes.
// Buffer is always TREASURY_ACCOUNT_SIZE (175) to match Solana allocation.
function buildTreasuryBuffer(overrides: {
  admin?: PublicKey;
  operator?: PublicKey;
  mint?: PublicKey;
  mintAuthorityBump?: number;
  freezeAuthorityBump?: number;
  bump?: number;
  totalMinted?: bigint;
  totalBurned?: bigint;
  decimals?: number;
  paused?: boolean;
  pendingAdmin?: PublicKey | null;
  mintCap?: bigint;
  redemptionNonce?: bigint;
  escrowAuthorityBump?: number;
} = {}): Buffer {
  const buf = Buffer.alloc(TREASURY_ACCOUNT_SIZE);
  let offset = 0;

  buf.set(DISC_TREASURY, offset); offset += 8;
  (overrides.admin ?? PublicKey.default).toBuffer().copy(buf, offset); offset += 32;
  (overrides.operator ?? PublicKey.default).toBuffer().copy(buf, offset); offset += 32;
  (overrides.mint ?? PublicKey.default).toBuffer().copy(buf, offset); offset += 32;
  buf.writeUInt8(overrides.mintAuthorityBump ?? 255, offset); offset += 1;
  buf.writeUInt8(overrides.freezeAuthorityBump ?? 254, offset); offset += 1;
  buf.writeUInt8(overrides.bump ?? 253, offset); offset += 1;
  buf.writeBigUInt64LE(overrides.totalMinted ?? 0n, offset); offset += 8;
  buf.writeBigUInt64LE(overrides.totalBurned ?? 0n, offset); offset += 8;
  buf.writeUInt8(overrides.decimals ?? 6, offset); offset += 1;
  buf.writeUInt8(overrides.paused ? 1 : 0, offset); offset += 1;

  const pending = overrides.pendingAdmin ?? null;
  if (pending) {
    buf.writeUInt8(1, offset); offset += 1;
    pending.toBuffer().copy(buf, offset); offset += 32;
  } else {
    buf.writeUInt8(0, offset); offset += 1;
  }

  buf.writeBigUInt64LE(overrides.mintCap ?? 0n, offset); offset += 8;
  buf.writeBigUInt64LE(overrides.redemptionNonce ?? 0n, offset); offset += 8;
  buf.writeUInt8(overrides.escrowAuthorityBump ?? 252, offset);

  return buf;
}

function buildRedemptionBuffer(overrides: {
  holder?: PublicKey;
  treasury?: PublicKey;
  mint?: PublicKey;
  tokenAccount?: PublicKey;
  amount?: bigint;
  nonce?: bigint;
  requestedAt?: bigint;
  bump?: number;
} = {}): Buffer {
  const buf = Buffer.alloc(REDEMPTION_REQUEST_DATA_LEN);
  let offset = 0;

  buf.set(DISC_REDEMPTION_REQUEST, offset); offset += 8;
  (overrides.holder ?? PublicKey.default).toBuffer().copy(buf, offset); offset += 32;
  (overrides.treasury ?? PublicKey.default).toBuffer().copy(buf, offset); offset += 32;
  (overrides.mint ?? PublicKey.default).toBuffer().copy(buf, offset); offset += 32;
  (overrides.tokenAccount ?? PublicKey.default).toBuffer().copy(buf, offset); offset += 32;
  buf.writeBigUInt64LE(overrides.amount ?? 1000n, offset); offset += 8;
  buf.writeBigUInt64LE(overrides.nonce ?? 0n, offset); offset += 8;
  buf.writeBigInt64LE(overrides.requestedAt ?? 1700000000n, offset); offset += 8;
  buf.writeUInt8(overrides.bump ?? 251, offset);

  return buf;
}

describe("decodeTreasury", () => {
  it("decodes None pending_admin correctly (freshly initialized treasury)", () => {
    const buf = buildTreasuryBuffer({
      mintCap: 100_000_000n,
      redemptionNonce: 42n,
      escrowAuthorityBump: 203,
    });

    // Buffer is 175 bytes but borsh content is only 143 (None variant)
    const t = decodeTreasury(buf);
    expect(t.pendingAdmin).toBeNull();
    expect(t.mintCap).toBe(100_000_000n);
    expect(t.redemptionNonce).toBe(42n);
    expect(t.escrowAuthorityBump).toBe(203);
  });

  it("decodes Some pending_admin correctly", () => {
    const pendingKey = Keypair.generate().publicKey;
    const buf = buildTreasuryBuffer({
      pendingAdmin: pendingKey,
      mintCap: 77n,
      redemptionNonce: 3n,
      escrowAuthorityBump: 210,
    });

    const t = decodeTreasury(buf);
    expect(t.pendingAdmin).not.toBeNull();
    expect(t.pendingAdmin!.equals(pendingKey)).toBe(true);
    expect(t.mintCap).toBe(77n);
    expect(t.redemptionNonce).toBe(3n);
    expect(t.escrowAuthorityBump).toBe(210);
  });

  it("decodes all fields correctly with None pending_admin", () => {
    const adminKey = Keypair.generate().publicKey;
    const operatorKey = Keypair.generate().publicKey;
    const mintKey = Keypair.generate().publicKey;

    const buf = buildTreasuryBuffer({
      admin: adminKey,
      operator: operatorKey,
      mint: mintKey,
      mintAuthorityBump: 200,
      freezeAuthorityBump: 201,
      bump: 202,
      totalMinted: 5_000_000n,
      totalBurned: 1_000_000n,
      decimals: 9,
      paused: false,
      pendingAdmin: null,
      mintCap: 100_000_000n,
      redemptionNonce: 42n,
      escrowAuthorityBump: 203,
    });

    const t = decodeTreasury(buf);
    expect(t.admin.equals(adminKey)).toBe(true);
    expect(t.operator.equals(operatorKey)).toBe(true);
    expect(t.mint.equals(mintKey)).toBe(true);
    expect(t.mintAuthorityBump).toBe(200);
    expect(t.freezeAuthorityBump).toBe(201);
    expect(t.bump).toBe(202);
    expect(t.totalMinted).toBe(5_000_000n);
    expect(t.totalBurned).toBe(1_000_000n);
    expect(t.decimals).toBe(9);
    expect(t.paused).toBe(false);
    expect(t.pendingAdmin).toBeNull();
    expect(t.mintCap).toBe(100_000_000n);
    expect(t.redemptionNonce).toBe(42n);
    expect(t.escrowAuthorityBump).toBe(203);
  });

  it("decodes paused = true", () => {
    const buf = buildTreasuryBuffer({ paused: true });
    const t = decodeTreasury(buf);
    expect(t.paused).toBe(true);
  });

  it("handles max u64 values", () => {
    const maxU64 = BigInt("18446744073709551615");
    const buf = buildTreasuryBuffer({
      totalMinted: maxU64,
      totalBurned: maxU64,
      mintCap: maxU64,
      redemptionNonce: maxU64,
    });
    const t = decodeTreasury(buf);
    expect(t.totalMinted).toBe(maxU64);
    expect(t.totalBurned).toBe(maxU64);
    expect(t.mintCap).toBe(maxU64);
    expect(t.redemptionNonce).toBe(maxU64);
  });

  it("None and Some buffers differ in borsh content size", () => {
    const noneBuf = buildTreasuryBuffer({ pendingAdmin: null, mintCap: 99n });
    const someBuf = buildTreasuryBuffer({
      pendingAdmin: Keypair.generate().publicKey,
      mintCap: 99n,
    });

    // Both buffers are 175 bytes (account allocation), but borsh content differs.
    // mintCap is at different offsets: 126 (None) vs 158 (Some).
    expect(noneBuf.length).toBe(TREASURY_ACCOUNT_SIZE);
    expect(someBuf.length).toBe(TREASURY_ACCOUNT_SIZE);

    const tNone = decodeTreasury(noneBuf);
    const tSome = decodeTreasury(someBuf);
    expect(tNone.mintCap).toBe(99n);
    expect(tSome.mintCap).toBe(99n);
  });

  it("throws on data too short", () => {
    expect(() => decodeTreasury(Buffer.alloc(10))).toThrow("too short");
  });

  it("throws on wrong discriminator", () => {
    const buf = buildTreasuryBuffer();
    buf[0] = 0xff;
    expect(() => decodeTreasury(buf)).toThrow("discriminator");
  });
});

describe("decodeRedemptionRequest", () => {
  it("decodes all fields correctly", () => {
    const holderKey = Keypair.generate().publicKey;
    const treasuryKey = Keypair.generate().publicKey;
    const mintKey = Keypair.generate().publicKey;
    const taKey = Keypair.generate().publicKey;

    const buf = buildRedemptionBuffer({
      holder: holderKey,
      treasury: treasuryKey,
      mint: mintKey,
      tokenAccount: taKey,
      amount: 2_500n,
      nonce: 7n,
      requestedAt: 1700000000n,
      bump: 240,
    });

    const r = decodeRedemptionRequest(buf);
    expect(r.holder.equals(holderKey)).toBe(true);
    expect(r.treasury.equals(treasuryKey)).toBe(true);
    expect(r.mint.equals(mintKey)).toBe(true);
    expect(r.tokenAccount.equals(taKey)).toBe(true);
    expect(r.amount).toBe(2_500n);
    expect(r.nonce).toBe(7n);
    expect(r.requestedAt).toBe(1700000000n);
    expect(r.bump).toBe(240);
  });

  it("throws on data too short", () => {
    expect(() => decodeRedemptionRequest(Buffer.alloc(10))).toThrow("too short");
  });

  it("throws on wrong discriminator", () => {
    const buf = buildRedemptionBuffer();
    buf[0] = 0xff;
    expect(() => decodeRedemptionRequest(buf)).toThrow("discriminator");
  });
});
