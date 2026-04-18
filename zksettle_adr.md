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
