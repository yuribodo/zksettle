# ZKSettle — Elevator Pitch & Entenda o Produto

---

## Elevator Pitch

### Versão 30 segundos — elevador mesmo

> "Stablecoins movimentaram 9 trilhões de dólares em 2025. Mas toda empresa que entra nesse mercado gasta 6 meses e 500 mil dólares construindo compliance do zero — travel rule, sanctions screening, AML. ZKSettle é a API de compliance compartilhada. Uma linha de código e a fintech está coberta. Usamos zero-knowledge proofs para provar que a transação é limpa sem expor dados dos usuários em blockchain pública. É o Stripe, mas para compliance de pagamentos com stablecoin."

---

### Versão 60 segundos — reunião de corredor

**[0:00–0:15] Problema**
> "Regulação de stablecoin criou um paradoxo: você precisa provar compliance em blockchain pública mas não pode expor dados pessoais dos usuários. GDPR de um lado, travel rule do outro. Antes de ZK proofs, não tinha solução."

**[0:15–0:35] Solução**
> "ZKSettle resolve isso. O usuário prova que é elegível — sem revelar quem é. A fintech integra com uma linha de código. O Transfer Hook verifica on-chain por menos de $0.001. Mas vai além de KYC: a mesma infra prova solvência sem revelar saldo, comprova histórico de crédito sem doxxing, verifica origem de fundos sem expor transações."

**[0:35–0:55] Mercado**
> "40+ fintechs de stablecoin identificadas no Solana. $9T em volume global. Cobramos $0.05 por proof. 10 clientes com 20K transações/mês = $10K MRR desde o dia 1. Long-term: undercollateralized lending é um mercado de $5 trilhões que só existe com ZK credit proofs."

**[0:55–1:00] Call to action**
> "Time de Rust + Anchor + ZK. Hackathon em 11 de maio. Quer 20 minutos para ver o demo?"

---

### Versão 3 minutos — pitch completo Colosseum

**[0:00–0:30] Problema com urgência legal**
> "Stablecoins processaram 9 trilhões de dólares em 2025. O GENIUS Act criou obrigação federal de travel rule compliance. Todo fintech que entra nesse mercado gasta 6 meses e 500 mil dólares construindo compliance do zero. E no final, os dados dos usuários ainda ficam em servidores centralizados. O paradoxo: você não pode colocar dados de identidade em blockchain pública, mas precisa provar compliance para reguladores. Antes de 2025, não havia solução para isso."

**[0:30–1:15] Solução + demo ao vivo**
> "ZKSettle é a infraestrutura compartilhada de compliance. O usuário faz verificação uma vez. Quando transfere USDC, gera uma ZK proof em 5 segundos que prova: é pessoa real, não está em lista de sanções, tem jurisdição elegível. Sem revelar quem é. O Transfer Hook verifica on-chain por menos de $0.001. [DEMO: aprovação → bloqueio → explorer] A fintech integra com 3 linhas de código. Mas compliance é só o começo — a mesma primitiva ZK prova solvência sem revelar saldo, histórico de crédito sem doxxing, origem de fundos sem expor transações. Um SDK, múltiplos casos de uso."

**[1:15–2:00] Technology unlock**
> "Três coisas convergiram em 2025: GENIUS Act criou urgência legal. Solana ganhou syscalls BN254 nativos — verificação ZK custa $0.001. Solana Foundation passou a suportar Noir + Sunspot oficialmente. O Solana processou $650 bilhões em stablecoins só em fevereiro de 2026. O layer de compliance não existe. Isso não é um produto melhor — é um produto que não podia ser construído antes de 2025."

**[2:00–2:35] Mercado e modelo**
> "40+ fintechs identificadas no Solana agora. $0.05 por proof. 10 clientes com 20K transações/mês = $10K MRR imediato. Um enterprise = $50–200K/ano. Longo prazo: undercollateralized lending é $5 trilhões endereçáveis — só existe com ZK credit proofs. Proof of reserves é $300 bilhões em ativos de stablecoin — zero solução ZK nativa no Solana. Estamos construindo a camada de trust que desbloqueia esses mercados."

**[2:35–3:00] Time + próximos passos**
> "Rust nativo, Anchor, ZK circuits, sistemas financeiros de alta performance. Com o acelerador: primeiro cliente pagante em 60 dias — já temos 2 conversas em andamento. SDK no npm com documentação completa. E o MiCA Travel Rule europeu entra em vigor no Q3/2026 — criando o mesmo GENIUS Act, mas para o mercado europeu. zksettle.com. Obrigado."

---

## Entenda o Produto

### O problema em linguagem humana

