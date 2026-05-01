import idl from "./idl/zksettle.json";
export { idl };
export type { Zksettle } from "./idl/zksettle";

import { PublicKey } from "@solana/web3.js";

export const ZKSETTLE_PROGRAM_ID = new PublicKey(idl.address);
