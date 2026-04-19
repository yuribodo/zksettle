# ZKSettle — ADR (Architecture Decision Records)

Decisões de arquitetura que não podem mudar depois de tomadas. Cada ADR documenta o que foi decidido, por quê, e quais alternativas foram rejeitadas.

> **Regra:** decidir na Semana 1 e não revisar sem motivo crítico. Mudar qualquer um desses itens depois quebra a arquitetura inteira.

---

## ADR-001 · Curva criptográfica: BN254 (alt_bn128)

**Status:** Aceito

### Contexto
O Solana tem syscalls nativas para operações em curvas elípticas específicas. A escolha da curva define toda a compatibilidade do sistema de verificação on-chain.

### Decisão
Usar **BN254** (Barreto-Naehrig 254-bit) via syscalls `alt_bn128` do Solana.

### Por quê
BN254 é a única curva com syscalls nativas no Solana (`alt_bn128_pairing`, `alt_bn128_addition`, `alt_bn128_multiplication`), tornando verificação Groth16 extremamente barata — menos de 200K compute units por proof. Sem as syscalls, a verificação exigiria milhões de CUs, tornando o produto economicamente inviável.

### Alternativas rejeitadas
- **BLS12-381:** Não tem syscalls no Solana. Verificação custaria ordens de magnitude mais.
- **Ristretto255:** Solana tem syscalls, mas não há tooling ZK maduro para esta curva.

### Consequências
Circuits Noir devem ser compilados com target BN254. Todos os provers e verifiers devem suportar BN254.

---

## ADR-002 · Proof system: Groth16 via Sunspot

**Status:** Aceito

### Contexto
Múltiplos proof systems existem (Groth16, PLONK, halo2, STARKs). A escolha define custo de verificação on-chain, necessidade de trusted setup, e compatibilidade com tooling.

### Decisão
**Groth16** compilado via **Sunspot** — compilador mantido pela Reilabs com suporte oficial da Solana Foundation.

### Por quê
Groth16 produz proofs de tamanho fixo e pequeno (256 bytes) com verificação O(1) — ideal para on-chain. Os `alt_bn128` syscalls do Solana foram projetados especificamente para Groth16 sobre BN254. Sunspot é o único compilador Groth16 com suporte oficial da Solana Foundation e exemplos funcionais em `solana-foundation/noir-examples`.

### Alternativas rejeitadas
- **halo2:** Sem trusted setup, mas proof size maior e sem syscalls dedicadas no Solana.
- **STARKs:** Proof size muito maior (~200KB vs 256 bytes), verificação mais cara on-chain.
- **PLONK:** Tooling menos maduro para Solana no momento.

### Consequências
Requer uma trusted setup ceremony (Powers of Tau). Para o hackathon, usar a ceremony pública do Hermez. Produção requer ceremony própria com múltiplos participantes.

---

## ADR-003 · Linguagem de circuits: Noir

**Status:** Aceito

### Contexto
ZK circuits podem ser escritos em circom, Noir, ou DSLs específicas como halo2 em Rust puro. A escolha define DX, velocidade de desenvolvimento, e compatibilidade com o ecossistema Solana.

### Decisão
**Noir** — linguagem Rust-like da Aztec, compilada via Sunspot para Groth16 BN254.

### Por quê
Noir é a stack oficialmente suportada pela Solana Foundation. O repo `solana-foundation/noir-examples` contém exemplos funcionais de Merkle membership, ECDSA verification, e Sparse Merkle Tree exclusion — exatamente os primitivos necessários. DX superior ao circom (tipagem forte, funções, módulos). O backend Barretenberg compila para WASM, habilitando proof generation diretamente no browser sem servidor intermediário.

### Alternativas rejeitadas
- **circom:** DX inferior, sintaxe mais verbosa, tooling menos integrado com Solana.
- **halo2 em Rust puro:** Curva de aprendizado extremamente alta, sem exemplos Solana, impraticável em 5 semanas.

### Consequências
Proof generation no browser via `@noir-lang/backend_barretenberg` + `@noir-lang/noir_js`. Time precisa aprender Noir na Semana 1.

---

## ADR-004 · Função hash em circuits: Poseidon

**Status:** Aceito

### Contexto
Merkle trees, commitments, e nullifiers dentro de circuits ZK precisam de funções hash. A escolha afeta diretamente o número de constraints e a performance do circuit.

### Decisão
**Poseidon hash** — ZK-friendly, nativo no Noir.

