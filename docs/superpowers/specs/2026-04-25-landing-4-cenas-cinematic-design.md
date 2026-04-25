# Landing 4 cenas cinematic — design

## Contexto

A landing atual tem 10+ seções (Hero, Paradox, TwoRealities, HowItWorks, Numbers, Demo, UseCases, Developers, Momentum, ClosingCta, Footer). O efeito de scroll do hero (`VeilCanvas` com convergência das partículas no glyph) fica enterrado porque o usuário precisa atravessar muitas seções dispersas pra ver qualquer payoff cinematográfico, e várias seções estão competindo pela atenção.

A reescrita consolida em **4 atos pinados (full cinema)**, cada um como showpiece de scroll-driven storytelling:
1. **HERO** — promessa
2. **PARADOX** — conflito (showpiece)
3. **ENGINE** — solução (showpiece)
4. **MOVE** — ação

Decisões já travadas com o usuário:
- **Tom:** Cinematic Storytelling (Linear/Arc/Apple-tier)
- **Estrutura:** Paradoxo → Resolução (4 atos descritos acima)
- **Intensidade:** Full Cinema — todas as 4 seções pinadas, smooth scroll global, cross-section morphs onde fizer sentido
- **Audiência:** devs cripto + early adopters (compliance teams ficam em segundo plano nessa landing — entendem ainda assim)
- **Mobile:** pin desabilita totalmente; vira lista vertical com FadeIn staggered
- **Reduced motion:** respeitado — pin/scrub/morph desligam, fade simples sobrevive

## Referências de design

As decisões abaixo se ancoram em landings tier-awwwards / industry-leading. Cada referência informa um ângulo específico — não copiamos visual, copiamos *padrão*.

