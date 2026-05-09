import { createHash } from "node:crypto";

import { test as base, type Route } from "@playwright/test";

const MOCK_TENANT = {
  tenant_id: "00000000-0000-0000-0000-000000000001",
  wallet: "GgMEeuntnq4v9jrR7q958thgDuEWMseg2U94fvK5tvQk",
  name: null,
  tier: "developer",
} as const;

const EMPTY_LEAF = "0".repeat(64);
const SEEDED_API_KEY = "zks_seeded_e2e_key_1234567890abcdef";
const CREDENTIAL_PATH_RE = /\/api\/proxy\/v1\/credentials\/([^/]+)$/;
const MEMBERSHIP_PROOF_PATH_RE = /\/api\/proxy\/v1\/proofs\/membership\/([^/]+)$/;
const SANCTIONS_PROOF_PATH_RE = /\/api\/proxy\/v1\/proofs\/sanctions\/([^/]+)$/;
const API_KEY_PATH_RE = /\/api\/proxy\/api-keys\/([^/]+)$/;

interface MockKeyRecord {
  api_key: string;
  created_at: number;
  key_hash: string;
  owner: string;
  tier: "developer";
}

interface MockCredentialRecord {
  issued_at: number;
  jurisdiction: string;
  leaf_index: number;
  revoked: boolean;
  wallet: string;
}

