const STORAGE_KEY = "zks.active_api_key.v1";

export function getActiveApiKey(): string | null {
  if (globalThis.window === undefined) return null;
  return globalThis.localStorage.getItem(STORAGE_KEY);
}

export function setActiveApiKey(key: string): void {
  if (globalThis.window === undefined) return;
  globalThis.localStorage.setItem(STORAGE_KEY, key);
  globalThis.dispatchEvent(new CustomEvent("zks:active-key-changed"));
}

export function clearActiveApiKey(): void {
  if (globalThis.window === undefined) return;
  globalThis.localStorage.removeItem(STORAGE_KEY);
  globalThis.dispatchEvent(new CustomEvent("zks:active-key-changed"));
}
