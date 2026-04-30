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

# Transfer hook smoke tests
test-hook:
    cd backend && cargo test --features light-tests --test transfer_hook_smoke -- --nocapture

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

# Indexer unit tests
test-indexer:
    cd backend && cargo test -p indexer --lib

# Run indexer (needs INDEXER_ env vars)
run-indexer:
    cd backend && cargo run -p indexer

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

# ── Anchor ─────────────────────────────────────────────────────────

# Anchor build (binary only, no IDL regen)
anchor-build:
    cd backend && anchor build --no-idl

# Anchor build with IDL regeneration
anchor-build-idl:
    cd backend && anchor build

# Anchor deploy to devnet
anchor-deploy:
    cd backend && anchor deploy --provider.cluster devnet --program-name zksettle

# Anchor deploy to localnet
anchor-deploy-local:
    cd backend && anchor deploy --provider.cluster localnet --program-name zksettle

# ── Circuit ─────────────────────────────────────────────────────────

# Compile Noir circuit
circuit-build:
    cd circuits && nargo compile

# Run circuit tests
circuit-test:
    cd circuits && nargo test

# Generate gnark proof fixture from compiled circuit
circuit-fixture:
    ./scripts/generate-fixture.sh

# Full circuit pipeline: compile → fixture
circuit-all: circuit-build circuit-fixture

# ── Docker ─────────────────────────────────────────────────────────

# Start all services
up:
    docker compose up -d

# Start all services with rebuild
up-build:
    docker compose up -d --build

# Stop all services
down:
    docker compose down

# Stop and remove volumes
down-clean:
    docker compose down -v

# Show service logs (all or specific service)
logs *service:
    docker compose logs -f {{service}}

# Show running services
ps:
    docker compose ps

# Start only postgres
db:
    docker compose up -d postgres

# Postgres shell
db-shell:
    docker compose exec postgres psql -U zksettle zksettle_gateway

# Restart a specific service
restart service:
    docker compose restart {{service}}

# ── Devnet ─────────────────────────────────────────────────────────

# Run devnet hook setup script
devnet-setup:
    cd scripts/devnet-hook && npx ts-node setup.ts

# Install devnet script deps
devnet-install:
    cd scripts/devnet-hook && npm install

# ── Setup ───────────────────────────────────────────────────────────

# Install dev tooling
setup:
    cargo install just cargo-mutants
    @echo "Done. Run 'just' to see available recipes."
