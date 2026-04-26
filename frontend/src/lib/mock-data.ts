/**
 * Typed mock data for the ZKSettle dashboard. All arrays are deterministic so
 * the same seed always produces the same sequence across SSR / client / tests.
 * Pre-generated via `createPrng(seed)` from `./prng`.
 *
 * Shapes are stable: UI code (status pills, tables, stat cards) imports from
 * here without reaching for `Math.random()`. The live-feed ticker uses
 * `generateLiveEvent(seed, index)` so the same `?seed=N` URL parameter yields
 * the same visible sequence on every reload.
 */
import { createPrng, type Prng } from "./prng";

export type TransactionStatus = "verified" | "blocked" | "pending";

export type Jurisdiction = "US" | "EU" | "UK" | "BR";

export type IssuerStatus = "active" | "stale" | "test";

export interface Issuer {
  id: string;
  name: string;
  pubkey: string;
  merkleRoot: string;
  users: number;
  lastUpdate: string;
  status: IssuerStatus;
}

export interface Transaction {
  id: string;
  time: string;
  wallet: string;
  issuerId: string;
  status: TransactionStatus;
  amount: number;
  currency: "USDC";
  jurisdiction: Jurisdiction;
  txHash: string;
  proofHash: string;
  slot: number;
  cu: number;
}

export interface AuditEvent extends Transaction {
  block: number;
}

export interface BillingDay {
  date: string;
  proofs: number;
}

export interface Invoice {
  id: string;
  period: string;
  amount: number;
  status: "paid" | "pending";
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: "Owner" | "Admin" | "Developer" | "Viewer";
  lastActive: string;
}

export interface Policy {
  id: string;
  mint: string;
  name: string;
  jurisdictions: readonly Jurisdiction[];
  minAge: number;
  sanctions: "strict" | "lenient";
}

export interface ApiKey {
  id: string;
  label: string;
  prefix: string;
  createdAt: string;
  lastUsed: string;
  env: "devnet" | "mainnet";
}

const ISSUER_NAMES = ["Persona", "Sumsub", "Onfido", "Jumio", "Veriff", "MockKYC"] as const;
const JURISDICTIONS: readonly Jurisdiction[] = ["US", "EU", "UK", "BR"];
const STATUSES: readonly TransactionStatus[] = ["verified", "verified", "verified", "verified", "blocked", "pending"];

function hexString(prng: Prng, length: number): string {
  const chars = "0123456789abcdef";
  let out = "0x";
  for (let i = 0; i < length; i += 1) {
    out += chars.charAt(Math.floor(prng.next() * 16));
  }
  return out;
}

function base58ish(prng: Prng, length: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789";
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += chars.charAt(Math.floor(prng.next() * chars.length));
  }
  return out;
}

function buildIssuers(): Issuer[] {
  const prng = createPrng(42);
  const nowMs = Date.parse("2026-04-18T12:00:00Z");
  const hour = 60 * 60 * 1000;
  return ISSUER_NAMES.map((name, index) => {
    const isStale = index === 4;
    const isTest = index === 5;
    const status: IssuerStatus = isStale ? "stale" : isTest ? "test" : "active";
    const ageHours = isStale ? 36 + Math.floor(prng.next() * 48) : Math.floor(prng.next() * 6);
    const lastUpdate = new Date(nowMs - ageHours * hour).toISOString();
    return {
      id: `issuer-${index + 1}`,
      name,
      pubkey: base58ish(prng, 44),
      merkleRoot: hexString(prng, 64),
      users: Math.floor(100 + prng.next() * 18_400),
      lastUpdate,
      status,
    };
  });
}

export const ISSUERS: readonly Issuer[] = buildIssuers();

function buildTransactionFrom(prng: Prng, index: number, nowMs: number): Transaction {
  const issuer = ISSUERS[index % ISSUERS.length]!;
  const status = STATUSES[Math.floor(prng.next() * STATUSES.length)] ?? "verified";
  const minute = 60 * 1000;
  const secondsAgo = Math.floor(prng.next() * 60 * 60 * 24); // up to 24h
  const time = new Date(nowMs - secondsAgo * 1000 - index * minute).toISOString();
  const amount = Math.round((50 + prng.next() * 49_950) * 100) / 100;
  const jurisdiction = JURISDICTIONS[Math.floor(prng.next() * JURISDICTIONS.length)] ?? "US";
  return {
    id: `tx-${index}-${hexString(prng, 8).slice(2)}`,
    time,
    wallet: base58ish(prng, 44),
    issuerId: issuer.id,
    status,
    amount,
    currency: "USDC",
    jurisdiction,
    txHash: base58ish(prng, 88),
    proofHash: hexString(prng, 64),
    slot: 287_000_000 + Math.floor(prng.next() * 2_000_000),
    cu: 180_000 + Math.floor(prng.next() * 40_000),
  };
}

function buildInitialTransactions(): Transaction[] {
  const prng = createPrng(7);
  const nowMs = Date.parse("2026-04-18T12:00:00Z");
  const out: Transaction[] = [];
  for (let i = 0; i < 100; i += 1) {
    out.push(buildTransactionFrom(prng, i, nowMs));
  }
  return out;
}

