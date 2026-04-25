# Dashboard ↔ Backend Integration

Plano de integração da dashboard Next.js (`/dashboard/*`) com os serviços HTTP do backend Rust (`backend/crates/*`).

> **Estado atual**: dashboard 100% mockada (`src/lib/mock-data.ts`). Nenhum cliente HTTP, env var de API, react-query/swr, ou auth instalado.

---

## 1. Inventário de serviços do backend

Três serviços HTTP (Axum). Sem CORS, sem OpenAPI, sem WebSocket/SSE.

| Serviço | Porta | Path | Auth |
|---|---|---|---|
| **api-gateway** | `4000` | `backend/crates/api-gateway` | `Bearer <api_key>` (chaves `zks_…`) |
| **issuer-service** | `3000` | `backend/crates/issuer-service` | leituras públicas; escritas exigem `Bearer <API_TOKEN>` (ou loopback) |
| **indexer** | `3000` | `backend/crates/indexer` | webhook Helius — não consumido pelo browser |

A dashboard fala **somente** com o **api-gateway**. O gateway aplica rate-limit/quota e faz proxy de `/v1/*` para o issuer-service.

### 1.1 api-gateway (porta 4000)

| Método | Path | Auth | Resposta |
|---|---|---|---|
| `GET` | `/health` | — | `{ status, version }` |
| `POST` | `/api-keys` | admin-auth¹ | `{ api_key, tier, owner }` — provisiona key (tier `developer` por padrão) |
| `GET` | `/api-keys` | admin-auth¹ | `{ keys: [{ key_hash, tier, owner, created_at }] }` — ordenado por `created_at` desc |
| `DELETE` | `/api-keys/{key_hash}` | admin-auth¹ | `{ key_hash, deleted }` — `404` se não existir |
| `GET` | `/usage` | `Bearer <api_key>` | `{ tier, monthly_limit, usage: { request_count, period_start, last_request } }` |
| `GET` | `/v1/events` | `Bearer <api_key>` | proxy → indexer. `?cursor`, `?limit` (default 50/max 200), `?from_ts` (incl), `?to_ts` (excl), `?issuer=hex`, `?recipient=hex`. Newest-first. |
| `*` | `/v1/<qualquer>` | `Bearer <api_key>` | proxy → issuer-service (sem prefixo `/v1`); rota `/v1/events*` desviada pra `GATEWAY_INDEXER_URL` quando setada |

¹ **admin-auth**: se `GATEWAY_ADMIN_KEY` está setado, exige `Authorization: Bearer <ADMIN_KEY>`. Se `GATEWAY_ALLOW_OPEN_KEYS=true`, aceita anônimo. Caso contrário, retorna `500` (ops desabilitadas).

Tiers: `developer` (1k/mês, free), `startup` (10k, $49), `growth` (100k, $199), `enterprise` (1M, $499).

### 1.2 issuer-service (acessado via `/v1/*` do gateway)

| Método | Path no gateway | Resposta |
|---|---|---|
| `GET` | `/v1/health` | `{ status }` |
| `GET` | `/v1/roots` | `{ membership_root, sanctions_root, jurisdiction_root, last_publish_slot, wallet_count }` |
| `GET` | `/v1/credentials/{wallet_hex}` | `{ wallet, leaf_index, jurisdiction, issued_at, revoked }` |
| `GET` | `/v1/proofs/membership/{wallet_hex}` | `{ wallet, leaf_index, path[], path_indices[], root }` |
| `GET` | `/v1/proofs/sanctions/{wallet_hex}` | `{ wallet, path[], path_indices[], leaf_value, root }` |
| `POST` | `/v1/credentials` | body `{ wallet, jurisdiction? }` → `{ wallet, leaf_index, jurisdiction }` |
| `POST` | `/v1/wallets` | body `{ wallet }` → `{ wallet, message }` |
| `DELETE` | `/v1/credentials/{wallet_hex}` | `{ wallet, revoked }` |
| `POST` | `/v1/roots/publish` | `{ slot, registered }` |

`wallet_hex` = 32 bytes em hex (64 chars). Códigos de erro relevantes: `400` hex inválido, `404` wallet não encontrada, `409` duplicada, `429` quota/rate limit, `502` upstream Solana RPC.

---

## 2. Lacuna entre backend e dashboard

A dashboard foi desenhada para um modelo "compliance ops" com transações, audit log, issuers, billing histórico, equipe, políticas. O backend hoje só expõe primitivos de credencial/prova/quota. Mapeamento real:

