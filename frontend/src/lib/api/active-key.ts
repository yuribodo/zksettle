const STORAGE_KEY = "zks.active_api_key.v1";

export function getActiveApiKey(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function setActiveApiKey(key: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, key);
  window.dispatchEvent(new CustomEvent("zks:active-key-changed"));
}

export function clearActiveApiKey(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent("zks:active-key-changed"));
}
