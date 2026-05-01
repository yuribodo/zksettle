#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CIRCUIT_DIR="$REPO_ROOT/circuits"
FIXTURE_DIR="$REPO_ROOT/backend/tests/fixtures"

cd "$CIRCUIT_DIR"

echo "Compiling circuit…"
nargo compile

echo "Compiling ACIR → CCS…"
sunspot compile target/zksettle_slice.json

echo "Generating proving/verifying keys…"
sunspot setup target/zksettle_slice.ccs

echo "Generating proof…"
sunspot prove target/zksettle_slice.json target/zksettle_slice.gz \
  target/zksettle_slice.ccs target/zksettle_slice.pk

mkdir -p "$FIXTURE_DIR"
cat target/zksettle_slice.proof target/zksettle_slice.pw \
  > "$FIXTURE_DIR/proof_and_witness.bin"

echo "Fixture written to backend/tests/fixtures/proof_and_witness.bin ($(wc -c < "$FIXTURE_DIR/proof_and_witness.bin") bytes)"

if [ -f target/zksettle_slice.vk ]; then
  cp target/zksettle_slice.vk "$REPO_ROOT/backend/programs/zksettle/default.vk"
  echo "VK copied to backend/programs/zksettle/default.vk"
fi
