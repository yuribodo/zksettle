import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = {
  NEXT_PUBLIC_SOLANA_NETWORK: process.env.NEXT_PUBLIC_SOLANA_NETWORK,
  NEXT_PUBLIC_SOLANA_RPC_URL: process.env.NEXT_PUBLIC_SOLANA_RPC_URL,
};

async function loadConfig() {
  vi.resetModules();
  return import("./config");
}

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
}

afterEach(() => {
  restoreEnv("NEXT_PUBLIC_SOLANA_NETWORK", ORIGINAL_ENV.NEXT_PUBLIC_SOLANA_NETWORK);
  restoreEnv("NEXT_PUBLIC_SOLANA_RPC_URL", ORIGINAL_ENV.NEXT_PUBLIC_SOLANA_RPC_URL);
});

describe("config", () => {
  it("defaults Solana settings to devnet", async () => {
    delete process.env.NEXT_PUBLIC_SOLANA_NETWORK;
    delete process.env.NEXT_PUBLIC_SOLANA_RPC_URL;

    const { SOLANA_NETWORK, SOLANA_RPC_URL } = await loadConfig();

    expect(SOLANA_NETWORK).toBe("devnet");
    expect(SOLANA_RPC_URL).toBe("https://api.devnet.solana.com");
  });

  it("uses the configured network and custom RPC URL", async () => {
    process.env.NEXT_PUBLIC_SOLANA_NETWORK = "testnet";
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL = "https://rpc.zksettle.test";

    const { SOLANA_NETWORK, SOLANA_RPC_URL } = await loadConfig();

    expect(SOLANA_NETWORK).toBe("testnet");
    expect(SOLANA_RPC_URL).toBe("https://rpc.zksettle.test");
  });

  it("falls back to devnet for unsupported network values", async () => {
    process.env.NEXT_PUBLIC_SOLANA_NETWORK = "invalid";
    delete process.env.NEXT_PUBLIC_SOLANA_RPC_URL;

    const { SOLANA_NETWORK, SOLANA_RPC_URL } = await loadConfig();

    expect(SOLANA_NETWORK).toBe("devnet");
    expect(SOLANA_RPC_URL).toBe("https://api.devnet.solana.com");
  });
});
