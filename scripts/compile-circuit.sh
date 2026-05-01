#!/usr/bin/env bash
set -euo pipefail

# Compile the Noir compliance circuit and copy the artifact into the frontend's
# public/circuits directory so the browser-side prover can fetch it at runtime.
#
# Mirrors scripts/generate-idl.sh — same regenerate-and-commit workflow used for
# the Anchor IDL.

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CIRCUIT_DIR="$REPO_ROOT/circuits"
ARTIFACT_SRC="$CIRCUIT_DIR/target/zksettle_slice.json"
FRONTEND_DST_DIR="$REPO_ROOT/frontend/public/circuits"
FRONTEND_DST="$FRONTEND_DST_DIR/zksettle_slice.json"

EXPECTED_NARGO_VERSION="1.0.0-beta.18"
EXPECTED_PUBLIC_INPUTS=11

if ! command -v nargo >/dev/null 2>&1; then
  echo "ERROR: nargo not found on PATH. Install via:"
  echo "  curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash"
  echo "  noirup -v $EXPECTED_NARGO_VERSION"
  exit 1
fi

INSTALLED_VERSION=$(nargo --version | awk '/nargo version/ {print $4}')
if [ "$INSTALLED_VERSION" != "$EXPECTED_NARGO_VERSION" ]; then
  echo "WARNING: nargo $INSTALLED_VERSION installed, circuits/Nargo.toml pins $EXPECTED_NARGO_VERSION (Sunspot-supported)."
  echo "         Re-pin with: noirup -v $EXPECTED_NARGO_VERSION"
fi

echo "Compiling Noir circuit..."
cd "$CIRCUIT_DIR" && nargo compile

PUBLIC_INPUT_COUNT=$(python3 -c "
import json, sys
abi = json.load(sys.stdin)['abi']
print(sum(1 for p in abi['parameters'] if p['visibility'] == 'public'))
" < "$ARTIFACT_SRC")

echo "Artifact has $PUBLIC_INPUT_COUNT public inputs"

if [ "$PUBLIC_INPUT_COUNT" -ne "$EXPECTED_PUBLIC_INPUTS" ]; then
  echo "ERROR: expected $EXPECTED_PUBLIC_INPUTS public inputs, got $PUBLIC_INPUT_COUNT"
  echo "       Public-input layout is load-bearing — see circuits/src/main.nr"
  echo "       and backend/programs/zksettle/src/state/pubinputs.rs"
  echo "       Refusing to publish a stale artifact to $FRONTEND_DST"
  exit 1
fi

echo "Copying artifact to frontend/public/circuits/..."
mkdir -p "$FRONTEND_DST_DIR"
cp "$ARTIFACT_SRC" "$FRONTEND_DST"

echo "Done. Artifact at: ${FRONTEND_DST#$REPO_ROOT/}"