### Por quê
Poseidon foi projetado especificamente para ser eficiente em arithmetic circuits. Um hash Poseidon custa ~220 constraints vs ~25.000 constraints para SHA-256 dentro de um circuit ZK. Para uma Merkle tree de profundidade 20, isso significa a diferença entre ~4.400 e ~500.000 constraints — impacto direto no tempo de proof generation no browser.

### Alternativas rejeitadas
- **SHA-256:** ~100× mais constraints por operação dentro do circuit. Proof generation > 60 segundos no browser.
- **Keccak:** Implementação complexa em circuits, compatibilidade ruim com Noir.

### Consequências
A Merkle tree off-chain (TypeScript) também deve usar Poseidon para manter compatibilidade com os circuits. Usar `@iden3/js-crypto` ou implementação custom com Poseidon.

---

## ADR-005 · Token standard: Token Extensions (Token-2022)

**Status:** Aceito

### Contexto
Solana tem dois token standards: SPL Token (legacy) e Token Extensions (Token-2022). Compliance hooks precisam interceptar transferências atomicamente e de forma não-bypassável.

### Decisão
**Token Extensions** com **Transfer Hooks**.

### Por quê
Transfer Hooks são executados atomicamente com a transferência — impossível de contornar via chamada direta ao SPL Token legacy. Um wrapper contract externo pode ser ignorado por wallets que chamam SPL diretamente. Para compliance regulatório, atomicidade é não-negociável. Token Extensions é o padrão recomendado pela Solana Foundation para tokens com lógica avançada.

### Alternativas rejeitadas
- **SPL Token legacy + wrapper:** Não atomicamente seguro. Pode ser bypassado por qualquer wallet que chame o programa SPL diretamente.
- **Programa proxy:** Complexidade adicional sem garantia de atomicidade, não é padrão reconhecido.

### Consequências
Token de teste deve ser criado com Token-2022. Todos os clients (wallets, fintechs) precisam suportar Token Extensions — verificar compatibilidade com Phantom, Backpack, e ferramentas usadas no demo.

---

## ADR-006 · State compression: Light Protocol

**Status:** Aceito

### Contexto
`ComplianceAttestation` accounts e o nullifier set acumulam on-chain com cada transação verificada. Sem compressão, custo de rent escala linearmente e inviabiliza o produto em produção.

### Decisão
**Light Protocol ZK Compression** para nullifier set e attestation accounts.

### Por quê
Light Protocol reduz custo de state em 200–5.000×. Um nullifier account normal custa ~0.002 SOL. Com ZK Compression: ~0.000001 SOL. Para um protocolo processando milhões de transações, a diferença é economicamente decisiva. Light Protocol está em produção, é auditado, e tem SDK TypeScript mature com exemplos de integração com Anchor.

### Alternativas rejeitadas
- **Bitmap on-chain:** Simples mas inflexível para nullifiers de 256 bits, não escala.
- **Implementação manual de compressed accounts:** Reinventar a roda sem auditoria de segurança.
- **Ignorar compressão no MVP:** Economicamente inviável em produção. Melhor já usar a abstração certa desde o início.

### Consequências
Integrar `light-sdk` no Anchor program. Operações de nullifier check usam `verify_compressed_cpi`. Adicionar dependência na Semana 2.

---

## ADR-007 · Anti-replay: nullifier on-chain

**Status:** Aceito

### Contexto
Uma ZK proof válida poderia ser reutilizada em múltiplas transações se não houver mecanismo de anti-replay. Isso quebraria completamente o modelo de segurança do sistema.

### Decisão
`nullifier = Poseidon(private_key, context_hash)`. Armazenado como compressed account via Light Protocol. Verificado atomicamente no Transfer Hook.

### Por quê
Nullifier é o mecanismo padrão de anti-replay em protocolos ZK (Zcash, Tornado Cash, Aztec). Derivado deterministicamente da chave privada do usuário e do contexto, é único por transação e matematicamente impossível de reutilizar sem conhecer a chave privada. Compressão via Light Protocol torna o custo de armazenamento desprezível.

### Alternativas rejeitadas
- **Timestamp-based expiry only:** Não previne replay dentro da janela de validade. Atacante pode reutilizar proof enquanto ainda válida.
- **Centralized nullifier registry:** Single point of failure, derrota o propósito trustless do sistema.
- **Sem anti-replay:** Vulnerabilidade crítica. Não aceitável.

