export interface Roots {
  membership_root: string;
  sanctions_root: string;
  jurisdiction_root: string;
  last_publish_slot: number;
  wallet_count: number;
}

export interface MembershipProof {
  wallet: string;
  leaf_index: number;
  path: string[];
  path_indices: number[];
  root: string;
}

export interface SanctionsProof {
  wallet: string;
  path: string[];
  path_indices: number[];
  leaf_value: string;
  root: string;
}

export interface Credential {
  wallet: number[]; // 32-byte array
  leaf_index: number;
  jurisdiction: string;
  issued_at: number;
  revoked: boolean;
}
