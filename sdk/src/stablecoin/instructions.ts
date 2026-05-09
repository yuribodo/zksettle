import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { STABLECOIN_PROGRAM_ID } from "./constants.js";
import {
  findTreasuryPda,
  findMintAuthorityPda,
  findFreezeAuthorityPda,
  findEscrowAuthorityPda,
  findRedemptionPda,
} from "./pda.js";
import {
  DISC_INITIALIZE_MINT,
  DISC_MINT_TOKENS,
  DISC_REQUEST_REDEMPTION,
  DISC_APPROVE_REDEMPTION,
  DISC_CANCEL_REDEMPTION,
  DISC_FREEZE_ACCOUNT,
  DISC_THAW_ACCOUNT,
  DISC_PROPOSE_ADMIN,
  DISC_ACCEPT_ADMIN,
  DISC_CANCEL_PENDING_ADMIN,
  DISC_SET_OPERATOR,
  DISC_UPDATE_MINT_CAP,
  DISC_PAUSE,
  DISC_UNPAUSE,
} from "./discriminators.js";

function encodeU64(value: bigint | number): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(value));
  return buf;
}

function encodeDiscOnly(disc: Uint8Array): Buffer {
  return Buffer.from(disc);
}

function encodeDiscU8(disc: Uint8Array, value: number): Buffer {
  const buf = Buffer.alloc(9);
  buf.set(disc, 0);
  buf.writeUInt8(value, 8);
  return buf;
}

function encodeDiscU64(disc: Uint8Array, value: bigint | number): Buffer {
  const buf = Buffer.alloc(16);
  buf.set(disc, 0);
  buf.writeBigUInt64LE(BigInt(value), 8);
  return buf;
}

function encodeDiscPubkey(disc: Uint8Array, pubkey: PublicKey): Buffer {
  const buf = Buffer.alloc(40);
  buf.set(disc, 0);
  pubkey.toBuffer().copy(buf, 8);
  return buf;
}

export function buildInitializeMintIx(
  admin: PublicKey,
  mint: PublicKey,
  decimals: number,
  programId = STABLECOIN_PROGRAM_ID,
): TransactionInstruction {
  const [treasury] = findTreasuryPda(mint, programId);
  const [mintAuthority] = findMintAuthorityPda(treasury, programId);
  const [freezeAuthority] = findFreezeAuthorityPda(treasury, programId);
  const [escrowAuthority] = findEscrowAuthorityPda(treasury, programId);

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: admin, isSigner: true, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: true },
      { pubkey: treasury, isSigner: false, isWritable: true },
      { pubkey: mintAuthority, isSigner: false, isWritable: false },
      { pubkey: freezeAuthority, isSigner: false, isWritable: false },
      { pubkey: escrowAuthority, isSigner: false, isWritable: false },
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: encodeDiscU8(DISC_INITIALIZE_MINT, decimals),
  });
}

export function buildMintTokensIx(
  operator: PublicKey,
  mint: PublicKey,
  destination: PublicKey,
  amount: bigint | number,
  programId = STABLECOIN_PROGRAM_ID,
): TransactionInstruction {
  const [treasury] = findTreasuryPda(mint, programId);
  const [mintAuthority] = findMintAuthorityPda(treasury, programId);

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: operator, isSigner: true, isWritable: false },
      { pubkey: treasury, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: true },
      { pubkey: mintAuthority, isSigner: false, isWritable: false },
      { pubkey: destination, isSigner: false, isWritable: true },
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: encodeDiscU64(DISC_MINT_TOKENS, amount),
  });
}

export function buildRequestRedemptionIx(
  holder: PublicKey,
  mint: PublicKey,
  holderTokenAccount: PublicKey,
  amount: bigint | number,
  nonce: bigint | number,
  programId = STABLECOIN_PROGRAM_ID,
): TransactionInstruction {
  const [treasury] = findTreasuryPda(mint, programId);
  const [escrowAuthority] = findEscrowAuthorityPda(treasury, programId);
  const [freezeAuthority] = findFreezeAuthorityPda(treasury, programId);
  const [redemptionRequest] = findRedemptionPda(treasury, holder, nonce, programId);

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: holder, isSigner: true, isWritable: true },
      { pubkey: treasury, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: holderTokenAccount, isSigner: false, isWritable: true },
      { pubkey: redemptionRequest, isSigner: false, isWritable: true },
      { pubkey: escrowAuthority, isSigner: false, isWritable: false },
      { pubkey: freezeAuthority, isSigner: false, isWritable: false },
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: encodeDiscU64(DISC_REQUEST_REDEMPTION, amount),
  });
}

export function buildApproveRedemptionIx(
  operator: PublicKey,
  holder: PublicKey,
  mint: PublicKey,
  holderTokenAccount: PublicKey,
  nonce: bigint | number,
  programId = STABLECOIN_PROGRAM_ID,
): TransactionInstruction {
  const [treasury] = findTreasuryPda(mint, programId);
  const [escrowAuthority] = findEscrowAuthorityPda(treasury, programId);
  const [freezeAuthority] = findFreezeAuthorityPda(treasury, programId);
  const [redemptionRequest] = findRedemptionPda(treasury, holder, nonce, programId);

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: operator, isSigner: true, isWritable: false },
      { pubkey: holder, isSigner: false, isWritable: true },
      { pubkey: treasury, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: true },
      { pubkey: redemptionRequest, isSigner: false, isWritable: true },
      { pubkey: holderTokenAccount, isSigner: false, isWritable: true },
      { pubkey: escrowAuthority, isSigner: false, isWritable: false },
      { pubkey: freezeAuthority, isSigner: false, isWritable: false },
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: encodeDiscOnly(DISC_APPROVE_REDEMPTION),
  });
}