| Página (`src/app/dashboard/*`) | Hoje (mock) | Endpoint backend disponível? |
|---|---|---|
| `/transactions` | feed de 100 tx + ticker via `generateLiveEvent` | ❌ **não existe** endpoint de transações no backend |
| `/audit-log` | 260 eventos paginados | ✅ `GET /v1/events` (proxy via gateway, cursor pagination) — ainda sem filtros server-side |
| `/billing` | 30d de uso + invoices + tier | ⚠️ **parcial**: `GET /usage` cobre tier+contagem do mês corrente; sem série temporal nem invoices |
| `/counterparties` | 6 issuers (Persona, Sumsub, …) | ❌ **não existe** endpoint de issuers; conceito mais próximo é `/v1/credentials/{wallet}` (1 por wallet) |
| `/api-keys` | stub | ✅ `POST /api-keys` (provisão), `GET /api-keys` (listar), `DELETE /api-keys/{key_hash}` (revogar) |
| `/attestations` | stub | parcial: `/v1/roots` + `/v1/proofs/*` |
| `/policies` | stub | ❌ não existe |
| `/team` | stub | ❌ não existe |

**Recomendação**: começar pelas páginas onde já dá para fechar a integração ponta-a-ponta hoje, e abrir issues no backend para o resto. Veja §6.

---

## 3. Setup do frontend

### 3.1 Dependências a instalar

```bash
pnpm add @tanstack/react-query zod
pnpm add -D @tanstack/react-query-devtools
```

- `@tanstack/react-query` — cache, dedup, refetch, loading/error states (substitui qualquer `useEffect` + `setState` manual).
- `zod` — validar respostas no boundary (o backend não tem OpenAPI, então o contrato é definido aqui).
- Não precisa de `axios`. Usar `fetch` nativo dentro do client wrapper.

### 3.2 Variáveis de ambiente

Criar `.env.local` (e commitar `.env.example`):

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
NEXT_PUBLIC_API_KEY=zks_dev_xxxxxxxxxxxxxxxx
```

Notas:
- Botar a chave em `NEXT_PUBLIC_*` **só serve para dev local** (a chave fica visível no bundle). Para produção, ou (a) cada usuário cola a própria chave numa tela de settings (armazenada em cookie HttpOnly via Route Handler), ou (b) a dashboard chama Route Handlers do Next que injetam a chave server-side.
- Backend roda em `:4000` por padrão (`GATEWAY_PORT`). O issuer-service em `:3000` é interno — **não chamar direto**.

### 3.3 CORS (bloqueador)

O api-gateway não tem `tower_http::cors::CorsLayer`. Browser vai falhar com CORS error em produção. **Antes** de integrar, abrir issue no backend para adicionar:

```rust
// backend/crates/api-gateway/src/main.rs
.layer(CorsLayer::new()
    .allow_origin(["https://app.zksettle.io".parse()?, "http://localhost:3001".parse()?])
    .allow_methods([Method::GET, Method::POST, Method::DELETE])
    .allow_headers([AUTHORIZATION, CONTENT_TYPE]))
```

Workaround temporário em dev: usar Next Route Handlers (`src/app/api/proxy/[...path]/route.ts`) como reverse proxy — mata CORS e esconde a API key do bundle.

---

## 4. Arquivos a criar no frontend

### 4.1 `src/lib/config.ts`

```ts
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export const API_KEY = process.env.NEXT_PUBLIC_API_KEY ?? "";
```

### 4.2 `src/lib/api/client.ts`

Wrapper `fetch` com auth + error parsing. Sem retry (deixa pro react-query).

```ts
import { API_BASE_URL, API_KEY } from "../config";

export class ApiError extends Error {
  constructor(public status: number, public body: unknown, message: string) {
    super(message);
  }
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
      ...init.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body, `${res.status} on ${path}`);
  }
  return res.json() as Promise<T>;
}
```

### 4.3 `src/lib/api/schemas.ts`

Schemas Zod **espelhando** o backend (sem TS-só, validar em runtime):

```ts
import { z } from "zod";

export const TierSchema = z.enum(["developer", "startup", "growth", "enterprise"]);

export const UsageSchema = z.object({
  tier: TierSchema,
  monthly_limit: z.number().int().nonnegative(),
  usage: z.object({
    request_count: z.number().int().nonnegative(),
    period_start: z.number().int(),
    last_request: z.number().int(),
  }),
});
export type Usage = z.infer<typeof UsageSchema>;

export const RootsSchema = z.object({
  membership_root: z.string(),
  sanctions_root: z.string(),
  jurisdiction_root: z.string(),
  last_publish_slot: z.number().int(),
  wallet_count: z.number().int().nonnegative(),
});
export type Roots = z.infer<typeof RootsSchema>;

export const CredentialSchema = z.object({
  wallet: z.array(z.number()).length(32), // [u8; 32]
  leaf_index: z.number().int().nonnegative(),
  jurisdiction: z.string(),
  issued_at: z.number().int(),
  revoked: z.boolean(),
});
export type Credential = z.infer<typeof CredentialSchema>;

