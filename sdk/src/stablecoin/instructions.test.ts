import { describe, it, expect } from "vitest";
import { Keypair, PublicKey } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import {
  buildInitializeMintIx,
  buildMintTokensIx,
  buildRequestRedemptionIx,
  buildApproveRedemptionIx,
  buildCancelRedemptionIx,
  buildFreezeAccountIx,
  buildThawAccountIx,
  buildPauseIx,
  buildUnpauseIx,
  buildProposeAdminIx,
  buildAcceptAdminIx,
  buildCancelPendingAdminIx,
  buildSetOperatorIx,
  buildUpdateMintCapIx,
} from "./instructions.js";
import { STABLECOIN_PROGRAM_ID } from "./constants.js";
import {
  DISC_INITIALIZE_MINT,
  DISC_MINT_TOKENS,
  DISC_REQUEST_REDEMPTION,
  DISC_APPROVE_REDEMPTION,
  DISC_CANCEL_REDEMPTION,
  DISC_FREEZE_ACCOUNT,
  DISC_THAW_ACCOUNT,
  DISC_PAUSE,
  DISC_UNPAUSE,
  DISC_PROPOSE_ADMIN,
  DISC_ACCEPT_ADMIN,
  DISC_CANCEL_PENDING_ADMIN,
  DISC_SET_OPERATOR,
  DISC_UPDATE_MINT_CAP,
} from "./discriminators.js";

const admin = Keypair.generate().publicKey;
const operator = Keypair.generate().publicKey;
const holder = Keypair.generate().publicKey;
const mint = Keypair.generate().publicKey;
const destination = Keypair.generate().publicKey;
const tokenAccount = Keypair.generate().publicKey;
const newAdmin = Keypair.generate().publicKey;
const newOperator = Keypair.generate().publicKey;

function assertDiscriminator(data: Buffer, expected: Uint8Array) {
  expect(Buffer.from(data.subarray(0, 8))).toEqual(Buffer.from(expected));
}

function assertProgramId(ix: { programId: PublicKey }) {
  expect(ix.programId.equals(STABLECOIN_PROGRAM_ID)).toBe(true);
}

function hasAccount(keys: { pubkey: PublicKey }[], target: PublicKey): boolean {
  return keys.some((k) => k.pubkey.equals(target));
}

