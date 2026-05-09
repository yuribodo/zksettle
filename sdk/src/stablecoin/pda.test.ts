import { describe, it, expect } from "vitest";
import { Keypair, PublicKey } from "@solana/web3.js";
import {
  findTreasuryPda,
  findMintAuthorityPda,
  findFreezeAuthorityPda,
  findEscrowAuthorityPda,
  findRedemptionPda,
} from "./pda.js";
import { STABLECOIN_PROGRAM_ID } from "./constants.js";

const mint = Keypair.generate().publicKey;
const holder = Keypair.generate().publicKey;

describe("stablecoin PDAs", () => {
  it("findTreasuryPda derives a valid address", () => {
    const [address, bump] = findTreasuryPda(mint);
    expect(PublicKey.isOnCurve(address)).toBe(false);
    expect(bump).toBeGreaterThanOrEqual(0);
    expect(bump).toBeLessThanOrEqual(255);

    const [expected] = PublicKey.findProgramAddressSync(
      [Buffer.from("treasury"), mint.toBuffer()],
      STABLECOIN_PROGRAM_ID,
    );
    expect(address.equals(expected)).toBe(true);
  });

  it("findMintAuthorityPda derives from treasury", () => {
    const [treasury] = findTreasuryPda(mint);
    const [address] = findMintAuthorityPda(treasury);

    const [expected] = PublicKey.findProgramAddressSync(
      [Buffer.from("mint-authority"), treasury.toBuffer()],
      STABLECOIN_PROGRAM_ID,
    );
    expect(address.equals(expected)).toBe(true);
  });

  it("findFreezeAuthorityPda derives from treasury", () => {
    const [treasury] = findTreasuryPda(mint);
    const [address] = findFreezeAuthorityPda(treasury);

    const [expected] = PublicKey.findProgramAddressSync(
      [Buffer.from("freeze-authority"), treasury.toBuffer()],
      STABLECOIN_PROGRAM_ID,
    );
    expect(address.equals(expected)).toBe(true);
  });

  it("findEscrowAuthorityPda derives from treasury", () => {
    const [treasury] = findTreasuryPda(mint);
    const [address] = findEscrowAuthorityPda(treasury);

    const [expected] = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow-authority"), treasury.toBuffer()],
      STABLECOIN_PROGRAM_ID,
    );
    expect(address.equals(expected)).toBe(true);
  });

  it("findRedemptionPda encodes nonce as LE u64", () => {
    const [treasury] = findTreasuryPda(mint);
    const nonce = 42;
    const [address] = findRedemptionPda(treasury, holder, nonce);

    const nonceBuf = Buffer.alloc(8);
    nonceBuf.writeBigUInt64LE(BigInt(nonce));
    const [expected] = PublicKey.findProgramAddressSync(
      [Buffer.from("redemption"), treasury.toBuffer(), holder.toBuffer(), nonceBuf],
      STABLECOIN_PROGRAM_ID,
    );
    expect(address.equals(expected)).toBe(true);
  });

  it("findRedemptionPda handles nonce 0", () => {
    const [treasury] = findTreasuryPda(mint);
    const [address] = findRedemptionPda(treasury, holder, 0);
    expect(PublicKey.isOnCurve(address)).toBe(false);
  });

  it("findRedemptionPda handles large nonce (bigint)", () => {
    const [treasury] = findTreasuryPda(mint);
    const largeNonce = BigInt("18446744073709551615"); // u64 max
    const [address] = findRedemptionPda(treasury, holder, largeNonce);
    expect(PublicKey.isOnCurve(address)).toBe(false);
  });

  it("different mints produce different treasury addresses", () => {
    const mint2 = Keypair.generate().publicKey;
    const [addr1] = findTreasuryPda(mint);
    const [addr2] = findTreasuryPda(mint2);
    expect(addr1.equals(addr2)).toBe(false);
  });

  it("accepts custom programId", () => {
    const customProgram = Keypair.generate().publicKey;
    const [addr1] = findTreasuryPda(mint);
    const [addr2] = findTreasuryPda(mint, customProgram);
    expect(addr1.equals(addr2)).toBe(false);
  });
});
