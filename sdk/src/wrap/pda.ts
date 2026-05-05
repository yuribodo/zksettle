import { PublicKey } from "@solana/web3.js";
import {
  ZKSETTLE_PROGRAM_ID,
  MPL_BUBBLEGUM_ID,
  ISSUER_SEED,
  HOOK_PAYLOAD_SEED,
  BUBBLEGUM_REGISTRY_SEED,
  BUBBLEGUM_TREE_CREATOR_SEED,
} from "../constants.js";

export function findIssuerPda(
  authority: PublicKey,
  programId = ZKSETTLE_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [ISSUER_SEED, authority.toBuffer()],
    programId,
  );
}

export function findHookPayloadPda(
  authority: PublicKey,
  programId = ZKSETTLE_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [HOOK_PAYLOAD_SEED, authority.toBuffer()],
    programId,
  );
}

export function findRegistryPda(
  programId = ZKSETTLE_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [BUBBLEGUM_REGISTRY_SEED],
    programId,
  );
}

export function findTreeCreatorPda(
  programId = ZKSETTLE_PROGRAM_ID,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [BUBBLEGUM_TREE_CREATOR_SEED],
    programId,
  );
}

export function findTreeConfigPda(
  merkleTree: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [merkleTree.toBuffer()],
    MPL_BUBBLEGUM_ID,
  );
}