describe("instruction builders", () => {
  describe("buildInitializeMintIx", () => {
    const ix = buildInitializeMintIx(admin, mint, 6);

    it("uses correct program", () => assertProgramId(ix));
    it("has 8 accounts", () => expect(ix.keys).toHaveLength(8));
    it("data = disc(8) + u8(1) = 9 bytes", () => expect(ix.data.length).toBe(9));
    it("encodes discriminator", () => assertDiscriminator(ix.data, DISC_INITIALIZE_MINT));
    it("encodes decimals", () => expect(ix.data.readUInt8(8)).toBe(6));
    it("admin is signer + writable", () => {
      expect(ix.keys[0].isSigner).toBe(true);
      expect(ix.keys[0].isWritable).toBe(true);
    });
    it("includes token-2022 program", () => expect(hasAccount(ix.keys, TOKEN_2022_PROGRAM_ID)).toBe(true));
  });

  describe("buildMintTokensIx", () => {
    const ix = buildMintTokensIx(operator, mint, destination, 1_000_000n);

    it("uses correct program", () => assertProgramId(ix));
    it("has 6 accounts", () => expect(ix.keys).toHaveLength(6));
    it("data = disc(8) + u64(8) = 16 bytes", () => expect(ix.data.length).toBe(16));
    it("encodes discriminator", () => assertDiscriminator(ix.data, DISC_MINT_TOKENS));
    it("encodes amount as LE u64", () => {
      expect(ix.data.readBigUInt64LE(8)).toBe(1_000_000n);
    });
    it("operator is signer, not writable", () => {
      expect(ix.keys[0].isSigner).toBe(true);
      expect(ix.keys[0].isWritable).toBe(false);
    });
  });

  describe("buildRequestRedemptionIx", () => {
    const ix = buildRequestRedemptionIx(holder, mint, tokenAccount, 500n, 0);

    it("uses correct program", () => assertProgramId(ix));
    it("has 9 accounts", () => expect(ix.keys).toHaveLength(9));
    it("data = disc(8) + u64(8) = 16 bytes", () => expect(ix.data.length).toBe(16));
    it("encodes discriminator", () => assertDiscriminator(ix.data, DISC_REQUEST_REDEMPTION));
    it("encodes amount", () => expect(ix.data.readBigUInt64LE(8)).toBe(500n));
    it("holder is signer + writable", () => {
      expect(ix.keys[0].isSigner).toBe(true);
      expect(ix.keys[0].isWritable).toBe(true);
    });
  });

  describe("buildApproveRedemptionIx", () => {
    const ix = buildApproveRedemptionIx(operator, holder, mint, tokenAccount, 0);

    it("has 9 accounts", () => expect(ix.keys).toHaveLength(9));
    it("data = disc only = 8 bytes", () => expect(ix.data.length).toBe(8));
    it("encodes discriminator", () => assertDiscriminator(ix.data, DISC_APPROVE_REDEMPTION));
    it("operator is signer, not writable", () => {
      expect(ix.keys[0].isSigner).toBe(true);
      expect(ix.keys[0].isWritable).toBe(false);
    });
  });

  describe("buildCancelRedemptionIx", () => {
    const ix = buildCancelRedemptionIx(admin, holder, mint, tokenAccount, 0);

    it("has 9 accounts", () => expect(ix.keys).toHaveLength(9));
    it("data = disc only = 8 bytes", () => expect(ix.data.length).toBe(8));
    it("encodes discriminator", () => assertDiscriminator(ix.data, DISC_CANCEL_REDEMPTION));
  });

  describe("buildFreezeAccountIx", () => {
    const ix = buildFreezeAccountIx(admin, mint, tokenAccount);

    it("has 6 accounts", () => expect(ix.keys).toHaveLength(6));
    it("data = disc only = 8 bytes", () => expect(ix.data.length).toBe(8));
    it("encodes discriminator", () => assertDiscriminator(ix.data, DISC_FREEZE_ACCOUNT));
    it("admin is signer, not writable", () => {
      expect(ix.keys[0].isSigner).toBe(true);
      expect(ix.keys[0].isWritable).toBe(false);
    });
    it("target account is writable", () => {
      expect(ix.keys[4].isWritable).toBe(true);
    });
  });

  describe("buildThawAccountIx", () => {
    const ix = buildThawAccountIx(admin, mint, tokenAccount);

    it("has 6 accounts", () => expect(ix.keys).toHaveLength(6));
    it("data = disc only = 8 bytes", () => expect(ix.data.length).toBe(8));
    it("encodes discriminator", () => assertDiscriminator(ix.data, DISC_THAW_ACCOUNT));
  });

  describe("buildPauseIx", () => {
    const ix = buildPauseIx(admin, mint);

    it("has 2 accounts", () => expect(ix.keys).toHaveLength(2));
    it("data = disc only = 8 bytes", () => expect(ix.data.length).toBe(8));
    it("encodes discriminator", () => assertDiscriminator(ix.data, DISC_PAUSE));
    it("treasury is writable", () => expect(ix.keys[1].isWritable).toBe(true));
  });

  describe("buildUnpauseIx", () => {
    const ix = buildUnpauseIx(admin, mint);

    it("has 2 accounts", () => expect(ix.keys).toHaveLength(2));
    it("data = disc only = 8 bytes", () => expect(ix.data.length).toBe(8));
    it("encodes discriminator", () => assertDiscriminator(ix.data, DISC_UNPAUSE));
  });

  describe("buildProposeAdminIx", () => {
    const ix = buildProposeAdminIx(admin, mint, newAdmin);

    it("has 3 accounts", () => expect(ix.keys).toHaveLength(3));
    it("data = disc(8) + pubkey(32) = 40 bytes", () => expect(ix.data.length).toBe(40));
    it("encodes discriminator", () => assertDiscriminator(ix.data, DISC_PROPOSE_ADMIN));
    it("encodes new admin pubkey", () => {
      const encoded = new PublicKey(ix.data.subarray(8, 40));
      expect(encoded.equals(newAdmin)).toBe(true);
    });
    it("admin is signer + writable", () => {
      expect(ix.keys[0].isSigner).toBe(true);
      expect(ix.keys[0].isWritable).toBe(true);
    });
  });

  describe("buildAcceptAdminIx", () => {
    const ix = buildAcceptAdminIx(newAdmin, mint);

    it("has 2 accounts", () => expect(ix.keys).toHaveLength(2));
    it("data = disc only = 8 bytes", () => expect(ix.data.length).toBe(8));
    it("encodes discriminator", () => assertDiscriminator(ix.data, DISC_ACCEPT_ADMIN));
  });

  describe("buildCancelPendingAdminIx", () => {
    const ix = buildCancelPendingAdminIx(admin, mint);

    it("has 2 accounts", () => expect(ix.keys).toHaveLength(2));
    it("data = disc only = 8 bytes", () => expect(ix.data.length).toBe(8));
    it("encodes discriminator", () => assertDiscriminator(ix.data, DISC_CANCEL_PENDING_ADMIN));
  });

  describe("buildSetOperatorIx", () => {
    const ix = buildSetOperatorIx(admin, mint, newOperator);

    it("has 2 accounts", () => expect(ix.keys).toHaveLength(2));
    it("data = disc(8) + pubkey(32) = 40 bytes", () => expect(ix.data.length).toBe(40));
    it("encodes discriminator", () => assertDiscriminator(ix.data, DISC_SET_OPERATOR));
    it("encodes new operator pubkey", () => {
      const encoded = new PublicKey(ix.data.subarray(8, 40));
      expect(encoded.equals(newOperator)).toBe(true);
    });
  });

  describe("buildUpdateMintCapIx", () => {
    const ix = buildUpdateMintCapIx(admin, mint, 10_000_000n);

    it("has 2 accounts", () => expect(ix.keys).toHaveLength(2));
    it("data = disc(8) + u64(8) = 16 bytes", () => expect(ix.data.length).toBe(16));
    it("encodes discriminator", () => assertDiscriminator(ix.data, DISC_UPDATE_MINT_CAP));
    it("encodes new cap", () => {
      expect(ix.data.readBigUInt64LE(8)).toBe(10_000_000n);
    });
  });
});
