# Issue #172 — Admin/Operator Role Management Dashboard

**Depends on:** #171 (SDK stablecoin client). Another contributor owns #171.
**Goal:** Ship every UI/UX deliverable for #172 now, behind a thin local
abstraction over the SDK shape declared by #171. When #171 merges, swap
the abstraction's implementation — no UI rewrites.

## Strategy

1. **Local SDK contract first.** Define the stablecoin types and an
   adapter interface inside `frontend/src/lib/stablecoin/` — the source
   of truth until #171 publishes the matching exports. UI hooks and
   components import only from this local module, never from
   `@zksettle/sdk` directly for stablecoin concerns.
2. **Build full UI against the contract.** Role detection, treasury
   overview, admin panel, operator panel, redemption queue, confirmation
   dialog, route, conditional nav, toasts, tests.
3. **Two adapters, one default.**
   - `mockAdapter` — deterministic fixtures; default in dev, test, and
     storybook-like manual smoke. Keeps the page demoable and lets us
     exercise every state (paused, frozen, pending admin, etc.).
   - `sdkAdapter` — placeholder file with `throw new Error("issue #171
     not yet merged")` stubs that satisfy the local interface. **Does
     not import from `@zksettle/sdk`** so `pnpm typecheck` / `pnpm
     build` stay green.
   Selector lives in `lib/stablecoin/config.ts` and reads
   `NEXT_PUBLIC_STABLECOIN_ADAPTER` (`"mock" | "sdk"`, default `"mock"`).
4. **When #171 lands:** rewrite `sdkAdapter` body using the real SDK
   exports (interface already 1:1), set the env to `"sdk"`, drop the
   throw stubs. UI does not move.

## On-chain reference (verified against `backend/programs/stablecoin/`)

- Program ID: `2CdXRSPo6QLfLBJTikmrqmBiWwa1HpuuYJ2Qu6Yy3Liv`
  (`backend/programs/stablecoin/src/lib.rs`).
- Seeds use **hyphens** (`b"treasury"`, `b"mint-authority"`,
  `b"freeze-authority"`, `b"redemption"`, `b"escrow-authority"`) per
  `state/seeds.rs`. Issue #171's prose shows underscores — verify the
  shipped SDK matches the on-chain seeds before flipping the adapter.
- `Treasury` fields (from `state/treasury.rs`): `admin`, `operator`,
  `mint`, `mint_authority_bump`, `freeze_authority_bump`, `bump`,
  `total_minted: u64`, `total_burned: u64`, `decimals: u8`,
  `paused: bool`, `pending_admin: Option<Pubkey>`, `mint_cap: u64`,
  `redemption_nonce: u64`, `escrow_authority_bump`. Local `types.ts`
  mirrors these exactly (camelCase in TS, BN for u64).
- `RedemptionRequest` fields: `holder`, `treasury`, `mint`,
  `token_account`, `amount: u64`, `nonce: u64`, `requested_at: i64`,
  `bump`. Expiry constant: `REDEMPTION_EXPIRY_SECS = 604_800` (7 days).
- All 14 program instructions are covered by the issue. Plan maps each:
  `set_operator`, `propose_admin`, `accept_admin`, `cancel_pending_admin`,
  `update_mint_cap`, `pause`, `unpause`, `freeze_account`, `thaw_account`,
  `mint_tokens`, `approve_redemption`, `cancel_redemption` — plus
  `request_redemption` and `initialize_mint` (out of #172 scope; #171's
  setup script handles `initialize_mint`).

## Files to create