export const MembershipProofSchema = z.object({
  wallet: z.string(),
  leaf_index: z.number().int().nonnegative(),
  path: z.array(z.string()),
  path_indices: z.array(z.number().int()),
  root: z.string(),
});

export const SanctionsProofSchema = z.object({
  wallet: z.string(),
  path: z.array(z.string()),
  path_indices: z.array(z.number().int()),
  leaf_value: z.string(),
  root: z.string(),
});

export const ApiKeyResponseSchema = z.object({
  api_key: z.string(),
  tier: TierSchema,
  owner: z.string(),
});
```

### 4.4 `src/lib/api/endpoints.ts`

Funções tipadas, uma por endpoint. **Sem** lógica de cache aqui.

```ts
import { apiFetch } from "./client";
import {
  UsageSchema, RootsSchema, CredentialSchema,
  MembershipProofSchema, SanctionsProofSchema, ApiKeyResponseSchema,
} from "./schemas";

export const getUsage = async () =>
  UsageSchema.parse(await apiFetch("/usage"));

export const getRoots = async () =>
  RootsSchema.parse(await apiFetch("/v1/roots"));

export const getCredential = async (wallet: string) =>
  CredentialSchema.parse(await apiFetch(`/v1/credentials/${wallet}`));

export const getMembershipProof = async (wallet: string) =>
  MembershipProofSchema.parse(await apiFetch(`/v1/proofs/membership/${wallet}`));

export const getSanctionsProof = async (wallet: string) =>
  SanctionsProofSchema.parse(await apiFetch(`/v1/proofs/sanctions/${wallet}`));

export const issueCredential = (body: { wallet: string; jurisdiction?: string }) =>
  apiFetch("/v1/credentials", { method: "POST", body: JSON.stringify(body) });

export const revokeCredential = (wallet: string) =>
  apiFetch(`/v1/credentials/${wallet}`, { method: "DELETE" });

export const publishRoots = () =>
  apiFetch("/v1/roots/publish", { method: "POST" });

export const createApiKey = (owner: string) =>
  ApiKeyResponseSchema.parse(
    await apiFetch("/api-keys", { method: "POST", body: JSON.stringify({ owner }) }),
  );
```

### 4.5 `src/lib/api/query-client.ts` + Provider

```ts
// src/lib/api/query-client.ts
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (count, err) => {
        if (err instanceof Error && "status" in err) {
          const s = (err as { status: number }).status;
          if (s === 401 || s === 403 || s === 404) return false;
        }
        return count < 2;
      },
    },
  },
});
```

```tsx
// src/app/providers.tsx (novo)
"use client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/api/query-client";

