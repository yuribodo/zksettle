export interface ActiveKeyStatus {
  hasKey: boolean;
  prefix?: string;
}

const ACTIVE_KEY_CHANGED_EVENT = "zks:active-key-changed";

export async function fetchActiveKeyStatus(): Promise<ActiveKeyStatus> {
  const res = await fetch("/api/active-key/status", {
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!res.ok) return { hasKey: false };
  return (await res.json()) as ActiveKeyStatus;
}

export async function setActiveApiKey(key: string): Promise<void> {
  const res = await fetch("/api/active-key", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `failed_to_set_active_key_${res.status}`);
  }
  notifyActiveKeyChanged();
}

export async function clearActiveApiKey(): Promise<void> {
  await fetch("/api/active-key", {
    method: "DELETE",
    credentials: "same-origin",
  });
  notifyActiveKeyChanged();
}

function notifyActiveKeyChanged(): void {
  if (typeof window === "undefined") return;
  globalThis.dispatchEvent(new CustomEvent(ACTIVE_KEY_CHANGED_EVENT));
}

export function onActiveKeyChanged(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  globalThis.addEventListener(ACTIVE_KEY_CHANGED_EVENT, handler);
  return () => globalThis.removeEventListener(ACTIVE_KEY_CHANGED_EVENT, handler);
}
