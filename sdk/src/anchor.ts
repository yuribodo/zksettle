import type { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";

type AnchorClientModule = {
  AnchorProvider: typeof AnchorProvider;
  Program: typeof Program;
};

type AnchorNodeModule = AnchorClientModule & {
  Wallet: typeof Wallet;
};

let browserAnchorPromise: Promise<AnchorClientModule> | undefined;
let nodeAnchorPromise: Promise<AnchorNodeModule> | undefined;

function normalizeAnchorClientModule(module: unknown): AnchorClientModule {
  const candidate =
    module && typeof module === "object" && "AnchorProvider" in module
      ? module
      : (module as { default?: unknown })?.default;

  if (
    !candidate ||
    typeof candidate !== "object" ||
    !("AnchorProvider" in candidate) ||
    !("Program" in candidate)
  ) {
    throw new Error("Failed to load Anchor client module.");
  }

  return candidate as AnchorClientModule;
}

export async function loadAnchorBrowser(): Promise<AnchorClientModule> {
  browserAnchorPromise ??= import("@coral-xyz/anchor/dist/browser/index.js").then(
    normalizeAnchorClientModule,
  );

  return browserAnchorPromise;
}

export async function loadAnchorNode(): Promise<AnchorNodeModule> {
  nodeAnchorPromise ??= import("@coral-xyz/anchor").then((module) => {
    const anchor = normalizeAnchorClientModule(module) as Partial<AnchorNodeModule>;
    if (!anchor.Wallet) {
      throw new Error("Failed to load Anchor Wallet runtime.");
    }
    return anchor as AnchorNodeModule;
  });

  return nodeAnchorPromise;
}