Imagina que você quer mandar $1.000 em USDC para alguém. A lei diz que quem está enviando e quem está recebendo precisam ter seus dados verificados — nome, documento, origem do dinheiro. Isso se chama **travel rule**.

O problema: stablecoins rodam em blockchain. Blockchain é público. Se você colocar "João Silva, CPF 123.456.789-00" na transação, qualquer pessoa no mundo vê para sempre. Isso é ilegal em praticamente todo lugar (GDPR, LGPD, etc.).

Então você tem duas opções ruins:

- **Revelar os dados** e violar privacidade
- **Não revelar** e violar compliance

Toda fintech de stablecoin hoje escolhe um dos dois e torce para o regulador não bater na porta.

> ZKSettle existe para que ninguém precise fazer essa escolha. Você prova que está em conformidade sem revelar quem você é. Matematicamente impossível de falsificar, matematicamente impossível de espionar.

---

### Como funciona na prática

**Sem ZKSettle:**
Usuário faz KYC na fintech A. Quer transferir para um parceiro da fintech B. Fintech A precisa mandar dados do usuário para fintech B. Dados viajam em servidor centralizado. Podem ser hackeados. Usuário não sabe. LGPD chora.

**Com ZKSettle:**
Usuário faz verificação uma vez. Gera uma prova matemática no próprio dispositivo. A prova diz: "este usuário passou em todos os checks" — sem revelar quem é. A fintech B verifica a prova on-chain. Custo: $0.001. Tempo: 5 segundos. Dados pessoais: nunca saem do dispositivo do usuário.

---

### O que é zero-knowledge proof em termos simples

ZK proof é uma prova matemática onde você demonstra que sabe algo **sem revelar o quê**.

Exemplo clássico: você prova que sabe a senha de um cofre sem digitar a senha. O verificador fica 100% convencido que você sabe — mas não descobre qual é a senha.

No ZKSettle: o usuário prova que "passou no KYC, não está na lista de sanções, tem jurisdição elegível" sem revelar nome, CPF, país, banco, ou qualquer dado pessoal. O Anchor program no Solana verifica a prova matematicamente e confirma: válida ou inválida. Sem banco de dados, sem servidor, sem intermediário.

---

### Os casos de uso reais — além de KYC

**1. Travel rule compliance**
- Mercado: $9T em stablecoins · Urgência: GENIUS Act 2025
- Fintech prova para regulador que verificou remetente e destinatário — sem armazenar nem expor os dados. Audit trail on-chain imutável, auditável sem revelar PII.

**2. Proof of solvency para DeFi**
- Mercado: $14B em DeFi lending · Desbloqueador: undercollateralized lending ($5T)
- Usuário prova que tem saldo suficiente para um empréstimo sem revelar o saldo exato. "Tenho mais de $10K" — provado matematicamente, sem mostrar extrato de banco. Isso abre o maior gap de DeFi: empréstimos sem 150% de colateral, como no mundo real.

**3. ZK credit score**
- Mercado: $5T em crédito não colateralizado · Gap: nenhum projeto em produção no Solana
- Usuário prova histórico de pagamentos on-chain e score de crédito off-chain sem revelar em quais protocolos operou, quanto movimentou, ou qual carteira é. Permissão para emprestar com menos colateral, conquistada por comportamento, não por identidade.

**4. AML por comportamento, não identidade**
- Mercado: $1.8B em crypto AML · Diferencial: sem doxxing
- Em vez de provar quem você é, você prova que seu histórico de transações não tem padrões de lavagem de dinheiro. Reguladores querem evidência de compliance — não necessariamente sua identidade. ZK entrega evidência sem identidade.

**5. Proof of reserves para exchanges e stablecoins**
- Mercado: $300B em ativos de stablecoin · Gap: zero solução ZK nativa no Solana
- Exchange prova que tem ativos suficientes para cobrir todos os saques sem revelar posições individuais, carteiras quentes, ou composição exata do portfólio. Binance e OKX já fazem isso no Ethereum. No Solana: vazio completo.

---

### Por que Solana e por que agora

| Sinal | O que significa |
|---|---|
| Syscalls BN254 nativas (2025) | Groth16 verification por $0.001 — economicamente viável |
| Noir + Sunspot suportado pela Solana Foundation | Stack ZK produção-ready com exemplos oficiais |
| $650B em stablecoins no Solana em fev/26 | Volume que já justifica a infra. Não é aposta futura. |
| GENIUS Act assinado (2025) | Obrigação legal com deadline — dor com urgência |
| 0 soluções ZK compliance nativas no Solana | Janela de oportunidade aberta agora |