### Consequências
O circuit Noir deve computar e expor o nullifier como public input. O Transfer Hook verifica que o nullifier não está no compressed account set antes de autorizar a transferência.

---

## ADR-008 · Modelo de negócio: API pay-per-proof sem token

**Status:** Aceito

### Contexto
Múltiplos modelos de monetização são possíveis: subscription, protocol fee on-chain com token próprio, enterprise license, ou pay-per-usage.

### Decisão
**Pay-per-proof** ($0.05/proof) com tiers mensais por volume. Sem token próprio no MVP.

### Por quê
Pay-per-proof alinha o custo ao uso real — fintechs pagam proporcionalmente ao volume gerado. Sem token elimina pressão de tokenomics, especulação de mercado, e complexidade regulatória desnecessária. Tiers mensais criam MRR previsível para pitch de investidores. É o modelo mais simples de implementar, explicar, e vender.

### Alternativas rejeitadas
- **Token próprio:** Distrai do produto, cria obrigações regulatórias adicionais, complica o pitch com VCs.
- **Subscription flat:** Não escala para fintechs com volume muito variável mês a mês.
- **Protocol fee on-chain:** Requer token para distribuir fees, cria dependência de liquidez.

### Consequências
Billing via Stripe ou similar off-chain inicialmente. On-chain billing via x402 pode ser adicionado como feature premium no futuro sem alterar a arquitetura core.

---

## Resumo das decisões

| ADR | Decisão | Alternativa principal rejeitada |
|---|---|---|
| ADR-001 | Curva BN254 | BLS12-381 (sem syscalls) |
| ADR-002 | Groth16 via Sunspot | halo2 (sem syscalls dedicadas) |
| ADR-003 | Noir para circuits | circom (DX inferior) |
| ADR-004 | Poseidon hash | SHA-256 (100× mais constraints) |
| ADR-005 | Token Extensions + Transfer Hooks | SPL legacy + wrapper (bypassável) |
| ADR-006 | Light Protocol compression | Manual compressed accounts |
| ADR-007 | Nullifier on-chain | Timestamp expiry only (inseguro) |
| ADR-008 | Pay-per-proof sem token | Token próprio (complexidade desnecessária) |

---

## ADRs candidatos — propostas de arquitetura

Decisões derivadas das propostas de melhoria no PRD §15. Status **Proposto** — precisam de review do time e não bloqueiam o MVP atual. Referências `PRD §15.x` apontam para a descrição completa da feature no PRD.

---

## ADR-009 · Batch proof verification

**Status:** Proposto (PRD §15.1)

### Contexto
Verificação individual custa ~200K CU por proof. Fintechs com alto volume pagam linearmente. Múltiplas proofs no mesmo bloco poderiam compartilhar custo de pairing.

### Decisão proposta
Adicionar instrução `verify_proof_batch(proofs, public_inputs)` que agrega N proofs em um pairing check amortizado (random linear combination) ou via recursive Groth16.

### Por quê
Pairing é o dominador de custo. Batching amortiza para ~50K CU/proof em N=10. Reduz custo efetivo para fintechs de alto volume, diferencial direto no pitch de economia.

### Alternativas rejeitadas
- **Recursive SNARK per-user:** complexidade alta, setup custoso no MVP.
- **Off-chain aggregator:** perde atomicidade com Transfer Hook.

### Consequências
SDK expõe `zksettle.proveBatch()`. Transfer Hook precisa suportar batch mode opcional. Implementação pós-MVP — requer benchmarking de CU real.

---

## ADR-010 · Credential schema versioning

**Status:** Proposto (PRD §15.2)

### Contexto
Credentials emitidas com schema vN invalidam quando issuer migra para schema vN+1. Sem versionamento, toda atualização quebra base de users.

### Decisão proposta
Circuit expõe `schema_version: u32` como public input. Program mantém registry de versões aceitas por issuer. Deprecation com grace period configurável.

### Consequências
Circuit recebe input adicional (1 field). Issuer account ganha campo `accepted_versions: Vec<u32>`. Custo negligível em constraints.

---

## ADR-011 · Revocation via Sparse Merkle Tree separada

**Status:** Proposto (PRD §15.3)

### Contexto
Revogar 1 credential exige republicar Merkle root da árvore de users inteira — O(n) por revogação. Inviável para sanctions updates diários (OFAC).

### Decisão proposta
Manter **SMT de revogação separada** da árvore de membership. Circuit prova (a) membership na tree de users E (b) non-membership na SMT de revogados. Issuer publica apenas delta.

