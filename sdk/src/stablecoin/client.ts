import { type Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { STABLECOIN_PROGRAM_ID } from "./constants.js";
import { findTreasuryPda, findRedemptionPda } from "./pda.js";
import { decodeTreasury, decodeRedemptionRequest, type Treasury, type RedemptionRequest } from "./accounts.js";
import {
  buildMintTokensIx,
  buildRequestRedemptionIx,
  buildApproveRedemptionIx,
  buildCancelRedemptionIx,
  buildFreezeAccountIx,
  buildThawAccountIx,
  buildPauseIx,
  buildUnpauseIx,
  buildProposeAdminIx,
  buildAcceptAdminIx,
  buildCancelPendingAdminIx,
  buildSetOperatorIx,
  buildUpdateMintCapIx,
} from "./instructions.js";

export class StablecoinClient {
  readonly connection: Connection;
  readonly mint: PublicKey;
  readonly programId: PublicKey;
  readonly treasuryAddress: PublicKey;

  constructor(
    connection: Connection,
    mint: PublicKey,
    programId = STABLECOIN_PROGRAM_ID,
  ) {
    this.connection = connection;
    this.mint = mint;
    this.programId = programId;
    [this.treasuryAddress] = findTreasuryPda(mint, programId);
  }

  async fetchTreasury(): Promise<Treasury> {
    const info = await this.connection.getAccountInfo(this.treasuryAddress);
    if (!info) throw new Error("Treasury account not found");
    return decodeTreasury(info.data);
  }

  async fetchRedemptionRequest(
    holder: PublicKey,
    nonce: bigint | number,
  ): Promise<RedemptionRequest | null> {
    const [address] = findRedemptionPda(this.treasuryAddress, holder, nonce, this.programId);
    const info = await this.connection.getAccountInfo(address);
    if (!info) return null;
    return decodeRedemptionRequest(info.data);
  }

  async getTokenBalance(owner: PublicKey): Promise<bigint> {
    const ata = getAssociatedTokenAddressSync(
      this.mint,
      owner,
      false,
      TOKEN_2022_PROGRAM_ID,
    );
    const balance = await this.connection.getTokenAccountBalance(ata);
    return BigInt(balance.value.amount);
  }

  buildMintTokensIx(operator: PublicKey, destination: PublicKey, amount: bigint | number) {
    return buildMintTokensIx(operator, this.mint, destination, amount, this.programId);
  }

  buildRequestRedemptionIx(
    holder: PublicKey,
    holderTokenAccount: PublicKey,
    amount: bigint | number,
    nonce: bigint | number,
  ) {
    return buildRequestRedemptionIx(holder, this.mint, holderTokenAccount, amount, nonce, this.programId);
  }

  async requestRedemption(
    holder: PublicKey,
    holderTokenAccount: PublicKey,
    amount: bigint | number,
  ) {
    const treasury = await this.fetchTreasury();
    return buildRequestRedemptionIx(
      holder, this.mint, holderTokenAccount, amount,
      treasury.redemptionNonce, this.programId,
    );
  }

  buildApproveRedemptionIx(
    operator: PublicKey,
    holder: PublicKey,
    holderTokenAccount: PublicKey,
    nonce: bigint | number,
  ) {
    return buildApproveRedemptionIx(operator, holder, this.mint, holderTokenAccount, nonce, this.programId);
  }

  buildCancelRedemptionIx(
    canceller: PublicKey,
    holder: PublicKey,
    holderTokenAccount: PublicKey,
    nonce: bigint | number,
  ) {
    return buildCancelRedemptionIx(canceller, holder, this.mint, holderTokenAccount, nonce, this.programId);
  }

  buildFreezeAccountIx(admin: PublicKey, targetAccount: PublicKey) {
    return buildFreezeAccountIx(admin, this.mint, targetAccount, this.programId);
  }

  buildThawAccountIx(admin: PublicKey, targetAccount: PublicKey) {
    return buildThawAccountIx(admin, this.mint, targetAccount, this.programId);
  }

  buildPauseIx(admin: PublicKey) {
    return buildPauseIx(admin, this.mint, this.programId);
  }

  buildUnpauseIx(admin: PublicKey) {
    return buildUnpauseIx(admin, this.mint, this.programId);
  }

  buildProposeAdminIx(admin: PublicKey, newAdmin: PublicKey) {
    return buildProposeAdminIx(admin, this.mint, newAdmin, this.programId);
  }

  buildAcceptAdminIx(newAdmin: PublicKey) {
    return buildAcceptAdminIx(newAdmin, this.mint, this.programId);
  }

  buildCancelPendingAdminIx(admin: PublicKey) {
    return buildCancelPendingAdminIx(admin, this.mint, this.programId);
  }

  buildSetOperatorIx(admin: PublicKey, newOperator: PublicKey) {
    return buildSetOperatorIx(admin, this.mint, newOperator, this.programId);
  }

  buildUpdateMintCapIx(admin: PublicKey, newCap: bigint | number) {
    return buildUpdateMintCapIx(admin, this.mint, newCap, this.programId);
  }
}
