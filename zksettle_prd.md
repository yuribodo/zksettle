# ZKSettle — PRD (Product Requirements Document)

**Versão:** 1.0  
**Hackathon:** Colosseum Frontier 2026  
**Deadline:** 11 de maio de 2026  
**Time:** Mario + backend + fullstack (3 pessoas)

---

## 1. Visão e objetivo

ZKSettle é uma API de compliance para stablecoins no Solana que usa zero-knowledge proofs para permitir que fintechs provem conformidade regulatória sem expor dados pessoais dos usuários on-chain.

**Objetivo do MVP:** demonstrar o caso de uso de travel rule compliance com um demo funcional em devnet até 11 de maio de 2026, e convencer os juízes do Colosseum Frontier de que isso vira uma empresa de $100M+.

---

## 2. Problema

O travel rule exige troca de dados de identidade entre instituições financeiras em transferências acima de $1.000. Em blockchains públicas, isso cria um paradoxo insolúvel sem ZK:

- **Revelar os dados on-chain** → viola GDPR, LGPD, e regulações de privacidade
- **Não revelar** → viola GENIUS Act, travel rule, e regulações de compliance

Nenhuma solução ZK de compliance existe nativamente no Solana. Todas as fintechs de stablecoin constroem compliance centralizado próprio, gastando 3–6 meses e $200K–$500K. E mesmo assim os dados ficam em servidores centralizados, sujeitos a breach.

---

## 3. Usuários e segmentos

| Segmento | Dor específica | Disposição a pagar |
|---|---|---|
| Fintechs de stablecoin (BlindPay, SpotPay, Infinite, Karsa) | Compliance do zero, meses de dev, risco regulatório | $0.05/proof · $2K/mês tier Startup |
| Emissores de stablecoin (Circle, Agora) | Travel rule nativo no token sem expor dados | Integration fee + royalty por verificação |
| Protocolos DeFi (Kamino, MarginFi) | Aceitar RWA como colateral sem armazenar KYC | Taxa de integração $10–50K + per-proof |
| Usuários finais (indiretamente) | Privacidade dos dados, portabilidade de credentials | Gas mínimo da proof (<$0.001) |

**ICP (Ideal Customer Profile):** startup de stablecoin payments com 1–5 devs, rodando em Solana, com funding seed+, já sentindo a dor de compliance.

---

## 4. Casos de uso

### UC-01 · Travel rule compliance [MVP — hackathon]

**Fluxo completo:**
1. Usuário faz KYC com issuer (mock no hack, real em produção), recebe credential assinada: `{wallet, jurisdiction, expiry, sanctions_clear}`
2. Issuer adiciona wallet à Merkle tree privada, publica root on-chain via `register_issuer()`
3. Ao transferir USDC-test, usuário gera ZK proof no browser em <10s — nenhum dado sai do dispositivo
4. Usuário submete instrução SPL transfer com proof como extra account
5. Transfer Hook intercepta, verifica Groth16 proof via alt_bn128 syscalls (<250K CUs, <$0.001; ver ADR-022)
6. Transferência aprovada com proof válida, bloqueada sem proof ou com proof inválida
7. `ComplianceAttestation` registrado on-chain como audit trail imutável

### UC-02 · Proof of solvency [Roadmap Q3/26]

Usuário prova que `saldo > threshold` sem revelar saldo exato. Desbloqueador de undercollateralized lending — mercado de $5T que não existe em DeFi por falta dessa primitiva.

### UC-03 · ZK AML compliance [Roadmap Q4/26]

Prova que histórico de transações não contém padrões de lavagem de dinheiro sem expor as transações. Reguladores querem evidência de compliance — não necessariamente identidade.

### UC-04 · Proof of reserves [Roadmap 2027]

Exchange/stablecoin issuer prova cobertura total de saques sem revelar posições individuais, carteiras quentes, ou composição do portfólio.

---

## 5. Requisitos funcionais

