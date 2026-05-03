"use client";

import type { PublicKey } from "@solana/web3.js";
import bs58 from "bs58";

import { apiFetch } from "@/lib/api/client";
import { TenantSchema, type Tenant } from "@/lib/api/schemas";
import { API_BASE_URL } from "@/lib/config";

function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function generateSIWSMessage(wallet: PublicKey): string {
  const domain = new URL(API_BASE_URL).host;
  const address = wallet.toBase58();
  const nonce = generateNonce();
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
  const message = generateSIWSMessage(wallet);
  const encoded = new TextEncoder().encode(message);
  const signatureBytes = await signMessage(encoded);
  const signature = bs58.encode(signatureBytes);

  await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      wallet: wallet.toBase58(),
      message,
      signature,
    }),
  });
}

export async function signOut(): Promise<void> {
  await apiFetch("/auth/logout", { method: "POST" });
}

export async function getMe(): Promise<Tenant> {
  return TenantSchema.parse(await apiFetch("/auth/me"));
}
