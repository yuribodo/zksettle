# E2E Testing Design — ZKSettle

**Date:** 2026-05-02
**Status:** Approved

## Goal

Test the integration between the Next.js frontend and the Rust/Axum backend by running Playwright browser tests against the real stack (docker-compose services + built frontend). Ensure all dashboard flows work correctly end-to-end and catch regressions before the Colosseum Frontier deadline (2026-05-11).

## Architecture

```text
docker-compose up (postgres + api-gateway only)
        ↓
pnpm build && pnpm start (Next.js at localhost:3000)
        ↓
playwright test (browser opens localhost:3000, navigates dashboard)
        ↓
frontend fetches → api-gateway:4000 (issuer/indexer not started)
        ↓
playwright validates data renders correctly in the UI
```

## Stack

- **Framework:** Playwright (browser-based E2E)
- **Browser:** Chromium only (sufficient for integration validation)
- **Backend:** api-gateway via docker-compose (no mocks); issuer-service and indexer intentionally omitted
- **Database:** PostgreSQL (credentials via environment variables)

## File Structure

```text
frontend/
  e2e/
    health.spec.ts
    api-keys.spec.ts
    credentials.spec.ts
    proofs.spec.ts
    events.spec.ts
    usage.spec.ts
  playwright.config.ts
```

## Test Flows

### health.spec.ts
- Open dashboard, verify page loads without errors
- Validate frontend can communicate with api-gateway (status indicator or data loading)

### api-keys.spec.ts
- Navigate to `/dashboard/api-keys`
- Create a new API key, validate it appears in the list
- Delete the key, validate it disappears from the list

### credentials.spec.ts
- Navigate to relevant dashboard page
- Issue a credential for a mock wallet
- Validate the credential appears in the UI
- Revoke the credential, validate updated status

### proofs.spec.ts
- Navigate to attestations page
- Request membership proof for a wallet
- Request sanctions proof
- Validate results render correctly

### events.spec.ts
- Navigate to `/dashboard/audit-log`
- Validate events load in the table
- Test filters (by issuer, by date)
- Test pagination (next/previous)

### usage.spec.ts
- Navigate to `/dashboard/billing`
- Validate usage cards load with data
- Validate history chart renders

## Playwright Configuration

- `baseURL`: `http://localhost:3000`
- `webServer`: runs `pnpm start` on port 3000 before tests
- Timeout: 30s per test
- Retries: 1 in CI, 0 locally
- Screenshots on failure
- HTML reporter

## CI Integration

**New workflow: `.github/workflows/e2e.yml`**

- **Trigger:** push to `dev` + pull requests (same as existing build.yml)
- **Steps:**
  1. Checkout
  2. `docker-compose up -d` (postgres + api-gateway)
  3. Wait for health check (`curl` api-gateway:4000/health)
  4. Setup Node.js + pnpm
  5. `pnpm install` + `pnpm exec playwright install --with-deps chromium`
  6. `pnpm build` (frontend)
  7. `pnpm test:e2e`
  8. Upload Playwright report as artifact

**Environment variables in CI:**
- `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000`
- `NEXT_PUBLIC_SOLANA_NETWORK=devnet`
- `POSTGRES_PASSWORD` via GitHub secret `E2E_POSTGRES_PASSWORD` (fallback for CI without secret configured)

## Design Decisions

- **Playwright over Cypress:** Better CI support, native auto-wait, lighter, no dashboard paywall.
- **Real backend (no mocks):** The goal is to validate front-back integration. Mocks would defeat the purpose.
- **Chromium only:** Multi-browser testing adds CI time without value for integration tests.
- **Tests inside frontend/:** Playwright opens the Next.js app, so it belongs in the frontend package.
- **Independent tests:** Each spec file is self-contained, no shared state between tests.