interface MockState {
  activeKey: string | null;
  credentials: Map<string, MockCredentialRecord>;
  events: ReturnType<typeof createEvent>[];
  keys: MockKeyRecord[];
  nextPublishSlot: number;
  roots: {
    jurisdiction_root: string;
    last_publish_slot: number;
    membership_root: string;
    sanctions_root: string;
    wallet_count: number;
  };
  usage: {
    monthly_limit: number;
    tier: "developer";
    usage: {
      last_request: number;
      period_start: number;
      request_count: number;
    };
  };
  usageHistory: {
    history: ReturnType<typeof createUsageHistory>;
    monthly_limit: number;
    tier: "developer";
  };
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function keyPrefix(key: string): string {
  if (key.length <= 12) return key;
  return `${key.slice(0, 8)}\u2026${key.slice(-4)}`;
}

function hexToByteArray(hex: string): number[] {
  const normalized = hex.startsWith("0x") ? hex.slice(2) : hex;
  return Array.from({ length: normalized.length / 2 }, (_, index) =>
    Number.parseInt(normalized.slice(index * 2, index * 2 + 2), 16),
  );
}

function createApiKey(seed: string): string {
  const safe = seed.replace(/[^A-Za-z0-9_-]/g, "_");
  const suffix = `${safe}________________________________`;
  return `zks_${suffix.slice(0, 32)}`;
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

function readBody(route: Route): Record<string, unknown> {
  try {
    return route.request().postDataJSON() as Record<string, unknown>;
  } catch {
    return {};
  }
}

function createUsageHistory() {
  return Array.from({ length: 30 }, (_, index) => ({
    date: new Date(Date.UTC(2026, 3, 9 + index)).toISOString(),
    count: 12 + ((index * 7) % 19),
  }));
}

function createEvent(index: number) {
  const padded = String(index + 1).padStart(2, "0");
  return {
    signature: `sig_${padded}_${"a".repeat(20)}`,
    slot: 420_000 + index,
    timestamp: 1_777_000_000 + index * 60,
    issuer: `issuer${padded}${"a".repeat(56)}`,
    nullifier_hash: `nullifier${padded}${"b".repeat(54)}`,
    merkle_root: `merkle${padded}${"c".repeat(56)}`,
    sanctions_root: `sanctions${padded}${"d".repeat(53)}`,
    jurisdiction_root: `jurisdiction${padded}${"e".repeat(50)}`,
    mint: `mint${padded}${"f".repeat(58)}`,
    recipient: `recipient${padded}${"0".repeat(51)}`,
    payer: `payer${padded}${"1".repeat(55)}`,
    amount: 2_500_000 + index * 100_000,
    epoch: 7,
  };
}

function createMembershipProof(wallet: string, root: string) {
  return {
    wallet,
    leaf_index: 7,
    path: [`1${"a".repeat(63)}`, `2${"b".repeat(63)}`, `3${"c".repeat(63)}`],
    path_indices: [0, 1, 0],
    root,
  };
}

function createSanctionsProof(wallet: string, root: string) {
  return {
    wallet,
    path: [`4${"d".repeat(63)}`, `5${"e".repeat(63)}`, `6${"f".repeat(63)}`],
    path_indices: [1, 0, 1],
    leaf_value: EMPTY_LEAF,
    root,
  };
}

function createCredentialRecord(wallet: string, jurisdiction = "US"): MockCredentialRecord {
  return {
    wallet,
    leaf_index: 7,
    jurisdiction,
    issued_at: 1_777_100_000,
    revoked: false,
  };
}

function createMockState(): MockState {
  const seededKey: MockKeyRecord = {
    api_key: SEEDED_API_KEY,
    created_at: 1_777_000_000,
    key_hash: sha256Hex(SEEDED_API_KEY),
    owner: "dashboard-default",
    tier: "developer",
  };

  return {
    activeKey: SEEDED_API_KEY,
    credentials: new Map<string, MockCredentialRecord>(),
    keys: [seededKey],
    nextPublishSlot: 512_000,
    roots: {
      membership_root: `1${"a".repeat(63)}`,
      sanctions_root: `2${"b".repeat(63)}`,
      jurisdiction_root: `3${"c".repeat(63)}`,
      last_publish_slot: 0,
      wallet_count: 12,
    },
    usage: {
      tier: "developer",
      monthly_limit: 1_000,
      usage: {
        request_count: 128,
        period_start: 1_777_000_000,
        last_request: 1_777_086_400,
      },
    },
    usageHistory: {
      tier: "developer",
      monthly_limit: 1_000,
      history: createUsageHistory(),
    },
    events: [createEvent(0), createEvent(1), createEvent(2)],
  };
}

async function handleActiveKeyStatusRoute(route: Route, state: MockState): Promise<void> {
  if (route.request().method() !== "GET") {
    await route.fallback();
    return;
  }

  await json(
    route,
    state.activeKey ? { hasKey: true, prefix: keyPrefix(state.activeKey) } : { hasKey: false },
  );
}

async function handleActiveKeyRoute(route: Route, state: MockState): Promise<void> {
  const method = route.request().method();

  if (method === "POST") {
    const body = readBody(route);
    const key = typeof body.key === "string" ? body.key : null;
    if (!key) {
      await json(route, { error: "invalid_key_format" }, 400);
      return;
    }

    state.activeKey = key;
    await json(route, { ok: true });
    return;
  }

  if (method === "DELETE") {
    const cleared = state.activeKey !== null;
    state.activeKey = null;
    await json(route, { ok: true, cleared });
    return;
  }

  await route.fallback();
}

async function handleStaticProxyRoute(
  pathname: string,
  route: Route,
  state: MockState,
): Promise<boolean> {
  if (pathname.endsWith("/api/proxy/auth/me")) {
    await json(route, MOCK_TENANT);
    return true;
  }

  if (pathname.endsWith("/api/proxy/health")) {
    await json(route, { status: "ok", version: "test" });
    return true;
  }

  if (pathname.endsWith("/api/proxy/usage/history")) {
    await json(route, state.usageHistory);
    return true;
  }

  if (pathname.endsWith("/api/proxy/usage")) {
    await json(route, state.usage);
    return true;
  }

  if (pathname.endsWith("/api/proxy/v1/events")) {
    await json(route, { events: state.events, next_cursor: null });
    return true;
  }

  return false;
}

async function handleRootsRoute(
  pathname: string,
  method: string,
  route: Route,
  state: MockState,
): Promise<boolean> {
  if (pathname.endsWith("/api/proxy/v1/roots") && method === "GET") {
    await json(route, state.roots);
    return true;
  }

  if (pathname.endsWith("/api/proxy/v1/roots/publish") && method === "POST") {
    state.roots.last_publish_slot = state.nextPublishSlot++;
    await json(route, { slot: state.roots.last_publish_slot, registered: true });
    return true;
  }

  return false;
}

async function handleWalletRegistrationRoute(
  pathname: string,
  method: string,
  route: Route,
): Promise<boolean> {
  if (!(pathname.endsWith("/api/proxy/v1/wallets") && method === "POST")) {
    return false;
  }

  const body = readBody(route);
  const wallet = typeof body.wallet === "string" ? body.wallet : "";
  await json(route, { wallet, message: "registered in membership tree" });
  return true;
}

async function handleCredentialCreateRoute(
  pathname: string,
  method: string,
  route: Route,
  state: MockState,
): Promise<boolean> {
  if (!(pathname.endsWith("/api/proxy/v1/credentials") && method === "POST")) {
    return false;
  }

  const body = readBody(route);
  const wallet = typeof body.wallet === "string" ? body.wallet : "";
  const jurisdiction =
    typeof body.jurisdiction === "string" && body.jurisdiction.length > 0
      ? body.jurisdiction
      : "US";

  const existing = state.credentials.get(wallet);
  if (existing && !existing.revoked) {
    await json(route, { error: "wallet_already_has_credential" }, 409);
    return true;
  }

  const created = createCredentialRecord(wallet, jurisdiction);
  state.credentials.set(wallet, created);
  state.roots.wallet_count += existing ? 0 : 1;

  await json(route, {
    wallet,
    leaf_index: created.leaf_index,
    jurisdiction: created.jurisdiction,
  });
  return true;
}

async function handleCredentialItemRoute(
  pathname: string,
  method: string,
  route: Route,
  state: MockState,
): Promise<boolean> {
  const credentialMatch = CREDENTIAL_PATH_RE.exec(pathname);
  if (!credentialMatch) return false;

  const wallet = decodeURIComponent(credentialMatch[1]!);
  const credential = state.credentials.get(wallet);

  if (method === "GET") {
    if (!credential) {
      await json(route, { error: "not_found" }, 404);
      return true;
    }

    await json(route, {
      wallet: hexToByteArray(credential.wallet),
      leaf_index: credential.leaf_index,
      jurisdiction: credential.jurisdiction,
      issued_at: credential.issued_at,
      revoked: credential.revoked,
    });
    return true;
  }

  if (method === "DELETE") {
    if (!credential) {
      await json(route, { error: "not_found" }, 404);
      return true;
    }

    credential.revoked = true;
    await json(route, { wallet, revoked: true });
    return true;
  }

  return false;
}

async function handleProofRoute(
  pathname: string,
  route: Route,
  state: MockState,
): Promise<boolean> {
  const membershipMatch = MEMBERSHIP_PROOF_PATH_RE.exec(pathname);
  if (membershipMatch) {
    const wallet = decodeURIComponent(membershipMatch[1]!);
    await json(route, createMembershipProof(wallet, state.roots.membership_root));
    return true;
  }

  const sanctionsMatch = SANCTIONS_PROOF_PATH_RE.exec(pathname);
  if (sanctionsMatch) {
    const wallet = decodeURIComponent(sanctionsMatch[1]!);
    await json(route, createSanctionsProof(wallet, state.roots.sanctions_root));
    return true;
  }

  return false;
}

function listedKeys(state: MockState) {
  return state.keys.map(({ api_key: _apiKey, ...key }) => key);
}

async function handleApiKeysCollectionRoute(
  pathname: string,
  method: string,
  route: Route,
  state: MockState,
): Promise<boolean> {
  if (!pathname.endsWith("/api/proxy/api-keys")) return false;

  if (method === "GET") {
    await json(route, { keys: listedKeys(state) });
    return true;
  }

  if (method === "POST") {
    const body = readBody(route);
    const owner = typeof body.owner === "string" ? body.owner : "dashboard";
    const api_key = createApiKey(`${owner}_${state.keys.length + 1}`);
    const key: MockKeyRecord = {
      api_key,
      created_at: 1_777_000_000 + state.keys.length * 60,
      key_hash: sha256Hex(api_key),
      owner,
      tier: "developer",
    };
    state.keys.unshift(key);
    await json(route, { api_key: key.api_key, owner: key.owner, tier: key.tier });
    return true;
  }

  return false;
}

async function handleApiKeyDeleteRoute(
  pathname: string,
  method: string,
  route: Route,
  state: MockState,
): Promise<boolean> {
  if (method !== "DELETE") return false;

  const deleteKeyMatch = API_KEY_PATH_RE.exec(pathname);
  if (!deleteKeyMatch) return false;

  const keyHash = decodeURIComponent(deleteKeyMatch[1]!);
  state.keys = state.keys.filter((key) => key.key_hash !== keyHash);
  await json(route, { key_hash: keyHash, deleted: true });
  return true;
}

async function handleProxyRoute(route: Route, state: MockState): Promise<void> {
  const request = route.request();
  const { pathname } = new URL(request.url());
  const method = request.method();

  const handlers = [
    () => handleStaticProxyRoute(pathname, route, state),
    () => handleRootsRoute(pathname, method, route, state),
    () => handleWalletRegistrationRoute(pathname, method, route),
    () => handleCredentialCreateRoute(pathname, method, route, state),
    () => handleCredentialItemRoute(pathname, method, route, state),
    () => handleProofRoute(pathname, route, state),
    () => handleApiKeysCollectionRoute(pathname, method, route, state),
    () => handleApiKeyDeleteRoute(pathname, method, route, state),
  ];

  for (const handler of handlers) {
    if (await handler()) return;
  }

  await json(route, { error: "not_found", path: pathname }, 404);
}

export const test = base.extend({
  page: async ({ page }, apply) => {
    const state = createMockState();

    await page.route("**/api/active-key/status", (route) => handleActiveKeyStatusRoute(route, state));
    await page.route("**/api/active-key", (route) => handleActiveKeyRoute(route, state));
    await page.route("**/api/proxy/**", (route) => handleProxyRoute(route, state));

    await apply(page);
  },
});

export { expect } from "@playwright/test";