### Smooth scroll + tom geral
- **[cuberto.com](https://cuberto.com)** ⭐ — *referência preferida do usuário*. Agência selo-awwwards; biblioteca viva de scroll-driven storytelling.
- **[diabrowser.com](https://www.diabrowser.com)** ⭐ — *referência preferida do usuário*. Próxima geração da landing-cinema (Browser Company / pós-Arc). Tom calmo + reveals dramáticos onde precisa.
- **[linear.app](https://linear.app)** — Lenis + ScrollTrigger pinning seletivo, headlines gigantes em fade reveal. Padrão B2B SaaS cinematográfico.
- **[vercel.com](https://vercel.com)** — pinned feature reveals com tipografia grande, tabs animadas, motion sutil mas constante.
- **[arc.net](https://arc.net)** — extremo cinematic; útil pra entender o limite superior, não pra copiar.

### Ato 1 — Hero cinematográfico
**Direção do usuário:** mirar **nível Igloo Inc.** em ambição cinematográfica, com **assets simples e bonitos no estilo Privy** (não barroco, não pesado em ilustração custom).
- **[igloo.inc](https://igloo.inc)** ⭐ — *aspiracional*. Awwwards-favorito 2024–2025; hero WebGL + scroll cinematográfico, distintivo mas não barulhento.
- **[privy.io](https://privy.io)** ⭐ — *padrão de assets*. Visual leve, profundidade discreta, ilustrações geométricas simples e bonitas. Tom de wallet/auth infra alinhado com ZKSettle.
- **[stripe.com](https://stripe.com)** — gradient WebGL ambient + headline reveal em fade. Padrão de "calm cinematic hero".
- **[phantom.app](https://phantom.app)** — WebGL ambient + tipografia bold; tom cripto-nativo similar ao nosso.

### Ato 2 — Paradox showpiece (with/without ZK)
- **[1password.com](https://1password.com)** — históricamente usa "without 1Password / with 1Password" como comparação dramática. Padrão de prova por contraste.
- **[notion.com/calendar](https://www.notion.com/product/calendar)** — reveals before/after via scroll-scrub.
- **[stripe.com/atlas](https://stripe.com/atlas)** — comparações visuais de tax/setup com/sem Atlas.
- **[copy.ai](https://copy.ai)** (cenas de "antes/depois") — útil pro padrão de campos "queimando" em uma coluna enquanto a outra se solidifica.

### Ato 3 — Engine sticky split (visual fixo + texto rola)
- **[trigger.dev](https://trigger.dev)** ⭐ — *referência primária do usuário*. Dev-infra com sticky split + diagrama animado. Tom técnico-cinematográfico mais próximo da audiência ZKSettle (devs cripto). Pegar daqui o ritmo dos capítulos + estilo dos diagramas.
- **[stripe.com/payments](https://stripe.com/payments)** — padrão canônico de sticky split (lado fixo evolui conforme texto rola). Mecânica de scroll-trigger.
- **[resend.com](https://resend.com)** — sticky com code samples + texto explicativo. Inspiração para timing.
- **[apple.com/iphone-15-pro](https://www.apple.com/iphone-15-pro/)** — sticky tridimensional. Limite superior em polish, referência aspiracional.

### Ato 4 — Code reveal + closing
- **[resend.com](https://resend.com)** ⭐ — code blocks com typewriter + chips de integração. Padrão "three lines and you're shipped".
- **[tinybird.co](https://tinybird.co)** ⭐ — dev-infra closing — código + chips + CTA. Hierarquia de prioridade clara.
- **[liveblocks.io](https://liveblocks.io)** ⭐ — code-led closing com use cases laterais. Ritmo similar.
- **[trigger.dev](https://trigger.dev)** — typewriter + chips, complementa o tom do Ato 3.
- **[vercel.com/contact](https://vercel.com/contact)** — minimal closing + footer enxuto.

*Removido:* `cal.com` (não conversa com a vibe — feedback do usuário).

### Lenis + GSAP (stack)
- **[studio-freight.com](https://studio-freight.com)** — criadores do Lenis; site exemplifica integração canônica.
- **[gsap.com/showcase](https://gsap.com/showcase)** — galeria oficial; especialmente úteis as showcases com `ScrollTrigger.scrollerProxy` + Lenis.
- **[gsap.com/docs/v3/Plugins/ScrollTrigger](https://gsap.com/docs/v3/Plugins/ScrollTrigger)** — docs oficiais; padrões `pin: true`, `scrub: 0.5`, `matchMedia`.

### Awwwards / Diretórios pra revisão contínua
- **[awwwards.com/sites_of_the_day](https://www.awwwards.com/sites_of_the_day/)** — pra checar tendência atual de landing tier-prêmio.
- **[godly.website](https://godly.website)** — curadoria mais minimalista.
- **[siteinspire.com](https://www.siteinspire.com)** — referência de layout/tipografia.

### Por que essas referências e não outras
Foco em landings que (a) vendem **infra técnica** (não consumer apps), (b) usam **scroll-driven storytelling como ferramenta de venda**, e (c) **mantêm legibilidade** (não são art-pieces que sacrificam clareza por estética). ZKSettle é compliance infra — precisa parecer awwwards-tier sem perder o aspecto de produto sério.

## Stack

**Adicionar:**
- `lenis` (smooth scroll global, linha de base de todas as landings cinematográficas modernas)
- `@gsap/react` (hook `useGSAP` — cleanup automático em React 19 strict mode)

**Já instalado, usado mais agressivamente:**
- `gsap` v3.15 + `ScrollTrigger`
- `motion` v12 (entries simples, micro-interações)
- `three` v0.184 (hero veil canvas — opcionalmente estendido pro Ato 2)

**Novo padrão de animação:**
- Lenis instala global no layout client. ScrollTrigger é configurado com `scrollerProxy` apontando pro elemento que Lenis dirige.
- `useGSAP` substitui `useEffect + cleanup manual` em todos os componentes pin/scrub.
- `gsap.matchMedia()` controla o gating mobile + reduced-motion (não duplicar lógica).

## Arquitetura — composição da página

`frontend/src/app/page.tsx` reduz a:

```tsx
<SmoothScrollProvider>
  <Nav />
  <main>
    <ActOneHero />
    <ActTwoParadox />
    <ActThreeEngine />
    <ActFourMove />
  </main>
  <Footer />
</SmoothScrollProvider>
```

**Componentes que somem da landing:**
- `ParadoxSection` (conteúdo migra pra ActTwoParadox)
- `TwoRealitiesSection` (núcleo do ActTwoParadox)
- `HowItWorksSection` + `NumbersSection` + `DemoSection` (fundem em ActThreeEngine)
- `UseCasesSection` (chips compactos no ActFourMove)
- `DevelopersSection` (fase 1 do ActFourMove)
- `MomentumSection` (distribuído como eyebrows nos Atos 2 e 4 — não sobrevive como seção isolada)
- `ClosingCta` (fase 3 do ActFourMove)

**Componentes que sobrevivem com mudança:**
- `Nav` — vira transparent fixed; ganha background quando fora do hero (intersection observer ou ScrollTrigger)
- `Footer` — minimalista (logo + 3 links + tagline em uma fileira); substitui o atual com grid de links

**Componentes que sobrevivem intactos:**
- `Hero` (existente) — usado como base do ActOneHero, com layer extra de motion no headline
- `ProofConsole`, `DisplayHeading`, `Section`, `SectionHeader`, `FadeIn`, `CountUp` — utilitários reutilizados

**Componentes novos:**
- `frontend/src/components/landing/smooth-scroll-provider.tsx` — Lenis lifecycle + ScrollTrigger.scrollerProxy
- `frontend/src/components/landing/acts/act-one-hero.tsx` — wrapper do hero com pin + headline reveal
- `frontend/src/components/landing/acts/act-two-paradox.tsx` — showpiece do paradoxo
- `frontend/src/components/landing/acts/act-three-engine.tsx` — sticky split engine
- `frontend/src/components/landing/acts/act-four-move.tsx` — SDK + chips + closing
- `frontend/src/components/landing/acts/use-act-pin.ts` — hook compartilhado pra setup de pin com gating mobile/reduced-motion via `gsap.matchMedia()`

## Por ato — detalhe

### Ato 1 — HERO (pin ~1.5× viewport)

**Composição:**
- Reusa `<Hero>` atual (texto + WebGL veil)
- Wrapper de pin novo que segura a seção por 1.5× viewport
- Headline reveal: linhas entram em sequência via `clip-path: inset()` + GSAP timeline, scrubbed
- Subhead aparece depois, CTAs últimos com leve overshoot

**Saída pro Ato 2:**
- Conteúdo do hero (texto + CTAs) faz fade + scale-down enquanto particles convergem (uProgress já vai pra 1)
- Background canvas fica "respirando" no ponto de chegada (glyph) durante a transição

**Hand-off pro Ato 2 é narrativo, não visual contínuo** — o canvas WebGL é interno ao hero (não atravessa atos). O ATÉ 2 começa com o glyph já formado na hero, e o headline "Same transaction. Two realities." entra como nova cena. O único cross-section morph "físico" planejado é Ato 2 → Ato 3 (card direito do paradox vira "câmera" do engine).

### Ato 2 — PARADOX ★ (pin ~3× viewport)

**Decisão do usuário:** o ato 2 hospeda **um vídeo institucional/de produto como peça central** (em vez do split duo "WITHOUT/WITH ZK" como showpiece principal). O vídeo carrega o drama do paradoxo. O split sobrevive como **recap estático curto** depois do vídeo, pra quem não viu até o fim.

**Asset necessário:** vídeo MP4/WebM ~30–60s, mute-by-default, autoplay quando entra no viewport, com poster frame estático como fallback. **Usuário fornece o vídeo durante implementação** (link, arquivo, ou direção pra produzir).

**Composição em 3 fases scroll-driven (`ScrollTrigger.scrub`):**

**Fase 1 — Headline reveal (0–20%)**
- Eyebrow: "$9T moved in 2025. Until now, only one option."
- Headline: "Same transaction." → "Two realities."
- Tipografia gigante (`text-display-2xl`); palavras entram com `gsap.from` + stagger
- O quadro do vídeo aparece embaixo, ainda em estado "letterbox" / poster

**Fase 2 — Vídeo centerpiece (20–80%) ★**
- Vídeo escala pra ocupar o palco principal (transition: poster → playing). Border-radius generoso, sutil shadow forest, possivelmente caption embedded.
- **Playback pattern:** `IntersectionObserver` triggera `video.play()` quando o usuário entra na fase 2. Se `prefers-reduced-motion: reduce` ou conexão lenta, mostra apenas o poster + botão de play manual.
- **Opção avançada (deferida):** scroll-scrubbing do vídeo — `video.currentTime` segue `ScrollTrigger.progress`. Só vale se o vídeo tiver keyframes adequados (precisa testar). Default: autoplay normal, sem scrub.
- Áudio mute por padrão; usuário pode unmute via UI mínima (canto inferior do quadro do vídeo).
- Inspiração: hero video sections de Apple e Igloo Inc — o vídeo é a peça, a escala importa.

**Fase 3 — Recap + resolução (80–100%)**
- Vídeo encolhe pro canto / fade-out leve.
- Recap estático compacto aparece: 2 colunas pequenas "WITHOUT ZK" / "WITH ZK" com 3-4 fields cada, mostrando o contraste em formato resumido (sem o scroll-scrub complexo da versão original — agora é leitura rápida pós-vídeo).
- Texto de resolução: "Compliance e privacidade — impossível até 2025. Agora é só uma proof."
- Pin solta no final, transição pro Ato 3.

**Saída pro Ato 3:**
- Hand-off via fade limpo (não há mais o "card direito que vira câmera" — vídeo + recap conduzem o usuário).
- ScrollTrigger.create() encadeia: o `pin: true` do Ato 2 termina, o `pin: true` do Ato 3 começa, com matching de `start: "top top"`.

**Mobile / reduced motion:**
- Mobile: vídeo usa `playsInline`, autoplay mantido (com mute), sem pin. Recap empilha vertical.
- Reduced motion: vídeo NÃO autoplay; mostra poster + caption "▶ Play overview". Recap aparece imediatamente.

### Ato 3 — ENGINE ★ (pin ~3× viewport, layout sticky split)

**Composição:**
- Grid 12 col: `<aside>` esticado (col 1–6) + `<div>` rolando (col 7–12)
- Aside é pin'd com sticky behavior; conteúdo do `<div>` rola dentro do pin

**Aside (sticky, evolui com progress):**
- Diagrama 3-step animado em **SVG + GSAP** (sem WebGL extra — mantém budget de perf focado no hero)
- Fase A (0–33%): KYC issuer → Merkle tree root forma-se. Animação: nodes hash juntando em árvore, root publica on-chain.
- Fase B (33–66%): browser gera proof. Animação: timer 0→4.8s com count-up, micro-particles convergindo numa proof "sólida".
- Fase C (66–100%): on-chain transfer. Animação: cost ticker `$0.001`, 4 números explodem (181ms · <5s · $0.001 · 0 PII).

**Texto que rola (lado direito):**

```
1. Verify once.
   KYC issuer signs once. The Merkle tree root goes on-chain.
   You never expose a document again.

2. Prove anywhere.
   The browser generates a Groth16 proof in <5s.
   No server. No trust assumption.

3. Settle forever.
   The Transfer Hook verifies in $0.001 of compute.
   Audit trail lives forever.
```

Cada bloco em `card`/`article`. ScrollTrigger sincroniza qual capítulo está ativo com qual fase do diagrama.

**Final do Ato 3:**
- Mini-demo embarcada: botão `<button>Try it →</button>`. Click dispara animação rápida (fake mas convincente, baseada na lógica do `DemoSection` existente) — proof gera em ~2s simulados.
- Sai pro Ato 4 com fade.

### Ato 4 — MOVE (pin ~1.5× viewport)

**Composição em 3 fases:**

**Fase 1 — Code reveal (0–40%)**
- Background dark (`#0a0a0a` ou similar)
- Console grande mostrando typewriter:
  ```
  $ npm i @zksettle/sdk
  → zksettle.prove(credential)
  → zksettle.wrap(transferIx, proof)
  ```
- Cada linha digita char-by-char (não scroll-scrubbed; uma vez no viewport, dispara timeline)
- Output highlights em forest

**Fase 2 — Use case chips (40–70%)**
- Headline: "One primitive. Five markets."
- 6 chips compactos em wrap: Remittances · Payroll · DEX · Bridges · Institutional · Settlements
- Stagger reveal com `motion`/`whileInView`
- Cada chip pode ter tooltip on hover (não-bloqueante)

**Fase 3 — Closing CTA (70–100%)**
- Headline grande: "Compliance is no longer a six-month moat."
- Sub: "It's an SDK. Integrate in an afternoon."
- Dual CTAs: "Read the docs →" (primary) + "Talk to founders" (ghost)

**Footer abaixo (não-pinned):**
- Logo + tagline
- 3 links: Docs · GitHub · Twitter
- Bottom rule: "Built for the Colosseum Frontier 2026 · Solana"

## Smooth scroll provider

Componente: `<SmoothScrollProvider>` (client component)

**Responsabilidades:**
1. Inicializar Lenis no mount
2. RAF loop conectado a `lenis.raf` + `gsap.ticker`
3. Configurar `ScrollTrigger.scrollerProxy(window, { ... })` com Lenis como scroll source
4. Cleanup no unmount: `lenis.destroy()` + `ScrollTrigger.killAll()`
5. Respeitar `prefers-reduced-motion`: se reduzido, não inicializar Lenis (deixa scroll nativo)

**Wrapping pattern:**
```tsx
"use client";
export function SmoothScrollProvider({ children }: { children: React.ReactNode }) {
  // useGSAP-based lifecycle
  return <>{children}</>;
}
```

Inserido no `app/layout.tsx` ou diretamente no `app/page.tsx` envolvendo os atos.

## Hook compartilhado: `useActPin`

Cada ato repete a mesma plumbing: setup de ScrollTrigger.create com pin, gating por mobile/reduced-motion, cleanup. Centralizar:

```tsx
// frontend/src/components/landing/acts/use-act-pin.ts
export function useActPin(
  containerRef: RefObject<HTMLElement>,
  options: { duration: string; onUpdate?: (progress: number) => void }
) {
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add({
      isDesktop: "(min-width: 768px) and (prefers-reduced-motion: no-preference)",
    }, (ctx) => {
      if (!ctx.conditions?.isDesktop) return;
      ScrollTrigger.create({
        trigger: containerRef.current,
        start: "top top",
        end: options.duration, // e.g. "+=300%"
        pin: true,
        scrub: 0.5,
        onUpdate: options.onUpdate,
      });
    });
    return () => mm.revert();
  }, []);
}
```

## Mobile estratégia

**Em `< 768px`:** `gsap.matchMedia` exclude → pin nunca instala. Cada Ato vira um stack vertical normal:
- Ato 1: hero atual
- Ato 2: as 3 fases viram seções verticais subsequentes (headline, split duo lado a lado vira empilhado, resolução)
- Ato 3: aside vira topo da seção, texto rola embaixo
- Ato 4: 3 fases empilhadas

**FadeIn já existente** (Framer Motion `whileInView`) cobre todas as entries.

**Conteúdo paritário** — usuário mobile não perde info, só perde o filme.

## Reduced motion

`gsap.matchMedia()` checa `prefers-reduced-motion: no-preference`. Se reduzido:
- Lenis não inicializa (scroll nativo)
- Pin não instala
- Scrub não roda
- Animações `motion` (Framer) já respeitam via `useReducedMotion`
- Hero veil já respeita (frame único, sem rAF)

Resultado: layout estático com texto/cards visíveis. Zero animação.

## Performance

**Riscos:**
- WebGL canvas + Lenis + 4 ScrollTrigger.scrub simultâneos podem causar jank em GPUs fracas.
- Múltiplos `gsap.timeline` rodando podem competir.

**Mitigação:**
- WebGL veil já tem FPS monitor + tier degradation + halo toggle (feito na PR anterior)
- ScrollTrigger.create com `scrub: 0.5` (já com damping) em vez de `scrub: true`
- `will-change` SOMENTE durante a animação ativa (Lenis manage transform isolation)
- IntersectionObserver no hero veil pausa rAF fora do viewport (feito)
- Lighthouse perf budget: TBT < 200ms, CLS < 0.05 — testar em throttle 4× CPU

**Componentes a verificar com FPS monitor:**
- Ato 2 split duo (vários nodes animados em scrub)
- Ato 3 sticky split com possível WebGL adicional

Se Ato 3 ficar pesado, fallback é SVG-only no diagrama (sem WebGL extra).

## Copy — o que muda

**Preservar 90%** do copy atual em `frontend/src/content/copy.ts`. Reorganizar por ato:

```ts
export const COPY = {
  hero: { /* existente */ },
  paradox: {
    eyebrow: "$9T moved in 2025. Until now, only one option.",
    headline: "Same transaction. Two realities.",
    leftLabel: "Without ZK",
    rightLabel: "With ZK",
    // 6-8 fields cada: name, document, amount, recipient, jurisdiction, timestamp.
    // leftFields preserva valores PII; rightFields os mostra como hash/commitment.
    leftFields: [/* migrar do TwoRealitiesSection atual */],
    rightFields: [/* migrar do TwoRealitiesSection atual */],
    closer: "Compliance e privacidade — impossível até 2025. Agora é só uma proof.",
  },
  engine: {
    eyebrow: "How it works",
    headline: "Verify once. Prove anywhere. Settle forever.",
    // Cada chapter: title + body 2-3 linhas. Migrar conteúdo do HowItWorksSection atual.
    chapters: [
      { title: "Verify once.", body: "..." },
      { title: "Prove anywhere.", body: "..." },
      { title: "Settle forever.", body: "..." },
    ],
    benchmarks: [
      { value: "181ms", label: "Settlement" },
      { value: "<5s", label: "Proof generation" },
      { value: "$0.001", label: "Verify cost" },
      { value: "0", label: "PII leaked" },
    ],
  },
  move: {
    // Migrar do DevelopersSection: 3 linhas TS install + prove + wrap.
    code: { lines: [/* npm i + prove + wrap */] },
    useCases: ["Remittances", "Payroll", "DEX", "Bridges", "Institutional", "Settlements"],
    closer: {
      headline: "Compliance is no longer a six-month moat.",
      sub: "It's an SDK. Integrate in an afternoon.",
      ctas: {
        primary: { label: "Read the docs →", href: "/docs" },
        secondary: { label: "Talk to founders", href: "mailto:..." },
      },
    },
  },
};
```

O conteúdo concreto dos `leftFields`/`rightFields`/`chapters`/`code.lines` migra direto dos componentes atuais (`TwoRealitiesSection`, `HowItWorksSection`, `DevelopersSection`) — não inventar copy nova durante implementação. Headlines/eyebrows podem precisar de polimento conforme a gente vê o motion ao vivo.

## Verificação / aceitação

**Visual (`pnpm dev`, navegador desktop):**
1. Carregar `/`. Hero aparece, particles flutuam com flow ambiente. Headline reveal cinematográfico ao começar a rolar.
2. Scroll lento atravessa Ato 1 → 2 sem corte abrupto.
3. Ato 2 prende a tela; o split duo dissolve em scrub. Ao soltar, Ato 3 começa.
4. Ato 3 tem sticky split correto: aside fixo, texto rolando, capítulos sincronizam com fases do diagrama.
5. Ato 4 entra com code reveal, chips, closing CTA. Footer abaixo.
6. Total de scroll ~9-11× viewport (esperado pra full cinema com 4 pins).

**Mobile (DevTools < 768px):**
7. Pin desabilita; tudo vira lista vertical.
8. Conteúdo paritário ao desktop, sem perda.

**Acessibilidade:**
9. `prefers-reduced-motion: reduce` desliga Lenis + pin + scrub. Layout legível, links acessíveis via tab.
10. Lighthouse Accessibility ≥ 95.

**Performance:**
11. Lighthouse Performance ≥ 80 desktop, ≥ 60 mobile.
12. CPU 4× throttle: scroll continua suave (jank < 200ms TBT).
13. WebGL veil mantém ≥ 50 FPS na maior parte do tempo (FPS monitor degrada se necessário).

**Regressões:**
14. Componentes reusáveis (`Section`, `SectionHeader`, `DisplayHeading`, `FadeIn`, `CountUp`, `ProofConsole`) continuam funcionando se outras páginas (dashboard, docs) os usarem.
15. Tokens CSS (`--color-forest`, `--color-stone` etc.) seguem aplicáveis.

## Escopo fora desse spec

- Página `/dashboard`, `/docs` e qualquer outra rota. Apenas `/` (landing) muda.
- Internacionalização. Copy permanece em PT-EN misturado como hoje.
- Atualizações no veil canvas além do que foi feito na PR anterior (já entregue).
- **Produção do vídeo do Ato 2.** Usuário fornece o asset (.mp4/.webm + poster .jpg). Implementação assume que vídeo existe ou usa placeholder enquanto não chega.
- **Ilustrações/diagramas custom.** Se Ato 3 precisar de ilustração específica para o diagrama 3-step, pedir ao usuário durante implementação. Default: SVG geométrico estilo Privy (linhas finas, formas simples, sombra discreta).