| ID | Requisito | Prioridade |
|---|---|---|
| RF-01 | Gerar ZK proof (Groth16 BN254) localmente no browser via WASM em <10s | Crítico |
| RF-02 | Anchor program: `register_issuer()`, `update_issuer_root()`, `verify_proof()`, `check_attestation()` | Crítico |
| RF-03 | Transfer Hook que bloqueia transferência SPL sem ComplianceAttestation válido | Crítico |
| RF-04 | SDK TypeScript: `zksettle.prove()`, `zksettle.wrap()`, `zksettle.audit()` | Crítico |
| RF-05 | Nullifier tracking via Light Protocol para prevenir replay attacks | Crítico |
| RF-06 | Dashboard: live feed de proofs aprovadas e rejeitadas em tempo real | Importante |
| RF-07 | Script de issuer mock: gera credentials + publica Merkle roots periodicamente | Importante |
| RF-08 | Audit trail exportável (CSV + JSON) para compliance regulatório | Nice-to-have |

---

## 6. Requisitos não funcionais

- **Latência de proof generation:** <10 segundos no browser (target: <5s)
- **Custo de verificação on-chain:** <250K compute units, <0.001 SOL por proof (ver ADR-022)
- **Latência E2E:** proof + verificação + settlement <15 segundos total
- **Privacidade:** zero PII transmitido para servidor. Proof gerada 100% client-side.
- **Atomicidade:** Transfer Hook garante que transferência só executa se proof válida — impossível contornar chamando SPL diretamente
- **Anti-replay:** nullifier on-chain garante que uma proof não pode ser usada duas vezes no mesmo contexto

---

## 7. Arquitetura do sistema

### Componente 1 — ZK Compliance Circuit (Noir)

Circuit Noir → Groth16 BN254 → WASM no browser via `@noir-lang/backend_barretenberg`.

O circuit prova simultaneamente:
- **Merkle membership:** wallet está na árvore de usuários verificados do issuer
- **Sanctions exclusion:** hash de identidade NÃO está na Sparse Merkle Tree OFAC/ONU
- **Jurisdiction check:** jurisdição pertence ao conjunto permitido pelo emissor
- **Expiry:** credential não expirou (timestamp válido)
- **Nullifier:** anti-replay, esta proof não foi usada antes neste contexto

**Inputs privados** (nunca saem do dispositivo): wallet address, credential data, Merkle paths (membership, sanctions, jurisdiction), path indices, private key, credential expiry  
**Inputs públicos** (verificáveis on-chain, 11 campos): merkle_root, nullifier, mint_lo, mint_hi, epoch, recipient_lo, recipient_hi, amount, sanctions_root, jurisdiction_root, timestamp. Pubkeys são split em dois limbs de 128 bits para caber no scalar field BN254 (~254 bits).

### Componente 2 — Anchor Program

Programa Rust/Anchor no Solana. Instruções principais:

```rust
register_issuer(merkle_root: [u8; 32], sanctions_root: [u8; 32], jurisdiction_root: [u8; 32])
update_issuer_root(merkle_root: [u8; 32], sanctions_root: [u8; 32], jurisdiction_root: [u8; 32])
verify_proof(proof_and_witness, nullifier_hash, mint, epoch, recipient, amount, ...)
check_attestation(nullifier_hash, ...)

// Transfer-hook flow (Componente 3)
init_extra_account_meta_list(extras)            // uma vez por mint
set_hook_payload(proof_and_witness, nullifier_hash, mint, epoch, recipient, amount, light_args)
settle_hook(amount)                              // caminho direto (agents / testes)
transfer_hook(amount)                            // entry do Token-2022 Execute
```

Verificação usa `alt_bn128_pairing`, `alt_bn128_addition`, `alt_bn128_multiplication` — syscalls nativas do Solana. Custo: <250K CUs, <0.001 SOL (ver ADR-022).

### Componente 3 — Token Transfer Hook

Integração com Token Extensions (Token-2022). Fluxo em duas fases por limitação do `ExecuteInstruction` (dados = apenas `amount: u64`, sem espaço para proof + witness):

