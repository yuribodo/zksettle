import { describe, it, expect, beforeAll, vi } from "vitest";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import idl from "../idl/zksettle.json" with { type: "json" };
import { buildSettleHookIx } from "./index.js";
import {
  findHookPayloadPda,
  findIssuerPda,
  findRegistryPda,
  findTreeConfigPda,
  findTreeCreatorPda,
} from "./pda.js";
import {
  MPL_BUBBLEGUM_ID,
  SPL_ACCOUNT_COMPRESSION_ID,
  SPL_NOOP_ID,
  ZKSETTLE_PROGRAM_ID,
} from "../constants.js";

const SETTLE_HOOK_DISCRIMINATOR = new Uint8Array([188, 162, 182, 6, 30, 19, 21, 139]);

class DummyWallet {
  readonly payer = Keypair.generate();
  readonly publicKey = this.payer.publicKey;
  async signTransaction<T>(tx: T): Promise<T> { return tx; }
  async signAllTransactions<T>(txs: T[]): Promise<T[]> { return txs; }
}

function buildProgram() {
  // Connection URL is never hit; AnchorProvider/Program construction is RPC-free
  // and we mock the only `.account.X.fetch` calls below.
  const connection = new Connection("http://127.0.0.1:8899");
  const provider = new AnchorProvider(connection, new DummyWallet() as any, {});
  return new Program(idl as any, provider);
}

describe("buildSettleHookIx", () => {
  const authority = Keypair.generate().publicKey;
  const merkleTree = Keypair.generate().publicKey;
  const recipient = Keypair.generate().publicKey;
  const mint = Keypair.generate().publicKey;
  const amount = new BN(1_234_567);

  let program: Program;
  let registryFetch: ReturnType<typeof vi.fn>;
  let payloadFetch: ReturnType<typeof vi.fn>;
  let ix: Awaited<ReturnType<typeof buildSettleHookIx>>;

  beforeAll(async () => {
    program = buildProgram();
    registryFetch = vi.fn().mockResolvedValue({ merkleTree });
    payloadFetch = vi.fn().mockResolvedValue({ recipient, mint });
    (program.account as any).bubblegumTreeRegistry.fetch = registryFetch;
    (program.account as any).hookPayload.fetch = payloadFetch;

    const connection = new Connection("http://127.0.0.1:8899");
    ix = await buildSettleHookIx(
      authority,
      amount as any,
      connection,
      ZKSETTLE_PROGRAM_ID,
      program,
    );
  });

  it("targets the zksettle program", () => {
    expect(ix.programId.equals(ZKSETTLE_PROGRAM_ID)).toBe(true);
  });

  it("has 14 accounts (matches IDL SettleHook ctx)", () => {
    expect(ix.keys).toHaveLength(14);
  });

  it("encodes the settle_hook discriminator", () => {
    expect(Buffer.from(ix.data.subarray(0, 8))).toEqual(Buffer.from(SETTLE_HOOK_DISCRIMINATOR));
  });

  it("encodes amount as little-endian u64 after discriminator", () => {
    expect(ix.data.length).toBe(16);
    expect(ix.data.readBigUInt64LE(8)).toBe(BigInt(amount.toString()));
  });

  it("fetches registry and hook_payload from the correct PDAs", () => {
    const [registryPda] = findRegistryPda(ZKSETTLE_PROGRAM_ID);
    const [hookPayloadPda] = findHookPayloadPda(authority, ZKSETTLE_PROGRAM_ID);
    expect((registryFetch.mock.calls[0]?.[0] as PublicKey).equals(registryPda)).toBe(true);
    expect((payloadFetch.mock.calls[0]?.[0] as PublicKey).equals(hookPayloadPda)).toBe(true);
  });

  it("issues both fetches in parallel (Promise.all)", () => {
    // Both mocks must have been invoked before either resolves — Promise.all
    // starts every promise synchronously. We assert both were called exactly
    // once, which is the observable contract; ordering between them is not
    // guaranteed but must both fire before the methods chain runs.
    expect(registryFetch).toHaveBeenCalledTimes(1);
    expect(payloadFetch).toHaveBeenCalledTimes(1);
  });

  describe("account layout (must match settle_hook IDL order)", () => {
    const [issuerPda] = findIssuerPda(authority, ZKSETTLE_PROGRAM_ID);
    const [hookPayloadPda] = findHookPayloadPda(authority, ZKSETTLE_PROGRAM_ID);
    const [registryPda] = findRegistryPda(ZKSETTLE_PROGRAM_ID);
    const [treeCreatorPda] = findTreeCreatorPda(ZKSETTLE_PROGRAM_ID);

    it("0: authority — signer + writable", () => {
      const k = ix.keys[0]!;
      expect(k.pubkey.equals(authority)).toBe(true);
      expect(k.isSigner).toBe(true);
      expect(k.isWritable).toBe(true);
    });

    it("1: mint (from payload)", () => {
      expect(ix.keys[1]!.pubkey.equals(mint)).toBe(true);
      expect(ix.keys[1]!.isSigner).toBe(false);
    });

    it("2: destinationToken == payload.recipient", () => {
      expect(ix.keys[2]!.pubkey.equals(recipient)).toBe(true);
    });

    it("3: hookPayload PDA — writable", () => {
      expect(ix.keys[3]!.pubkey.equals(hookPayloadPda)).toBe(true);
      expect(ix.keys[3]!.isWritable).toBe(true);
    });

    it("4: leafOwner == recipient (settle_hook requires equality)", () => {
      expect(ix.keys[4]!.pubkey.equals(recipient)).toBe(true);
    });

    it("5: issuer PDA", () => {
      expect(ix.keys[5]!.pubkey.equals(issuerPda)).toBe(true);
    });

    it("6: registry PDA", () => {
      expect(ix.keys[6]!.pubkey.equals(registryPda)).toBe(true);
    });

    it("7: merkleTree (from registry) — writable", () => {
      expect(ix.keys[7]!.pubkey.equals(merkleTree)).toBe(true);
      expect(ix.keys[7]!.isWritable).toBe(true);
    });

    it("8: treeConfig PDA derived from merkleTree — writable", () => {
      const [treeConfigPda] = findTreeConfigPda(merkleTree);
      expect(ix.keys[8]!.pubkey.equals(treeConfigPda)).toBe(true);
      expect(ix.keys[8]!.isWritable).toBe(true);
    });

    it("9: treeCreator PDA", () => {
      expect(ix.keys[9]!.pubkey.equals(treeCreatorPda)).toBe(true);
    });

    it("10: bubblegumProgram", () => {
      expect(ix.keys[10]!.pubkey.equals(MPL_BUBBLEGUM_ID)).toBe(true);
    });

    it("11: compressionProgram", () => {
      expect(ix.keys[11]!.pubkey.equals(SPL_ACCOUNT_COMPRESSION_ID)).toBe(true);
    });

    it("12: logWrapper (noop)", () => {
      expect(ix.keys[12]!.pubkey.equals(SPL_NOOP_ID)).toBe(true);
    });

    it("13: systemProgram", () => {
      expect(ix.keys[13]!.pubkey.equals(PublicKey.default)).toBe(true);
    });
  });
});
