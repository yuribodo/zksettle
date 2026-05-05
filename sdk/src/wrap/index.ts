import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { AnchorProvider, BN, Program, Wallet } from "@coral-xyz/anchor";
import type { WrapOptions, ZkSettleConfig, StagedLightArgs } from "../types.js";
import { ZKSETTLE_PROGRAM_ID } from "../constants.js";
import { findIssuerPda, findHookPayloadPda } from "./pda.js";
import idl from "../idl/zksettle.json" with { type: "json" };

const DEFAULT_LIGHT_ARGS: StagedLightArgs = {
  bubblegumTail: 0,
  proofPresent: false,
  proofBytes: Array.from(new Uint8Array(128)),
  addressMtIndex: 0,
  addressQueueIndex: 0,
  addressRootIndex: 0,
  outputStateTreeIndex: 0,
};

export async function wrap(
  options: WrapOptions,
  config?: ZkSettleConfig,
): Promise<Transaction> {
  const programId = config?.programId ?? ZKSETTLE_PROGRAM_ID;

  const [issuerPda] = findIssuerPda(options.wallet, programId);
  const [hookPayloadPda] = findHookPayloadPda(options.wallet, programId);

  const dummyWallet = new Wallet(Keypair.generate());
  const provider = new AnchorProvider(options.connection, dummyWallet, {});
  const program = new Program(idl as any, provider);

  const lightArgs = options.lightArgs ?? DEFAULT_LIGHT_ARGS;
  const epoch = options.transferContext.epoch ?? Math.floor(Date.now() / 1000 / 86400);

  const instruction = await program.methods
    .setHookPayload(
      Buffer.from(options.proof),
      Array.from(options.nullifierHash),
      options.transferContext.mint,
      new BN(epoch),
      options.transferContext.recipient,
      options.transferContext.amount,
      lightArgs,
    )
    .accounts({
      authority: options.wallet,
      issuer: issuerPda,
      hookPayload: hookPayloadPda,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  return new Transaction().add(instruction);
}