export function buildCancelRedemptionIx(
  canceller: PublicKey,
  holder: PublicKey,
  mint: PublicKey,
  holderTokenAccount: PublicKey,
  nonce: bigint | number,
  programId = STABLECOIN_PROGRAM_ID,
): TransactionInstruction {
  const [treasury] = findTreasuryPda(mint, programId);
  const [escrowAuthority] = findEscrowAuthorityPda(treasury, programId);
  const [freezeAuthority] = findFreezeAuthorityPda(treasury, programId);
  const [redemptionRequest] = findRedemptionPda(treasury, holder, nonce, programId);

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: canceller, isSigner: true, isWritable: false },
      { pubkey: holder, isSigner: false, isWritable: true },
      { pubkey: treasury, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: redemptionRequest, isSigner: false, isWritable: true },
      { pubkey: holderTokenAccount, isSigner: false, isWritable: true },
      { pubkey: escrowAuthority, isSigner: false, isWritable: false },
      { pubkey: freezeAuthority, isSigner: false, isWritable: false },
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: encodeDiscOnly(DISC_CANCEL_REDEMPTION),
  });
}

export function buildFreezeAccountIx(
  admin: PublicKey,
  mint: PublicKey,
  targetAccount: PublicKey,
  programId = STABLECOIN_PROGRAM_ID,
): TransactionInstruction {
  const [treasury] = findTreasuryPda(mint, programId);
  const [freezeAuthority] = findFreezeAuthorityPda(treasury, programId);

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: admin, isSigner: true, isWritable: false },
      { pubkey: treasury, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: freezeAuthority, isSigner: false, isWritable: false },
      { pubkey: targetAccount, isSigner: false, isWritable: true },
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: encodeDiscOnly(DISC_FREEZE_ACCOUNT),
  });
}

export function buildThawAccountIx(
  admin: PublicKey,
  mint: PublicKey,
  targetAccount: PublicKey,
  programId = STABLECOIN_PROGRAM_ID,
): TransactionInstruction {
  const [treasury] = findTreasuryPda(mint, programId);
  const [freezeAuthority] = findFreezeAuthorityPda(treasury, programId);

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: admin, isSigner: true, isWritable: false },
      { pubkey: treasury, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: freezeAuthority, isSigner: false, isWritable: false },
      { pubkey: targetAccount, isSigner: false, isWritable: true },
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: encodeDiscOnly(DISC_THAW_ACCOUNT),
  });
}

export function buildPauseIx(
  admin: PublicKey,
  mint: PublicKey,
  programId = STABLECOIN_PROGRAM_ID,
): TransactionInstruction {
  const [treasury] = findTreasuryPda(mint, programId);

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: admin, isSigner: true, isWritable: false },
      { pubkey: treasury, isSigner: false, isWritable: true },
    ],
    data: encodeDiscOnly(DISC_PAUSE),
  });
}

export function buildUnpauseIx(
  admin: PublicKey,
  mint: PublicKey,
  programId = STABLECOIN_PROGRAM_ID,
): TransactionInstruction {
  const [treasury] = findTreasuryPda(mint, programId);

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: admin, isSigner: true, isWritable: false },
      { pubkey: treasury, isSigner: false, isWritable: true },
    ],
    data: encodeDiscOnly(DISC_UNPAUSE),
  });
}

export function buildProposeAdminIx(
  admin: PublicKey,
  mint: PublicKey,
  newAdmin: PublicKey,
  programId = STABLECOIN_PROGRAM_ID,
): TransactionInstruction {
  const [treasury] = findTreasuryPda(mint, programId);

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: admin, isSigner: true, isWritable: true },
      { pubkey: treasury, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: encodeDiscPubkey(DISC_PROPOSE_ADMIN, newAdmin),
  });
}

export function buildAcceptAdminIx(
  newAdmin: PublicKey,
  mint: PublicKey,
  programId = STABLECOIN_PROGRAM_ID,
): TransactionInstruction {
  const [treasury] = findTreasuryPda(mint, programId);

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: newAdmin, isSigner: true, isWritable: false },
      { pubkey: treasury, isSigner: false, isWritable: true },
    ],
    data: encodeDiscOnly(DISC_ACCEPT_ADMIN),
  });
}

export function buildCancelPendingAdminIx(
  admin: PublicKey,
  mint: PublicKey,
  programId = STABLECOIN_PROGRAM_ID,
): TransactionInstruction {
  const [treasury] = findTreasuryPda(mint, programId);

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: admin, isSigner: true, isWritable: false },
      { pubkey: treasury, isSigner: false, isWritable: true },
    ],
    data: encodeDiscOnly(DISC_CANCEL_PENDING_ADMIN),
  });
}

export function buildSetOperatorIx(
  admin: PublicKey,
  mint: PublicKey,
  newOperator: PublicKey,
  programId = STABLECOIN_PROGRAM_ID,
): TransactionInstruction {
  const [treasury] = findTreasuryPda(mint, programId);

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: admin, isSigner: true, isWritable: false },
      { pubkey: treasury, isSigner: false, isWritable: true },
    ],
    data: encodeDiscPubkey(DISC_SET_OPERATOR, newOperator),
  });
}

export function buildUpdateMintCapIx(
  admin: PublicKey,
  mint: PublicKey,
  newCap: bigint | number,
  programId = STABLECOIN_PROGRAM_ID,
): TransactionInstruction {
  const [treasury] = findTreasuryPda(mint, programId);

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: admin, isSigner: true, isWritable: false },
      { pubkey: treasury, isSigner: false, isWritable: true },
    ],
    data: encodeDiscU64(DISC_UPDATE_MINT_CAP, newCap),
  });
}