1. Cliente invoca `set_hook_payload` na mesma transação, armazenando proof/witness + `StagedLightArgs` num PDA `[HOOK_PAYLOAD_SEED, authority.key()]`.
2. Token-2022 invoca `transfer_hook(amount)` automaticamente durante o transfer. O handler rebinde o payload ao contexto da tx (mint, recipient, amount), chama `verify_bundle`, e cria nullifier + attestation comprimidos via Light CPI.

Atomicidade enforçada com o flag `TransferHookAccount.transferring` do Token-2022 (chamadas stand-alone ao `transfer_hook` falham com `NotInTransfer`). Anti-replay via colisão de endereço Light compressed (ADR-007 + ADR-020). Caminho alternativo: `settle_hook` para chamadas diretas (off-chain agents, testes).

### Componente 4 — TypeScript SDK (@zksettle/sdk)

```typescript
zksettle.prove(credential)          // gera ZK proof localmente
zksettle.wrap(transferInstruction)  // adiciona compliance a qualquer ix SPL
zksettle.audit(txSignature)         // retorna audit trail on-chain
zksettle.issuer.publish(merkleRoot) // para providers KYC publicarem updates
```

### Componente 5 — Dashboard

Interface web para issuers e fintechs: live feed de proofs, transações bloqueadas com motivo, audit trail exportável.

---

## 8. Stack tecnológico

| Camada | Tecnologia | Justificativa |
|---|---|---|
| ZK circuits | Noir + Sunspot → Groth16 BN254 | Stack oficial Solana Foundation, exemplos em solana-foundation/noir-examples |
| Proof generation | @noir-lang/backend_barretenberg + WASM | Roda no browser, zero dados em servidor |
| On-chain program | Rust + Anchor | Padrão Solana, alt_bn128 syscalls nativas |
| Token compliance | SPL Token Extensions + Transfer Hooks | Atomicidade garantida, não bypassável |
| State compression | Light Protocol ZK Compression | Nullifiers 200× mais baratos |
| SDK | TypeScript + @solana/web3.js | Stack do time, integração rápida |
| Hash em circuits | Poseidon2 | ZK-friendly, 100× menos constraints que SHA-256 |
| Frontend | Vite + React + TypeScript | SPA dashboard, sem necessidade de SSR, bundle menor e dev loop mais rápido (alinhado ao README) |

---

## 9. Fora do escopo (MVP)

Qualquer item abaixo é scope creep que compromete o demo em 5 semanas.

- Integração com providers KYC reais (Jumio, Onfido, Persona)
- Multi-jurisdição — apenas US/OFAC no hackathon
- Outros tokens além de USDC-test no devnet
- Revogação de credentials em tempo real
- Mobile app ou wallet extension
- Token próprio / tokenomics
- Multi-chain (Solana only)
- SLA de produção, rate limiting, uptime guarantees

---

## 10. Modelo de negócio

| Tier | Volume mensal | Preço por proof | Inclui |
|---|---|---|---|
| Developer | Até 1.000 proofs | Grátis | Devnet, 1 issuer mock, SDK completo |
| Startup | Até 50.000 proofs | $0.05/proof | Mainnet, 3 issuers, dashboard, suporte |
| Growth | Até 500.000 proofs | $0.02/proof | Issuers ilimitados, SLA 99.9%, audit exports |
| Enterprise | Volume negociado | Negociado | Suporte dedicado, compliance reports, custom jurisdictions |

**Projeção MVP:** 10 fintechs no tier Startup com 20K proofs/mês = **$10K MRR** no mês 1 pós-hackathon.

---

## 11. Métricas de sucesso do MVP

| Métrica | Target |
|---|---|
| Demo: transferência aprovada com proof válida | Funciona ao vivo em devnet |
| Demo: transferência bloqueada com proof inválida/expirada | Funciona ao vivo em devnet |
| Tempo de proof generation no browser | <10 segundos |
| Custo de verificação on-chain | <0.001 SOL |
| SDK publicado no npm | v0.1.0 antes da submissão |
| Evidência de user demand | Pelo menos 2 fintechs confirmando o problema |
| Posts no X durante o hack | Mínimo 2 taggando @ColosseumOrg |