| File | Purpose |
|---|---|
| `frontend/src/lib/stablecoin/types.ts` | `Treasury`, `RedemptionRequest`, `StablecoinRole`, `ActionKind` types — match on-chain layout (BN for u64) |
| `frontend/src/lib/stablecoin/program.ts` | `STABLECOIN_PROGRAM_ID`, env-driven `STABLECOIN_MINT`, decimals, seed constants — mirrors `seeds.rs` literals |
| `frontend/src/lib/stablecoin/adapter.ts` | `StablecoinAdapter` interface + `getStablecoinAdapter()` selector |
| `frontend/src/lib/stablecoin/mock-adapter.ts` | Fixture-backed adapter; covers paused, pending-admin, frozen account, expired redemption states |
| `frontend/src/lib/stablecoin/sdk-adapter.ts` | Shape-conforming `throw` stubs. **No `@zksettle/sdk` imports yet.** |
| `frontend/src/lib/stablecoin/format.ts` | `formatAmount(bn, decimals)`, `formatPubkey(pk)`, `mintCapProgress(treasury)`, `redemptionExpiry(request)` |
| `frontend/src/lib/stablecoin/format.test.ts` | Pure-function unit tests |
| `frontend/src/lib/stablecoin/mock-adapter.test.ts` | Snapshot fixtures shape against `types.ts` |
| `frontend/src/hooks/use-treasury.ts` | TanStack `useQuery`; key `treasuryQueryKey(mint)`; mirrors `use-roots.ts` cadence (30s refetch) |
| `frontend/src/hooks/use-stablecoin-role.ts` | Returns `"admin" \| "operator" \| "both" \| "none"`; returns `"none"` while wallet disconnected or treasury loading |
| `frontend/src/hooks/use-redemption-requests.ts` | List open `RedemptionRequest`s; `useQuery` with `redemptionsQueryKey(mint)` |
| `frontend/src/hooks/use-stablecoin-action.ts` | Generic `useMutation`: builds `Transaction` via adapter, signs+sends with `useWallet().sendTransaction`, surfaces signature + Solscan URL, invalidates `treasuryQueryKey` and `redemptionsQueryKey` on success |
| `frontend/src/hooks/use-nav-items.ts` | Returns the visible `NavItem[]`; consumes `useStablecoinRole` so Sidebar + MobileNavDrawer share one filter |
| `frontend/src/components/dashboard/confirm-action-dialog.tsx` | Reusable `<dialog>` modal: title, body, danger flag, Confirm/Cancel — mirrors `MobileNavDrawer`'s `<dialog>` pattern |
| `frontend/src/components/dashboard/treasury-overview.tsx` | Read-only treasury state (visible to admin + operator) |
| `frontend/src/components/dashboard/admin-controls.tsx` | `set_operator`, `propose_admin` / `accept_admin` / `cancel_pending_admin`, `update_mint_cap`, `pause`/`unpause`, `freeze_account`/`thaw_account` |
| `frontend/src/components/dashboard/operator-controls.tsx` | `mint_tokens` with cap progress bar |
| `frontend/src/components/dashboard/redemption-queue.tsx` | List + `approve_redemption` + `cancel_redemption` (when expired) |
| `frontend/src/components/dashboard/pause-banner.tsx` | Red `StatusPill` banner shown on the admin page when `treasury.paused` |
| `frontend/src/app/dashboard/admin/page.tsx` | Server route renders `<AdminPanels />` client wrapper |
| `frontend/src/app/dashboard/admin/admin-panels.tsx` | `"use client"` wrapper that calls `useStablecoinRole`, returns `null` for `"none"`, otherwise renders the panels |
| `frontend/src/components/dashboard/admin-panels.test.tsx` | Vitest: role gating (`none`/`admin`/`operator`/`both`), confirmation dialog gates submit, mocked adapter + wallet |

## Files to modify

| File | Change |
|---|---|
| `frontend/src/components/dashboard/nav-items.ts` | Add admin item with `requiresStablecoinRole: true` flag on `NavItem` interface; `findNavItem` unchanged |
| `frontend/src/components/dashboard/sidebar.tsx` | Replace static `NAV_ITEMS` import with `useNavItems()` |
| `frontend/src/components/dashboard/mobile-nav-drawer.tsx` | Same — read items from `useNavItems()` |
| `frontend/src/lib/config.ts` | Re-export `STABLECOIN_MINT` and `STABLECOIN_PROGRAM_ID` from `lib/stablecoin/program.ts` for one-stop config import |
| `frontend/src/app/dashboard/dashboard-routes.test.tsx` | Add admin route case: mock adapter to return each role, assert panel visibility |
| `frontend/.env.example` (if present) | Document `NEXT_PUBLIC_STABLECOIN_MINT` and `NEXT_PUBLIC_STABLECOIN_ADAPTER` |

## Conventions to follow (verified against existing code)

- Reads: TanStack Query — copy the pattern from `use-roots.ts`
  (`refetchInterval: 30_000`).
- Writes: `useMutation` with `onSuccess` invalidating
  `treasuryQueryKey` (and `redemptionsQueryKey` for redemption actions).
- Wallet: `useWallet` and `useConnection` from
  `@/hooks/use-wallet-connection`. Send via
  `sendTransaction(tx, connection)` — same shape as
  `use-prove-flow.ts:runStepSubmit`.
- Server Components for routes; `"use client"` for interactive panels.
- **Do not wrap admin route in `<RequireApiKey>`.** Admin actions hit
  RPC, not the issuer-service. `<RequireAuth>` (already in
  `dashboard/layout.tsx`) is sufficient. The role hook hides the page
  for unauthorized wallets.
- Styling: reuse `StatCard`, `StatusPill`, `Button` (`variant="primary"
  | "ghost"`), `Input`, `iconoir-react` icons (`Shield` exists, used
  for nav).
- Toast / status pattern: copy from `IssuerStatusPanel` (`publishToast`
  + `role="status" aria-live="polite"`).
- Confirmation modal: `<dialog>` element with backdrop button — mirror
  `MobileNavDrawer`'s pattern; no portal library needed.
- All destructive actions go through `ConfirmActionDialog` — never raw
  `confirm()`.
- BN values: import from `@coral-xyz/anchor` (already a dep) — same as
  `use-prove-flow.ts`.
