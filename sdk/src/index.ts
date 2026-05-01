export { default as idl } from "./idl/zksettle.json";
export type { Zksettle } from "./idl/zksettle";

import { PublicKey } from "@solana/web3.js";

export const ZKSETTLE_PROGRAM_ID = new PublicKey(
  "AyZk4CYFAFFJiFC2WqqXY2oq2pgN6vvrWwYbbWz7z7Jo"
);