---

## 12. Plano de execução — 5 semanas

### Semana 1 — 11–17 abr · Fundação
- Setup Noir + Sunspot, hello world circuit verificado no devnet
- Anchor scaffold, `register_issuer()` funcionando
- USDC-test com Transfer Hook habilitado no devnet
- Schema do credential definido + Merkle tree com 100 wallets de teste
- Repo público no GitHub, README inicial, CI básico

### Semana 2 — 18–24 abr · Core ZK
- Circuit completo: membership + sanctions + jurisdiction + nullifier
- Compilar Groth16 via Sunspot, gerar verification key
- `verify_proof()` com alt_bn128 syscalls no Anchor
- Transfer Hook + nullifier tracking via Light Protocol
- **Checkpoint sexta:** proof gerada localmente + verificada on-chain. Se não funcionar, escalar.

### Semana 3 — 25 abr–1 mai · Produto
- Proof generation no browser (Noir WASM)
- SDK `@zksettle/sdk` completo: `prove()`, `wrap()`, `audit()`
- Script issuer mock + dashboard com live feed
- **Checkpoint sexta:** demo completo com aprovação + rejeição funcionando.

### Semana 4 — 2–8 mai · Pitch
- Gravar demo técnico (2–3 min)
- Gravar pitch video (3 min exatos)
- Benchmark com números reais
- Integration guide de 1 página
- Stress test: 50 transferências simultâneas

### 11 mai · Submissão
- Repo GitHub público com README completo
- Pitch video ≤ 3 minutos
- Demo técnico 2–3 minutos
- Devnet deployment ao vivo
- SDK publicado no npm

---

## 13. Divisão de trabalho

| Pessoa | Responsabilidades | Semanas críticas |
|---|---|---|
| Mario | Noir circuits, WASM no browser, SDK TypeScript, coordenação | S1 + S2 + S3 |
| Backend | Anchor program, Transfer Hook, Light Protocol, deployment | S1 + S2 + S3 |
| Fullstack | Dashboard, testes E2E, integration guide, demo videos | S2 + S3 + S4 |

---

## 14. Roadmap pós-hackathon

| Fase | Período | Entregáveis |
|---|---|---|
| Launch | Jun–Jul/26 | 1º cliente pagante, integração Persona/Sumsub, mainnet USDC |
| Expansão | Ago–Nov/26 | Multi-jurisdição, MiCA Travel Rule EU (Q3), proof of solvency (UC-02) |
| Protocolo | 2027 | Proof of reserves, ZK credit score, seed round $2–5M |

---

## 15. Propostas de melhorias arquitetura/feature

Melhorias que não cortam o escopo atual do MVP mas elevam o produto. Ordenadas por impacto no pitch e viabilidade dentro das 5 semanas.

### 15.1 · Batch proof verification

Hoje 1 proof = 1 tx. Adicionar `verify_proof_batch(proofs: Vec<Proof>, public_inputs: Vec<Vec<u8>>)` agregando N proofs via pairing check amortizado ou recursive Groth16. Fintech com alto volume paga significativamente menos CU. Diferencial forte no pitch de economia.

### 15.2 · Credential versioning no circuit

Adicionar `schema_version` como public input do circuit. Issuer evolui schema (ex: novo campo `risk_score`, `pep_flag`) sem invalidar proofs antigas. Sem isso, qualquer update de schema quebra toda a base de credentials emitidas — dor garantida em produção.

### 15.3 · Issuer revocation list (delta-based)

ADR-001..008 só cobre root update. Revogação de credential exige republicar Merkle root inteiro = caro e lento. Adicionar **Sparse Merkle Tree de revogação separada** com proof de non-membership no circuit. Issuer revoga 1 wallet em O(log n) sem recomputar árvore de usuários. Feature crítica para sanctions updates diários (OFAC).

