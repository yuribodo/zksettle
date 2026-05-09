import { PublicKey } from "@solana/web3.js";
import {
  STABLECOIN_PROGRAM_ID,
  TREASURY_SEED,
  MINT_AUTHORITY_SEED,
  FREEZE_AUTHORITY_SEED,
  ESCROW_AUTHORITY_SEED,
  REDEMPTION_SEED,
} from "./constants.js";

export function findTreasuryPda(
  mint: PublicKey,
  programId = STABLECOIN_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [TREASURY_SEED, mint.toBuffer()],
    programId,
  );
}

export function findMintAuthorityPda(
  treasury: PublicKey,
  programId = STABLECOIN_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [MINT_AUTHORITY_SEED, treasury.toBuffer()],
    programId,
  );
}

export function findFreezeAuthorityPda(
  treasury: PublicKey,
  programId = STABLECOIN_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [FREEZE_AUTHORITY_SEED, treasury.toBuffer()],
    programId,
  );
}

export function findEscrowAuthorityPda(
  treasury: PublicKey,
  programId = STABLECOIN_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [ESCROW_AUTHORITY_SEED, treasury.toBuffer()],
    programId,
  );
}

export function findRedemptionPda(
  treasury: PublicKey,
  holder: PublicKey,
  nonce: bigint | number,
  programId = STABLECOIN_PROGRAM_ID,
): [PublicKey, number] {
  const nonceBuf = Buffer.alloc(8);
  nonceBuf.writeBigUInt64LE(BigInt(nonce));
  return PublicKey.findProgramAddressSync(
    [REDEMPTION_SEED, treasury.toBuffer(), holder.toBuffer(), nonceBuf],
    programId,
  );
}
