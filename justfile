# ZKSettle task runner
# Install just: cargo install just
# Install cargo-mutants: cargo install cargo-mutants

set dotenv-load

# Default: list recipes
default:
    @just --list

# ── Tests ───────────────────────────────────────────────────────────

# Unit tests (no external deps needed)
test:
    cd backend && cargo test --lib

# Unit tests with output
test-verbose:
    cd backend && cargo test --lib -- --nocapture

# Integration tests (needs Light prover server running)
test-integration:
    cd backend && cargo test --features light-tests -- --nocapture

# All tests including ignored
test-all:
    cd backend && cargo test --features light-tests -- --nocapture --include-ignored

# Run specific test by name
test-one name:
    cd backend && cargo test --lib {{name}} -- --nocapture

# ── Mutation Testing ────────────────────────────────────────────────

# Mutation tests on well-covered modules only
mutants:
    cd backend && cargo mutants -p zksettle -- --lib

# Mutation tests scoped to specific file
mutants-file path:
    cd backend && cargo mutants -f {{path}} -- --lib

# Mutation tests dry-run (list mutants without running)
mutants-list:
    cd backend && cargo mutants -p zksettle --list

# ── Build & Check ──────────────────────────────────────────────────

# Type-check without building
check:
    cd backend && cargo check

# Full build
build:
    cd backend && cargo build-sbf

# Clippy lints
lint:
    cd backend && cargo clippy --lib --tests -- -D warnings

# Format check
fmt-check:
    cd backend && cargo fmt -- --check

# Format fix
fmt:
    cd backend && cargo fmt

# ── Circuit ─────────────────────────────────────────────────────────

# Compile Noir circuit
circuit-build:
    cd circuits && nargo compile

# Run circuit tests
circuit-test:
    cd circuits && nargo test

# ── Setup ───────────────────────────────────────────────────────────

# Install dev tooling
setup:
    cargo install just cargo-mutants
    @echo "Done. Run 'just' to see available recipes."
