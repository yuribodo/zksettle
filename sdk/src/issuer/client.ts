import type { Roots, MembershipProof, SanctionsProof, Credential } from "./types.js";

export class IssuerClient {
  private readonly baseUrl: string;
  private readonly authToken?: string;

  constructor(baseUrl: string, authToken?: string) {
    let url = baseUrl;
    while (url.endsWith("/")) url = url.slice(0, -1);
    this.baseUrl = url;
    this.authToken = authToken;
  }

  private async get<T>(path: string): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.authToken) {
      headers["Authorization"] = `Bearer ${this.authToken}`;
    }

    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, { headers });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      const detail = body ? ` — ${body}` : "";
      throw new Error(
        `IssuerClient request failed: ${response.status} ${response.statusText} — GET ${path}${detail}`,
      );
    }

    return response.json() as Promise<T>;
  }

  async getRoots(): Promise<Roots> {
    return this.get<Roots>("/v1/roots");
  }

  async getMembershipProof(wallet: string): Promise<MembershipProof> {
    return this.get<MembershipProof>(`/v1/proofs/membership/${wallet}`);
  }

  async getSanctionsProof(wallet: string): Promise<SanctionsProof> {
    return this.get<SanctionsProof>(`/v1/proofs/sanctions/${wallet}`);
  }

  async getCredential(wallet: string): Promise<Credential> {
    return this.get<Credential>(`/v1/credentials/${wallet}`);
  }
}
