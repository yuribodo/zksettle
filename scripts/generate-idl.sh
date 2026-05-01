#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IDL_SRC="$REPO_ROOT/backend/target/idl/zksettle.json"
TYPES_SRC="$REPO_ROOT/backend/target/types/zksettle.ts"
SDK_IDL_DIR="$REPO_ROOT/sdk/src/idl"

echo "Building Anchor IDL..."
cd "$REPO_ROOT/backend" && anchor build

echo "Copying IDL artifacts to SDK..."
mkdir -p "$SDK_IDL_DIR"
cp "$IDL_SRC" "$SDK_IDL_DIR/zksettle.json"
cp "$TYPES_SRC" "$SDK_IDL_DIR/zksettle.ts"

INSTRUCTION_COUNT=$(python3 -c "import json,sys; print(len(json.load(sys.stdin)['instructions']))" < "$SDK_IDL_DIR/zksettle.json")
echo "IDL has $INSTRUCTION_COUNT instructions"

EXPECTED="${EXPECTED_INSTRUCTION_COUNT:-}"
if [ -n "$EXPECTED" ] && [ "$INSTRUCTION_COUNT" -ne "$EXPECTED" ]; then
  echo "ERROR: expected $EXPECTED instructions, got $INSTRUCTION_COUNT"
  exit 1
fi

echo "Done."