- **No new dependencies.** No backend changes. No SDK changes (those
  are #171). Spl-token helpers, if needed for mint/ATA, stay inside the
  SDK adapter post-#171; mock adapter never needs them.

## Implementation order

1. Types + adapter scaffolding (`lib/stablecoin/*`). Zero UI yet.
2. `useTreasury`, `useStablecoinRole`, `useRedemptionRequests`,
   `useStablecoinAction`, `useNavItems`. Wire to `mockAdapter`.
3. `ConfirmActionDialog` (used by every panel).
4. `TreasuryOverview` — validates the read path end-to-end.
5. `AdminControls`, `OperatorControls`, `RedemptionQueue`,
   `PauseBanner`. Each action: build → confirm → submit → toast →
   invalidate.
6. `/dashboard/admin/page.tsx` + `admin-panels.tsx` with role gate.
   Update `nav-items.ts`, `sidebar.tsx`, `mobile-nav-drawer.tsx` via
   `useNavItems`.
7. Tests: `format.test.ts`, `mock-adapter.test.ts`,
   `admin-panels.test.tsx`, extend `dashboard-routes.test.tsx`.
8. Manual smoke: `pnpm dev`, walk every panel via `mockAdapter`, confirm
   sidebar visibility logic for each role state.

## CI gates this PR must pass

| Workflow | Command | Gate |
|---|---|---|
| `build.yml` SonarQube | `pnpm test:coverage` (frontend) | All tests pass; Sonar reports no new bugs/vulns; frontend excluded from coverage thresholds per `sonar-project.properties` |
| `build.yml` SDK | `pnpm --filter @zksettle/sdk build` + `test` | Untouched by this PR; must still pass |
| `e2e.yml` Playwright | `pnpm build` then `pnpm test:e2e` | Build succeeds (typecheck + lint pass implicitly); existing specs untouched |
| Local pre-push | `pnpm typecheck && pnpm lint && pnpm test` (frontend) | Run before pushing |

Risks to watch:
- `sdk-adapter.ts` must not import unresolved exports from
  `@zksettle/sdk` — would break typecheck and `pnpm build`.
- `mock-adapter.ts` BN serialization must round-trip via JSON for
  TanStack devtools. Use BN constructors, not raw numbers.
- New nav item must keep all current Sidebar tests passing (none
  reference admin yet).

## Switch-on checklist (after #171 merges)

1. `pnpm i` to pull updated `@zksettle/sdk` workspace package.
2. **Verify PDA seeds** — write a one-off script or test that derives
   each PDA via the SDK and asserts equality against
   `backend/programs/stablecoin/src/state/seeds.rs` literals (hyphens,
   not underscores). Block the swap if mismatched.
3. Replace `sdk-adapter.ts` body with real SDK calls. Keep the file
   path / interface unchanged.
4. Set `NEXT_PUBLIC_STABLECOIN_MINT` to the deployed devnet mint and
   `NEXT_PUBLIC_STABLECOIN_ADAPTER=sdk` (or default to `sdk` in
   `config.ts`).
5. Delete `mock-adapter.ts` (or keep behind `process.env.NODE_ENV ===
   "test"` for unit tests — mocks remain useful for offline coverage).
6. Integration smoke on devnet:
   - admin wallet → admin panels visible, operator panels visible
     (because role = `both` until `set_operator` runs);
   - operator wallet (after `set_operator`) → only operator panels
     visible;
   - random wallet → admin nav hidden, `/dashboard/admin` route
     returns `null`;
   - each TX produces a Solscan link and refreshes treasury state.
7. Update README / docs (if any link to `/dashboard/admin`).

## Acceptance criteria mapping (from #172)

| Criterion | Delivered by |
|---|---|
| Role detection | `useStablecoinRole` |
| Hidden nav for non-roles | `useNavItems` reading `useStablecoinRole` |
| Treasury overview | `TreasuryOverview` |
| Admin: set operator | `AdminControls` → `set_operator` |
| Admin: propose / cancel / accept admin transfer | `AdminControls` → `propose_admin`, `cancel_pending_admin`, `accept_admin` |
| Admin: update mint cap | `AdminControls` → `update_mint_cap` |
| Admin: pause / unpause | `AdminControls` → `pause`/`unpause` + `PauseBanner` |
| Admin: freeze / thaw | `AdminControls` → `freeze_account`/`thaw_account` |
| Operator: mint with cap | `OperatorControls` → `mint_tokens` |
| Operator: approve / cancel redemption | `RedemptionQueue` → `approve_redemption` / `cancel_redemption` |
| Confirmation on every destructive action | `ConfirmActionDialog` wrapping every write |
| Solscan link + state refresh | `useStablecoinAction` (`onSuccess` invalidates query keys, returns Solscan URL) |
| Paused state visually distinct | `PauseBanner` on the admin page; followup ticket if reviewers want layout-wide propagation |
