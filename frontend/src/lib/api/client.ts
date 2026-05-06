import { API_BASE_URL } from "../config";
import { getActiveApiKey } from "./active-key";
import { getWalletAuthHeaders, isWalletScopedPath } from "./wallet-auth";

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

  const activeKey = getActiveApiKey();
  if (activeKey && !headers.Authorization) {
    headers.Authorization = `Bearer ${activeKey}`;
  }

  if (isWalletScopedPath(path)) {
    const walletHeaders = await getWalletAuthHeaders();
    Object.assign(headers, walletHeaders);
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",
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