### 15.4 · Proof delegation / session keys

Usuário gera 1 proof → deriva session token válido por N tx no mesmo contexto (ex: dia de trading). Circuit emite `session_commitment` como public input, hook aceita múltiplas tx até expiry. UX 100× melhor sem quebrar anti-replay — nullifier por sessão, não por tx.

### 15.5 · Jurisdiction set como Merkle tree, não hash [IMPLEMENTADO — ADR-013 / circuit main.nr]

~~PRD define `jurisdiction_set_hash` como public input.~~ Implementado: circuit prova membership da jurisdiction do user via Merkle path contra `jurisdiction_root` (public input index 9). Issuer publica `jurisdiction_root` via `register_issuer` / `update_issuer_root`. Proofs antigas continuam válidas se jurisdiction ainda permitida.

### 15.6 · Transfer Hook com policy engine

Hook hoje = binário (proof válida / inválida). Generalizar: attestation carrega `{jurisdiction, risk_tier, amount_cap, accredited_flag}`, hook lê `PolicyAccount` associada ao mint e decide via regras configuráveis. Mesmo program core serve travel rule, accredited investor gating, RWA compliance — 3 produtos do roadmap com 1 arquitetura.

### 15.7 · Proof caching / memoization no SDK

`zksettle.prove()` regenera witness do zero em toda chamada. Cachear witness + partial proof localmente por credential. Re-prove com contexto novo recomputa só os últimos gates afetados. Proof time 10s → ~2s em calls repetidas. Zero custo on-chain, pura melhoria de DX.

### 15.8 · Gadget split (2 circuits paralelos)

Se circuit único estourar constraints ou exceder 10s no browser, separar em 2 sub-proofs: (a) membership + jurisdiction, (b) sanctions + nullifier. Hook verifica ambas no mesmo tx via 2 pairing checks (ainda <200K CU). Proof generation paraleliza em 2 web workers. Tempo total cai ~40%.

### 15.9 · Audit trail merkleizado por epoch

`ComplianceAttestation` hoje = 1 account por tx → state cresce linear. Alternativa: acumular Merkle root de attestations por epoch (24h) no program state. Auditor pede proof off-chain de que tx X foi verificada no epoch Y. State on-chain passa de O(N) para O(1) por epoch. Root exportável como commitment imutável para reguladores.

### 15.10 · Credential format = W3C VC + BBS+

PRD define schema de credential custom. Adotar **W3C Verifiable Credentials** com signature BBS+ (selective disclosure nativa). Issuer reusa stack padrão da indústria, credentials portáveis entre protocolos. Posiciona ZKSettle como camada ZK de infra VC, não silo proprietário — narrativa de $100M+.

### 15.11 · Attestation como cNFT (CPI-able primitive) [IMPLEMENTADO — ADR-019]

Implementado: `init_attestation_tree` + Bubblegum `MintV1` CPI emitido após Light CPI em `verify_proof`, `settle_hook`, e `transfer_hook`. cNFT minted para `recipient` com metadados derivados de `hashv(issuer || nullifier || merkle_root || slot || expiry_slot)`. O caminho CPI `check_attestation` permanece para acoplamento on-chain direto.

### 15.12 · Nullifier context explícito (mint + epoch) [IMPLEMENTADO — ADR-020]

Implementado: `nullifier = Poseidon2(sk, mint_lo, mint_hi, epoch, recipient_lo, recipient_hi, amount)` com `epoch = floor(unix_timestamp / 86400)`. Binding a `recipient` + `amount` previne front-running. `verify_proof` valida epoch freshness (`EpochInFuture` / `EpochStale`, `MAX_EPOCH_LAG = 1`).

### Top 3 para pitch

1. **§15.1 Batch verification** — economia de CU visível em slide de custo.
2. **§15.6 Policy engine** — transforma "compliance API" em "compliance primitive".
3. **§15.10 W3C VC** — posiciona como infra layer, não aplicação.
