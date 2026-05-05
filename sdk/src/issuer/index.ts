import { type Connection, Keypair, SystemProgram } from "@solana/web3.js";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import type { IssuerRoots } from "../types.js";
import { findIssuerPda } from "../wrap/pda.js";
import idl from "../idl/zksettle.json" with { type: "json" };

export async function registerIssuer(
  connection: Connection,
  authority: Keypair,
  roots: IssuerRoots,
): Promise<string> {
  const wallet = new Wallet(authority);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  const program = new Program(idl as any, provider);

  const [issuerPda] = findIssuerPda(authority.publicKey);

  const txSig = await program.methods
    .registerIssuer(
      Array.from(roots.merkleRoot),
      Array.from(roots.sanctionsRoot),
      Array.from(roots.jurisdictionRoot),
    )
    .accounts({
      authority: authority.publicKey,
      issuer: issuerPda,
      systemProgram: SystemProgram.programId,
    })
    .signers([authority])
    .rpc();

  return txSig;
}

export async function updateIssuerRoot(
  connection: Connection,
  authority: Keypair,
  roots: IssuerRoots,
): Promise<string> {
  const wallet = new Wallet(authority);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  const program = new Program(idl as any, provider);

  const [issuerPda] = findIssuerPda(authority.publicKey);

  const txSig = await program.methods
    .updateIssuerRoot(
      Array.from(roots.merkleRoot),
      Array.from(roots.sanctionsRoot),
      Array.from(roots.jurisdictionRoot),
    )
    .accounts({
      authority: authority.publicKey,
      issuer: issuerPda,
    })
    .signers([authority])
    .rpc();

  return txSig;
}
