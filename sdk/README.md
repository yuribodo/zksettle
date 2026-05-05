# @zksettle/sdk

TypeScript SDK for ZKSettle — zero-knowledge compliance proofs on Solana Token-2022.

## Installation

```bash
pnpm add @zksettle/sdk
```

## Usage

### Generate a compliance proof

```typescript
import { prove } from "@zksettle/sdk";

// Low-level: provide all inputs directly
const result = await prove(proofInputs, {
  circuitSource: "./circuits/zksettle_slice.json",
});

// High-level: auto-fetch Merkle paths from issuer service
const result = await prove(walletHex, { mint, recipient, amount }, {
  issuerServiceUrl: "https://api.zksettle.io",
  circuitSource: "./circuits/zksettle_slice.json",
});

console.log(result.proof);        // Uint8Array
console.log(result.publicInputs); // string[]
console.log(result.durationMs);   // number
```

### Wrap proof into a transaction

```typescript
import { wrap } from "@zksettle/sdk";
import { Connection, PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";

const tx = await wrap({
  connection: new Connection("https://api.devnet.solana.com"),
  wallet: authorityPublicKey,
  proof: result.proof,
  nullifierHash: new Uint8Array(32),
  transferContext: {
    mint: new PublicKey("..."),
    recipient: new PublicKey("..."),
    amount: new BN(1000),
  },
});
// Sign and send tx with your wallet
```

### Audit a settlement

```typescript
import { audit } from "@zksettle/sdk";

const trail = await audit(connection, txSignature);
console.log(trail.issuer.toBase58());
console.log(trail.amount);    // bigint
console.log(trail.recipient.toBase58());
```

### Publish issuer roots on-chain

```typescript
import { registerIssuer, updateIssuerRoot } from "@zksettle/sdk";

// First time: register
await registerIssuer(connection, authorityKeypair, {
  merkleRoot: new Uint8Array(32),
  sanctionsRoot: new Uint8Array(32),
  jurisdictionRoot: new Uint8Array(32),
});

// Subsequent updates
await updateIssuerRoot(connection, authorityKeypair, roots);
```

### Query the issuer service

```typescript
import { IssuerClient } from "@zksettle/sdk";

const client = new IssuerClient("https://api.zksettle.io", optionalToken);
const roots = await client.getRoots();
const membership = await client.getMembershipProof(walletHex);
const sanctions = await client.getSanctionsProof(walletHex);
```

## Environment Support

Works in both Node.js (>=18) and modern browsers. The `circuitSource` config accepts:
- A file path (Node.js)
- A URL string (browser or Node.js)
- A `Uint8Array` of the JSON artifact
- A pre-parsed `CompiledCircuit` object

## Program ID

```
AyZk4CYFAFFJiFC2WqqXY2oq2pgN6vvrWwYbbWz7z7Jo
```