export function Providers({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
```

Embrulhar em `src/app/layout.tsx`:

```tsx
<body>...<Providers>{children}</Providers>...</body>
```

### 4.6 `src/hooks/use-*` — hooks por recurso

Um por endpoint, finos:

```ts
// src/hooks/use-usage.ts
import { useQuery } from "@tanstack/react-query";
import { getUsage } from "@/lib/api/endpoints";

export const useUsage = () =>
  useQuery({ queryKey: ["usage"], queryFn: getUsage });
```

Mesmo padrão para `useRoots`, `useCredential(wallet)`, `useMembershipProof(wallet)`, etc.

---

## 5. Plano de integração página por página

### 5.1 ✅ Integrada — `/dashboard/billing`

**Wire**: `useUsage()` (`GET /usage` — tier, limite, contagem do mês) e `useUsageHistory(30)` (`GET /usage/history?days=30` — série diária zero-filled, alimenta o `BillingUsageChart`). Ainda mockado: lista de invoices (aguardando `GET /invoices`).

### 5.2 ✅ Integrada — `/dashboard/api-keys`

**Wire**: `useApiKeys()` (`GET /api-keys`), `useCreateApiKey()` (`POST /api-keys`), `useDeleteApiKey(key_hash)` (`DELETE /api-keys/{key_hash}`). Modal mostra a `zks_…` uma única vez no create. Prefixo é mapeado pra `key_hash` localmente via SHA-256 (`crypto.subtle`) só pra exibir prefixos amigáveis no listing — backend só guarda hash.

### 5.3 ⚠️ Reescopar — `/dashboard/transactions`

A dashboard mostra "transações stablecoin verificadas". O backend não emite isso. Duas opções:

**Opção A — pivotar a página**: trocar "Transactions" por "Wallets & Credentials". Lista de wallets credenciadas + `useCredential(wallet)` na seleção. Usa `GET /v1/credentials/{wallet}`. Live feed sai.

**Opção B — manter mock e abrir issue**: deixar `mock-data.ts` por trás de uma flag `NEXT_PUBLIC_USE_MOCKS=true` enquanto o indexer não expor um endpoint `GET /transactions`.

Recomendação: **Opção A** para o MVP. Live feed real depende de WS/SSE no indexer, que não existe.

### 5.4 ✅ Integrada — `/dashboard/audit-log`

**Wire**: `useEvents(20, { fromTs?, toTs?, issuer?, recipient? })` (`useInfiniteQuery` de `GET /v1/events`). O indexer persiste cada `ProofSettled` parsed num `EventStore` RocksDB local (`INDEXER_EVENTS_PATH`, default `./data/events`), com chave composta `slot_be:signature` pra ordenação cronológica. O gateway proxia `/v1/events*` pro indexer via `GATEWAY_INDEXER_URL`.

Filtros server-side: range (24h/7d/30d/all → `from_ts`), issuer hex e recipient hex. Inputs hex validados client-side e commitados no blur/Enter (sem refetch a cada keystroke). CSV/JSON export segue como toast (não wired). Status pill é sempre `Verified` porque a chain só emite eventos para proofs que verificaram com sucesso (jurisdiction está no merkle root, não disponível como string).

### 5.5 ⚠️ Reescopar — `/dashboard/counterparties`

"Issuers" no mock são serviços de KYC (Persona/Sumsub/…). No backend só existe **um** issuer (o próprio serviço). Dois caminhos:

- Trocar a página por "Issuer Status": mostrar `useRoots()` (membership/sanctions/jurisdiction roots, `last_publish_slot`, `wallet_count`) + botão "Publish roots" (`publishRoots()`).
- Manter como está e tratar "issuers externos" como conceito futuro do backend.

### 5.6 ❌ Bloqueado — `/policies`, `/team`, `/attestations`

Sem endpoints. Manter stubs. Abrir issues por feature.

---

## 6. Issues a abrir no backend

Pré-requisitos para fechar a dashboard:

1. ✅ **CORS layer no api-gateway** — `GATEWAY_CORS_ALLOWED_ORIGINS` (allowlist por vírgula).
2. ✅ **`GET /usage/history?days=N`** no api-gateway — série diária zero-filled, oldest-first.
3. **`GET /invoices`** no api-gateway — necessário pra tabela de invoices em `/billing`. Aguardando decisão de produto (Stripe? Postgres?).
4. ✅ **`GET /api-keys`** + **`DELETE /api-keys/{key_hash}`** no api-gateway.
5. ✅ **`GET /events`** no indexer (RocksDB local em `INDEXER_EVENTS_PATH`) + roteamento `/v1/events*` pro indexer no gateway via `GATEWAY_INDEXER_URL`.
6. ✅ **Filtros server-side em `GET /events`** — `from_ts` (incl) / `to_ts` (excl) / `issuer` / `recipient`.
7. **WebSocket ou SSE** no indexer para live feed — opcional; pode começar com polling.
8. **OpenAPI** (utoipa ou aide) — gerar tipos no frontend automaticamente em vez de manter Zod schemas à mão.
9. **Secondary indexes para `/events`** — hoje filtros são post-deserialize scan. Para filtros muito seletivos com milhões de eventos, criar índices `issuer→keys` e `recipient→keys` no RocksDB.

---

## 7. Auth & wallet — fora de escopo no MVP

A dashboard hoje não tem login. O backend só conhece `Bearer <api_key>`. Fluxo proposto para depois do MVP de integração:

1. Usuário conecta wallet Solana (Phantom/Solflare via `@solana/wallet-adapter-react`).
2. Tela "Settings" → cola a `api_key` provisionada via `POST /api-keys`.
3. Key vai para cookie HttpOnly via Route Handler `src/app/api/auth/route.ts`.
4. Todas as chamadas passam por `src/app/api/proxy/[...path]/route.ts` que injeta o `Authorization` server-side.

Esse desenho mata o problema de expor key no bundle e o problema de CORS de uma vez só.

---

## 8. Ordem sugerida de PRs

1. ✅ Setup: deps + `config.ts` + `client.ts` + `schemas.ts` + `endpoints.ts` + `Providers` no layout.
2. ✅ Wire `/dashboard/billing` em `useUsage()` + `useUsageHistory(30)` (gráfico real; invoices ainda mock).
3. ✅ Implementar `/dashboard/api-keys` real (form + create + list + revoke).
4. ✅ Pivot `/dashboard/counterparties` → "Issuer Status" usando `useRoots()`.
5. ✅ Pivot `/dashboard/transactions` → "Wallets & Credentials".
6. ✅ Wire `/dashboard/audit-log` em `useEvents(limit, filters)` — cursor pagination + filtros server-side (range, issuer, recipient).
7. Aguardando §6.3 (invoices) — único bloqueio é decisão de produto.
