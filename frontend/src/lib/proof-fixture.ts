import type { ProofInputs } from "@/types/proof";

/**
 * Synthetic proof inputs taken verbatim from `circuits/Prover.toml`.
 *
 * These satisfy every constraint in `circuits/src/main.nr` for the trivial
 * test setup (single-leaf Merkle tree, wallet=1, private_key=42). They are
 * intended for development and demos only — production proof generation must
 * source inputs from a real credential issuer.
 */
export const PROOF_FIXTURE: ProofInputs = {
  // Public inputs
  merkleRoot: "0x0408f1aa9155d9f7405d652b9c5dd4cd69602fff5fba80e1d6bd0a36c3add6d1",
  nullifier: "0x1d6ac8cee9f7b2d8f092a9169a9f49d81bb1ef665e21732414dcbe559ea0d560",
  mintLo: "1334440654591915542993625911497130241",
  mintHi: "1334440654591915542993625911497130241",
  epoch: "0",
  recipientLo: "2668881309183831085987251822994260482",
  recipientHi: "2668881309183831085987251822994260482",
  amount: "1000",
  sanctionsRoot: "0x03f5d399d3a5403fafb12fdab7483b3170812ee4e66e812bc8587e6921da2b4a",
  jurisdictionRoot: "0x0408f1aa9155d9f7405d652b9c5dd4cd69602fff5fba80e1d6bd0a36c3add6d1",
  timestamp: "1000",
  // Private inputs
  wallet: "1",
  path: Array.from({ length: 20 }, () => "0"),
  pathIndices: Array.from({ length: 20 }, () => 0),
  privateKey: "42",
  sanctionsPath: Array.from({ length: 20 }, () => "0"),
  sanctionsPathIndices: [1, 1, 0, 0, 1, 1, 1, 0, 1, 1, 0, 0, 0, 1, 0, 1, 1, 0, 1, 0],
  sanctionsLeafValue: "0",
  jurisdiction: "1",
  jurisdictionPath: Array.from({ length: 20 }, () => "0"),
  jurisdictionPathIndices: Array.from({ length: 20 }, () => 0),
  credentialExpiry: "2000",
};
