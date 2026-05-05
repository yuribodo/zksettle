import type { ProofInputs } from "@/types/proof";
import type {
  Credential,
  MembershipProof,
  Roots,
  SanctionsProof,
} from "@/lib/api/schemas";

export type StepId =
  | "connect"
  | "credential"
  | "merkle"
  | "proof"
  | "submit"
  | "result";

export type StepStatus = "idle" | "running" | "success" | "error";

export interface StepMeta {
  id: StepId;
  title: string;
  description: string;
}

export const STEPS: readonly StepMeta[] = [
  {
    id: "connect",
    title: "Connect wallet",
    description: "Link your Solana wallet to sign the settlement transaction.",
  },
  {
    id: "credential",
    title: "Load credential",
    description:
      "Fetch your issuer credential from the membership tree.",
  },
  {
    id: "merkle",
    title: "Fetch Merkle paths",
    description:
      "Retrieve membership and sanctions proofs for the circuit.",
  },
  {
    id: "proof",
    title: "Generate proof",
    description:
      "Compute the Noir compliance proof in-browser via Barretenberg WASM.",
  },
  {
    id: "submit",
    title: "Submit on-chain",
    description:
      "Send the proof transaction to Solana devnet for verification.",
  },
  {
    id: "result",
    title: "Settlement result",
    description: "Confirm the on-chain settlement and view the Solscan link.",
  },
];

export interface StepState {
  id: StepId;
  status: StepStatus;
  data?: unknown;
  error?: string;
  durationMs?: number;
}

export interface FlowState {
  steps: StepState[];
  currentStep: number;
  mode: "live" | "demo";
  txSignature?: string;
}

export type FlowAction =
  | { type: "START_FLOW"; mode: "live" | "demo" }
  | { type: "STEP_RUNNING"; step: number }
  | {
      type: "STEP_SUCCESS";
      step: number;
      data?: unknown;
      durationMs?: number;
    }
  | { type: "STEP_ERROR"; step: number; error: string }
  | { type: "SET_TX"; signature: string }
  | { type: "RESET" };

function makeInitialSteps(): StepState[] {
  return STEPS.map((s) => ({ id: s.id, status: "idle" as const }));
}

export const INITIAL_STATE: FlowState = {
  steps: makeInitialSteps(),
  currentStep: -1,
  mode: "live",
};

export function flowReducer(state: FlowState, action: FlowAction): FlowState {
  switch (action.type) {
    case "START_FLOW":
      return {
        ...INITIAL_STATE,
        steps: makeInitialSteps(),
        currentStep: 0,
        mode: action.mode,
      };

    case "STEP_RUNNING": {
      const steps = state.steps.map((s, i) =>
        i === action.step ? { ...s, status: "running" as const, error: undefined } : s,
      );
      return { ...state, steps, currentStep: action.step };
    }

    case "STEP_SUCCESS": {
      const steps = state.steps.map((s, i) =>
        i === action.step
          ? {
              ...s,
              status: "success" as const,
              data: action.data,
              durationMs: action.durationMs,
            }
          : s,
      );
      return { ...state, steps, currentStep: action.step + 1 };
    }

    case "STEP_ERROR": {
      const steps = state.steps.map((s, i) =>
        i === action.step
          ? { ...s, status: "error" as const, error: action.error }
          : s,
      );
      return { ...state, steps };
    }

    case "SET_TX":
      return { ...state, txSignature: action.signature };

    case "RESET":
      return { ...INITIAL_STATE, steps: makeInitialSteps() };

    default:
      return state;
  }
}

export function assembleProofInputs(
  credential: Credential,
  membership: MembershipProof,
  sanctions: SanctionsProof,
  roots: Roots,
  transferContext: {
    mintLo: string;
    mintHi: string;
    recipientLo: string;
    recipientHi: string;
    amount: string;
    epoch: string;
    privateKey: string;
    credentialExpiry: string;
    jurisdictionPath: string[];
    jurisdictionPathIndices: number[];
    timestamp: string;
  },
): ProofInputs {
  const walletHex = credential.wallet
    .map((b) => (b & 0xff).toString(16).padStart(2, "0"))
    .join("");

  return {
    merkleRoot: roots.membership_root,
    nullifier: `0x${walletHex}`,
    mintLo: transferContext.mintLo,
    mintHi: transferContext.mintHi,
    epoch: transferContext.epoch,
    recipientLo: transferContext.recipientLo,
    recipientHi: transferContext.recipientHi,
    amount: transferContext.amount,
    sanctionsRoot: roots.sanctions_root,
    jurisdictionRoot: roots.jurisdiction_root,
    timestamp: transferContext.timestamp,
    wallet: walletHex,
    path: membership.path,
    pathIndices: membership.path_indices,
    privateKey: transferContext.privateKey,
    sanctionsPath: sanctions.path,
    sanctionsPathIndices: sanctions.path_indices,
    sanctionsLeafValue: sanctions.leaf_value,
    jurisdiction: credential.jurisdiction,
    jurisdictionPath: transferContext.jurisdictionPath,
    jurisdictionPathIndices: transferContext.jurisdictionPathIndices,
    credentialExpiry: transferContext.credentialExpiry,
  };
}
