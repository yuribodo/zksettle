# Compiled circuit artifacts

This directory ships the **Noir ACIR JSON** that the browser-side prover loads
at runtime to generate Groth16 proofs locally. Committing the artifact lets
contributors run the frontend without having `nargo` installed.

## Files

| File | Source | Purpose |
|---|---|---|
| `zksettle_slice.json` | `circuits/target/zksettle_slice.json` | Compiled ACIR + ABI consumed by `@noir-lang/noir_js` and the Barretenberg backend |

## Regenerating

The artifact is committed but not auto-generated. After any change to
`circuits/src/main.nr` you must regenerate it:

```bash
just circuit-publish
# equivalent to: ./scripts/compile-circuit.sh
```

The script:

1. Verifies `nargo` is on `PATH` and at the pinned version (`1.0.0-beta.18`).
2. Runs `nargo compile` in `circuits/`.
3. Copies the artifact here.
4. Asserts the ABI exposes exactly **11 public inputs** — the layout in
   `circuits/src/main.nr` and `backend/programs/zksettle/src/state/pubinputs.rs`
   is load-bearing, and a count drift means one of the two has been edited
   without the other.

## Public-input layout

The order is fixed and shared between the circuit, the on-chain verifier, and
the browser prover. See `circuits/src/main.nr` for the source of truth.

| Index | Field |
|------:|---|
| 0 | `merkle_root` |
| 1 | `nullifier` |
| 2 | `mint_lo` |
| 3 | `mint_hi` |
| 4 | `epoch` |
| 5 | `recipient_lo` |
| 6 | `recipient_hi` |
| 7 | `amount` |
| 8 | `sanctions_root` |
| 9 | `jurisdiction_root` |
| 10 | `timestamp` |

## Notes

- The on-chain verifying key (`backend/programs/zksettle/default.vk`) currently
  binds only indices 0–7 — see `IMPLEMENTATION_STATUS.md` §2.1. Proofs generated
  here will succeed in the browser, but the on-chain `verify_proof` instruction
  will not yet enforce indices 8–10 until the VK is regenerated through the
  Sunspot pipeline.
- The artifact contains `debug_symbols` and a `file_map` which are useful for
  in-browser error messages but inflate the payload (~76 KB → ~30 KB without
  them). If bundle size becomes a concern we can strip them at copy time.