export const INITIAL_TRANSACTIONS: readonly Transaction[] = buildInitialTransactions();

function buildAuditEvents(): AuditEvent[] {
  const prng = createPrng(99);
  const base = Date.parse("2026-04-18T12:00:00Z");
  const day = 24 * 60 * 60 * 1000;
  const events: AuditEvent[] = [];
  for (let i = 0; i < 260; i += 1) {
    const dayOffset = Math.floor(prng.next() * 30);
    const secondOffset = Math.floor(prng.next() * day) / 1000;
    const timestamp = base - dayOffset * day - secondOffset * 1000;
    const tx = buildTransactionFrom(prng, i, timestamp);
    events.push({ ...tx, time: new Date(timestamp).toISOString(), block: 287_000_000 + i * 13 });
  }
  return events.sort((a, b) => b.time.localeCompare(a.time));
}

export const AUDIT_EVENTS: readonly AuditEvent[] = buildAuditEvents();

function buildBillingUsage(): BillingDay[] {
  const prng = createPrng(11);
  const base = Date.parse("2026-04-18T00:00:00Z");
  const day = 24 * 60 * 60 * 1000;
  const out: BillingDay[] = [];
  for (let i = 29; i >= 0; i -= 1) {
    const d = new Date(base - i * day);
    const dow = d.getUTCDay();
    const weekendDip = dow === 0 || dow === 6 ? 0.55 : 1;
    const proofs = Math.floor((380 + prng.next() * 520) * weekendDip);
    out.push({ date: d.toISOString().slice(0, 10), proofs });
  }
  return out;
}

export const BILLING_USAGE: readonly BillingDay[] = buildBillingUsage();

export const INVOICES: readonly Invoice[] = [
  { id: "inv-2026-03", period: "March 2026", amount: 921.55, status: "paid" },
  { id: "inv-2026-02", period: "February 2026", amount: 847.2, status: "paid" },
  { id: "inv-2026-01", period: "January 2026", amount: 792.05, status: "paid" },
];

export const TEAM: readonly TeamMember[] = [
  {
    id: "team-1",
    name: "Mario Ribeiro",
    email: "mario@acme-stablecoin.xyz",
    role: "Owner",
    lastActive: "2026-04-18T11:40:00Z",
  },
  {
    id: "team-2",
    name: "Lena Park",
    email: "lena@acme-stablecoin.xyz",
    role: "Admin",
    lastActive: "2026-04-18T09:12:00Z",
  },
  {
    id: "team-3",
    name: "Rafael Souza",
    email: "rafael@acme-stablecoin.xyz",
    role: "Developer",
    lastActive: "2026-04-17T22:18:00Z",
  },
  {
    id: "team-4",
    name: "Priya Anand",
    email: "priya@acme-stablecoin.xyz",
    role: "Viewer",
    lastActive: "2026-04-15T14:03:00Z",
  },
];

export const POLICIES: readonly Policy[] = [
  {
    id: "pol-1",
    mint: "USDC-acme",
    name: "Default US + EU",
    jurisdictions: ["US", "EU"],
    minAge: 18,
    sanctions: "strict",
  },
  {
    id: "pol-2",
    mint: "USDC-acme",
    name: "UK expansion",
    jurisdictions: ["UK"],
    minAge: 18,
    sanctions: "strict",
  },
  {
    id: "pol-3",
    mint: "BRL-stable",
    name: "Brazil pilot",
    jurisdictions: ["BR"],
    minAge: 18,
    sanctions: "lenient",
  },
];

export const API_KEYS: readonly ApiKey[] = [
  {
    id: "key-1",
    label: "Production devnet",
    prefix: "zks_dn_9f4a",
    createdAt: "2026-02-14T12:00:00Z",
    lastUsed: "2026-04-18T11:50:00Z",
    env: "devnet",
  },
  {
    id: "key-2",
    label: "CI / preview",
    prefix: "zks_dn_7c12",
    createdAt: "2026-03-02T08:30:00Z",
    lastUsed: "2026-04-18T10:44:00Z",
    env: "devnet",
  },
  {
    id: "key-3",
    label: "Mainnet (pending beta)",
    prefix: "zks_mn_0000",
    createdAt: "2026-04-01T16:00:00Z",
    lastUsed: "—",
    env: "mainnet",
  },
];

export function issuerById(id: string): Issuer | undefined {
  return ISSUERS.find((issuer) => issuer.id === id);
}

/**
 * Deterministic live-feed generator. Given a seed (usually from `?seed=N`) and
 * an index (0,1,2,…), returns the next transaction to prepend to the feed. The
 * time always sits `index` seconds BEFORE the seed's base timestamp, so the
 * same `(seed,index)` pair always yields the same transaction on any device.
 */
export function generateLiveEvent(seed: number, index: number): Transaction {
  const prng = createPrng((seed >>> 0) ^ (index * 0x9e3779b1));
  const base = Date.parse("2026-04-18T12:00:00Z");
  const time = new Date(base + index * 1000).toISOString();
  const tx = buildTransactionFrom(prng, index, base);
  return { ...tx, time };
}
