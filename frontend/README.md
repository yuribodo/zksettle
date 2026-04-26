# ZKSettle Frontend

Editorial marketing landing and read-only compliance dashboard for ZKSettle — Colosseum Frontier 2026.

## Stack

- Next.js 15 (App Router, Turbopack)
- React 19
- TypeScript (strict)
- Tailwind CSS v4
- pnpm 9

See `../docs/superpowers/specs/2026-04-18-zksettle-landing-design.md` for the canonical design system and `../docs/superpowers/plans/2026-04-18-zksettle-landing.md` for the implementation plan.

## Getting started

```bash
pnpm install
pnpm dev
```

The dev server runs on http://localhost:3000.

## Scripts

| Script | Description |
| --- | --- |
| `pnpm dev` | Start the Turbopack dev server |
| `pnpm build` | Production build |
| `pnpm start` | Serve the production build |
| `pnpm typecheck` | Run `tsc --noEmit` |
| `pnpm lint` | Run Next's ESLint pipeline |
| `pnpm test` | Run the Vitest suite once |
| `pnpm test:watch` | Vitest in watch mode |

## Requirements

- Node.js >= 20.10
- pnpm 9
