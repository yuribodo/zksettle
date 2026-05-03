import type { PublicKey } from "@solana/web3.js";

import { apiFetch } from "@/lib/api/client";
import { TenantSchema, type Tenant } from "@/lib/api/schemas";

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

async function getChallenge(): Promise<string> {
  const res = await apiFetch<{ nonce: string }>("/auth/challenge");
  return res.nonce;
}

export function generateSIWSMessage(wallet: PublicKey, nonce: string): string {
  const domain = window.location.host;
  const address = wallet.toBase58();
  const issuedAt = new Date().toISOString();

  return [
    `${domain} wants you to sign in with your Solana account:`,
    address,
    "",
    "Sign in to ZKSettle",
    "",
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
  ].join("\n");
}

export async function signIn(
  wallet: PublicKey,
  signMessage: (message: Uint8Array) => Promise<Uint8Array>,
): Promise<void> {
  const nonce = await getChallenge();
  const message = generateSIWSMessage(wallet, nonce);
  const encoded = new TextEncoder().encode(message);
  const signatureBytes = await signMessage(encoded);

  await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      account: wallet.toBase58(),
      signed_message: bytesToBase64(encoded),
      signature: bytesToBase64(signatureBytes),
    }),
  });
}

export async function signOut(): Promise<void> {
  await apiFetch("/auth/logout", { method: "POST" });
}

export async function getMe(): Promise<Tenant> {
  return TenantSchema.parse(await apiFetch("/auth/me"));
}