### Alternativas rejeitadas
- **Rebuild da árvore principal:** O(n) por revogação, inaceitável.
- **Expiry curto sem revogação:** força re-emissão massiva, ruim pra UX.

### Consequências
Circuit ganha ~2× constraints do current membership check. Issuer publica 2 roots por update: users + revogados.

---

## ADR-012 · Session-based proofs (proof delegation)

**Status:** Proposto (PRD §15.4)

### Contexto
1 proof por tx é caro em UX. User pagando 3 tx seguidas gera 3 proofs = 30s de espera.

### Decisão proposta
Circuit emite `session_commitment = Poseidon(sk, mint, epoch, max_uses)`. Hook aceita N tx sob mesma session até expiry. Nullifier escopado à session, não à tx.

### Consequências
Anti-replay preservado via nullifier por session. Requer UI no SDK para gerenciar sessions ativas. Trade-off: leak de pattern (N tx da mesma session são linkáveis).

---

## ADR-013 · Jurisdiction set como Merkle root

**Status:** Proposto (PRD §15.5, substitui implicitamente decisão do PRD §7)

### Contexto
`jurisdiction_set_hash` como public input invalida todas proofs antigas quando issuer muda conjunto. Adicionar país = força re-prove global.

### Decisão proposta
Substituir `jurisdiction_set_hash` por **Merkle root do conjunto permitido**. Circuit prova membership da jurisdiction do user na tree. Issuer adiciona país = publica root novo, proofs antigas continuam válidas se jurisdiction ainda permitida.

### Consequências
Circuit ganha Merkle path check adicional (~pequenos constraints com Poseidon). Issuer account armazena root de jurisdiction em vez de hash.

---

## ADR-014 · Transfer Hook como policy engine

**Status:** Proposto (PRD §15.6)

### Contexto
Hook binário (aceita/rejeita) não escala para casos além de travel rule. Accredited investor gating, RWA compliance e multi-jurisdiction precisam de lógica configurável.

### Decisão proposta
Attestation carrega payload rico: `{jurisdiction, risk_tier, amount_cap, accredited_flag, ...}`. Cada mint tem `PolicyAccount` associada com regras. Hook avalia policy vs attestation e decide.

### Consequências
1 program core serve múltiplos produtos (travel rule, accredited, RWA). Complexidade de policy DSL — iniciar com enum simples (Allow/Deny por campo), evoluir depois.

---

## ADR-015 · Witness caching local no SDK

**Status:** Proposto (PRD §15.7)

### Contexto
Prover regenera witness completo a cada `prove()`. Para um user que faz múltiplas tx/dia, desperdício.

### Decisão proposta
SDK cacheia witness + partial proof em IndexedDB indexado por credential hash. Re-prove recomputa apenas gates dependentes do novo contexto (nullifier, recipient, amount).

### Consequências
Puro DX win, zero impacto on-chain. Precisa invalidação do cache quando credential expira ou issuer root muda.

---

## ADR-016 · Circuit split em 2 sub-proofs

**Status:** Proposto (PRD §15.8, contingente)

### Contexto
Circuit único (membership + sanctions + jurisdiction + expiry + nullifier) pode estourar constraint budget ou exceder 10s no browser. Ativar apenas se checkpoint S1 indicar >10s.

### Decisão proposta
Split em (a) proof de membership + jurisdiction, (b) proof de sanctions + nullifier. Hook verifica ambos no mesmo tx via 2 pairing checks (<200K CU combinado). Browser paraleliza em 2 web workers.

### Consequências
Hook mais complexo. Proof payload 2× maior. Trade-off aceito se proof time cair ~40%.

---

## ADR-017 · Audit trail merkleizado por epoch

**Status:** Proposto (PRD §15.9)

### Contexto
`ComplianceAttestation` account por tx cresce linearmente com volume. Inviável em produção sem compressão agressiva.

### Decisão proposta
Program acumula Merkle root de attestations por epoch (24h) em state único. Full attestations armazenadas off-chain (Helius webhook → S3/Arweave). Auditor pede prova de inclusion off-chain.

### Alternativas rejeitadas
- **Light Protocol compressed per-attestation (ADR-006):** ainda O(N) storage, só comprimido.
- **Drop attestations:** perde audit trail, não-negociável.

### Consequências
On-chain state O(1) por epoch. Requer serviço de indexação confiável off-chain. Compatível com ADR-006 (pode usar Light para o root history).

