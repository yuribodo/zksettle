import { getWalletAuthHeaders, isWalletScopedPath } from "./wallet-auth";

const PROXY_BASE = "/api/proxy";

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  // Copy into a fresh ArrayBuffer to satisfy the Web Crypto signature without
  // pulling SharedArrayBuffer into the type. Body is already small.
  const buf = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buf).set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  const view = new Uint8Array(digest);
  let out = "";
  for (const b of view) out += b.toString(16).padStart(2, "0");
  return out;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };

  if (isWalletScopedPath(path)) {
    const walletHeaders = await getWalletAuthHeaders();
    Object.assign(headers, walletHeaders);
  }

  const res = await fetch(`${PROXY_BASE}${path}`, {
    ...init,
    headers,
    credentials: "same-origin",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body, `${res.status} ${res.statusText} on ${path}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

export interface BinaryResponse {
  body: Uint8Array;
  headers: Headers;
}

export interface BinaryRequestInit {
  method?: string;
  body?: Uint8Array | ArrayBuffer;
  headers?: Record<string, string>;
}

/**
 * Counterpart of `apiFetch` for endpoints that exchange `application/octet-stream`
 * payloads (e.g. server-side Groth16 prover). Wallet-auth headers are attached
 * for paths that match `isWalletScopedPath`, mirroring `apiFetch`'s behaviour;
 * the response Headers are surfaced so callers can read out-of-band metadata
 * like `X-Proof-Len` without re-parsing the body.
 */
export async function apiFetchBinary(
  path: string,
  init: BinaryRequestInit = {},
): Promise<BinaryResponse> {
  const headers: Record<string, string> = {
    "Content-Type": "application/octet-stream",
    Accept: "application/octet-stream",
    ...init.headers,
  };

  if (isWalletScopedPath(path)) {
    // Bind the signed wallet-auth message to sha256(body) so captured headers
    // cannot be replayed against a different payload within the 5-min replay
    // window. Mirrors `body_hash_hex` in the issuer service's
    // `prove_groth16::verify_wallet_headers`. GET-style wallet-scoped paths
    // arrive here with no body and fall through to the bodyless signature.
    const bodyBytes = init.body
      ? init.body instanceof Uint8Array
        ? init.body
        : new Uint8Array(init.body)
      : undefined;
    const bodyHashHex = bodyBytes
      ? await sha256Hex(bodyBytes)
      : undefined;
    const walletHeaders = await getWalletAuthHeaders({ bodyHashHex });
    Object.assign(headers, walletHeaders);
  }

  const res = await fetch(`${PROXY_BASE}${path}`, {
    method: init.method ?? "POST",
    body: init.body as BodyInit | undefined,
    headers,
    credentials: "same-origin",
  });

  if (!res.ok) {
    let parsed: unknown = {};
    try {
      parsed = await res.clone().json();
    } catch {
      try {
        parsed = await res.text();
      } catch {
        // give up — leave parsed as {}
      }
    }
    throw new ApiError(
      res.status,
      parsed,
      `${res.status} ${res.statusText} on ${path}`,
    );
  }

  const buf = new Uint8Array(await res.arrayBuffer());
  return { body: buf, headers: res.headers };
}
