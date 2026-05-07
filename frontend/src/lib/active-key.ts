export const ACTIVE_KEY_STORAGE_KEY = "zks.active_api_key";

export function getActiveApiKey(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ACTIVE_KEY_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setActiveApiKey(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ACTIVE_KEY_STORAGE_KEY, key);
  } catch {
    // storage full or blocked
  }
}

export function clearActiveApiKey(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ACTIVE_KEY_STORAGE_KEY);
  } catch {
    // no-op
  }
}

export function activeKeyPrefix(): string | null {
  const key = getActiveApiKey();
  if (!key) return null;
  if (key.length <= 12) return key;
  return `${key.slice(0, 8)}…${key.slice(-4)}`;
}