---

## ADR-018 · Credential format = W3C Verifiable Credentials + BBS+

**Status:** Proposto (PRD §15.10)

### Contexto
Schema custom de credential obriga issuers a adotar stack proprietária. W3C VC é padrão indústria com suporte de Jumio, Onfido, Persona.

### Decisão proposta
Credentials emitidos como W3C VC JSON-LD com signature BBS+ (selective disclosure nativa). Circuit recebe BBS+ signature verification como input, prova posse + disclosure seletiva.

### Consequências
Issuers reusam stack existente. Credentials portáveis entre protocolos. Circuit ganha complexidade de BBS+ verification (~vs Poseidon-native custom format). Trade-off: padrão indústria vale DX loss.

---

## ADR-019 · Attestation como compressed NFT (Bubblegum)

**Status:** Proposto (PRD §15.11)

### Contexto
`check_attestation(wallet)` via CPI cross-program acopla consumers (Kamino, MarginFi) ao ZKSettle program. Fricção de integração.

### Decisão proposta
Emitir attestation como **compressed NFT via Bubblegum** no wallet do user. Consumers leem account padrão, zero CPI para ZKSettle program.

### Consequências
Padrão Solana reconhecido. Desbloqueia UC-03/UC-04 sem mudança do core. Requer Bubblegum setup + metadata schema. cNFT per attestation é barato via state compression.

---

## ADR-020 · Nullifier context explícito

**Status:** Proposto (refina ADR-007, PRD §15.12)

### Contexto
ADR-007 define `nullifier = Poseidon(sk, context_hash)` mas deixa `context` sem especificação formal. Risco de implementações inconsistentes.

### Decisão proposta
Especificação formal:
```
nullifier = Poseidon(sk, mint_pubkey, epoch_index, recipient, amount)
epoch_index = floor(unix_timestamp / 86400)
```
Bind a `recipient` + `amount` previne front-running (ver threat model). `epoch_index` permite 1 proof/dia/token (UX) mantendo anti-replay.

### Consequências
Circuit recebe `mint`, `epoch`, `recipient`, `amount` como public inputs. Hook valida esses campos vs tx corrente. Fix de segurança crítico além da melhoria de UX.

---

## ADR-021 · Janela de frescor da Merkle root do issuer

**Status:** Decidido (implementado)

### Contexto
`Issuer.root_slot` é gravado em `register_issuer` e `update_issuer_root` mas até então não era consultado por `verify_proof`. Uma root antiga (issuer offline, chave comprometida sem rotação, ou qualquer janela onde a árvore off-chain diverge da root on-chain) permanecia válida indefinidamente, alargando a janela de ataque para provas obsoletas.

### Decisão
`verify_proof` rejeita com `ZkSettleError::RootStale` quando
`current_slot - issuer.root_slot > MAX_ROOT_AGE_SLOTS`,
com `MAX_ROOT_AGE_SLOTS = 432_000` (~48h a 400ms/slot). O issuer é forçado a republicar a root via `update_issuer_root` em cadência de no máximo 48h; falha em republicar pausa verificações sem exigir upgrade on-chain.

### Consequências
- Issuer service precisa de job de rotação de root com SLA < 48h.
- Zero impacto em testes existentes — o fixture roda imediatamente após `register_issuer`.
- Ajustável: configuração futura pode expor `MAX_ROOT_AGE_SLOTS` por issuer caso diferentes verticais peçam janelas distintas.

---

## Resumo das propostas

| ADR | Feature | Prioridade |
|---|---|---|
| ADR-009 | Batch verification | Alta (pitch) |
| ADR-010 | Schema versioning | Alta (produção) |
| ADR-011 | Revocation SMT | Crítica (sanctions) |
| ADR-012 | Session proofs | Média (UX) |
| ADR-013 | Jurisdiction Merkle | Alta (produção) |
| ADR-014 | Policy engine | Alta (pitch) |
| ADR-015 | Witness caching | Baixa (DX) |
| ADR-016 | Circuit split | Contingente (S1 bench) |
| ADR-017 | Audit epoch merkleizado | Alta (produção) |
| ADR-018 | W3C VC + BBS+ | Alta (pitch) |
| ADR-019 | cNFT attestation | Média (UC-03/04) |
| ADR-020 | Nullifier context explícito | Crítica (security) |
| ADR-021 | Janela de frescor da Merkle root | Decidido (security) |
