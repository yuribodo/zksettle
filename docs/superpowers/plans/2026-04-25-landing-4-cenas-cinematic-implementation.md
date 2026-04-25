# Landing 4 cenas cinematic — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reescrever a landing page (`/`) consolidando 10+ seções em 4 atos pinados (full cinematic), com Lenis smooth scroll, GSAP ScrollTrigger pinning, motion sincronizado ao scroll, e respeitando mobile + reduced-motion.

**Architecture:** Cada ato é um componente React em `frontend/src/components/landing/acts/` que envolve um wrapper de pin (via `useActPin` hook centralizado). Lenis roda como provider global (`SmoothScrollProvider`) e fornece o scroll source para `ScrollTrigger.scrollerProxy`. Mobile (`< 768px`) e `prefers-reduced-motion` gateiam a animação via `gsap.matchMedia()`. A página é refatorada incrementalmente — cada fase ship uma versão funcional.

**Tech Stack:** Next.js 15 (App Router) + React 19 · Lenis · GSAP 3.15 + ScrollTrigger · @gsap/react (`useGSAP`) · motion (Framer) v12 · Tailwind v4 · Three.js (hero veil, já feito) · Vitest + Testing Library · pnpm.

**Spec de origem:** `docs/superpowers/specs/2026-04-25-landing-4-cenas-cinematic-design.md`. Ler antes de começar.

---

## Phase 1 — Foundation (Lenis + provider + hooks + copy)

Objetivo: instalar dependências, criar a infraestrutura de scroll, sem ainda mexer nas seções. No fim da fase a página continua exatamente como hoje, mas o Lenis está rodando.

### Task 1.1: Instalar dependências

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Adicionar pacotes**

```bash
cd /home/mario/zksettle/frontend && pnpm add lenis @gsap/react
```

Pacotes adicionados:
- `lenis` (smooth scroll)
- `@gsap/react` (hook `useGSAP` com cleanup automático compatível com React 19 strict mode)

- [ ] **Step 2: Verificar instalação**

```bash
cd /home/mario/zksettle/frontend && pnpm list lenis @gsap/react
```

Esperado: lista ambos com versões resolvidas.

- [ ] **Step 3: Commit**

```bash
git add frontend/package.json frontend/pnpm-lock.yaml
git commit -m "feat(landing): add lenis and @gsap/react deps"
```

---

### Task 1.2: Criar `SmoothScrollProvider`

**Files:**
- Create: `frontend/src/components/landing/smooth-scroll-provider.tsx`
- Test: `frontend/src/components/landing/smooth-scroll-provider.test.tsx`

- [ ] **Step 1: Escrever teste falhando**

```tsx
// frontend/src/components/landing/smooth-scroll-provider.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SmoothScrollProvider } from "./smooth-scroll-provider";

vi.mock("lenis", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      raf: vi.fn(),
      destroy: vi.fn(),
      on: vi.fn(),
    })),
  };
});

describe("SmoothScrollProvider", () => {
  it("renderiza children", () => {
    render(
      <SmoothScrollProvider>
        <div data-testid="child">hello</div>
      </SmoothScrollProvider>,
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar teste pra confirmar falha**

```bash
cd /home/mario/zksettle/frontend && pnpm test smooth-scroll-provider
```

Esperado: FAIL — module não existe.

- [ ] **Step 3: Implementar provider**

```tsx
// frontend/src/components/landing/smooth-scroll-provider.tsx
"use client";

import { useEffect, type ReactNode } from "react";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { useReducedMotion } from "@/hooks/use-reduced-motion";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export function SmoothScrollProvider({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    });

    lenis.on("scroll", ScrollTrigger.update);

    const tickerCallback = (time: number) => {
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(tickerCallback);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(tickerCallback);
      lenis.destroy();
    };
  }, [reduceMotion]);

  return <>{children}</>;
}
```

- [ ] **Step 4: Rodar teste pra confirmar pass**

```bash
cd /home/mario/zksettle/frontend && pnpm test smooth-scroll-provider
```

Esperado: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/landing/smooth-scroll-provider.tsx frontend/src/components/landing/smooth-scroll-provider.test.tsx
git commit -m "feat(landing): add SmoothScrollProvider with Lenis + ScrollTrigger sync"
```

---

### Task 1.3: Wire `SmoothScrollProvider` na página

**Files:**
- Modify: `frontend/src/app/page.tsx`

- [ ] **Step 1: Ler estado atual do `page.tsx`**

Ler o arquivo. Identificar onde envolver o conteúdo da landing com `<SmoothScrollProvider>`.

- [ ] **Step 2: Importar provider e envolver `<main>`**

Adicionar `import { SmoothScrollProvider } from "@/components/landing/smooth-scroll-provider";` no topo, e envolver o `<main>` (ou equivalente) com `<SmoothScrollProvider>...</SmoothScrollProvider>`.

- [ ] **Step 3: Verificar typecheck e lint**

```bash
cd /home/mario/zksettle/frontend && pnpm typecheck && pnpm lint
```

Esperado: ambos limpos.

- [ ] **Step 4: Verificação visual**

```bash
cd /home/mario/zksettle/frontend && pnpm dev
```

Abrir `http://localhost:3000` (ou 3001 se ocupado). Scrollar a landing — confirmar que tem **easing de smooth scroll** (movimento mais suave que o nativo). DevTools → Console: sem erros.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/page.tsx
git commit -m "feat(landing): wire SmoothScrollProvider into page"
```

---

### Task 1.4: Criar hook `useActPin`

**Files:**
- Create: `frontend/src/components/landing/acts/use-act-pin.ts`
- Create: `frontend/src/components/landing/acts/index.ts` (barrel — opcional, mas útil)

- [ ] **Step 1: Implementar hook**

```ts
// frontend/src/components/landing/acts/use-act-pin.ts
"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { type RefObject } from "react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

type UseActPinOptions = {
  /** ScrollTrigger end value, e.g. "+=150%" for 1.5x viewport pin duration. */
  duration: string;
  /** Optional progress callback (0..1) called on each scrub frame. */
  onUpdate?: (progress: number) => void;
  /** Optional scrub damping (default 0.5). */
  scrub?: number | boolean;
};

export function useActPin(
  containerRef: RefObject<HTMLElement | null>,
  { duration, onUpdate, scrub = 0.5 }: UseActPinOptions,
) {
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(
        {
          isDesktop:
            "(min-width: 768px) and (prefers-reduced-motion: no-preference)",
        },
        (ctx) => {
          if (!ctx.conditions?.isDesktop) return;
          const trigger = containerRef.current;
          if (!trigger) return;

          ScrollTrigger.create({
            trigger,
            start: "top top",
            end: duration,
            pin: true,
            scrub,
            onUpdate: (self) => onUpdate?.(self.progress),
          });
        },
      );
      return () => mm.revert();
    },
    { scope: containerRef },
  );
}
```

- [ ] **Step 2: Criar barrel index**

```ts
// frontend/src/components/landing/acts/index.ts
export { useActPin } from "./use-act-pin";
```

- [ ] **Step 3: Verificar typecheck**

```bash
cd /home/mario/zksettle/frontend && pnpm typecheck
```

Esperado: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/landing/acts/
git commit -m "feat(landing): add useActPin hook with matchMedia gating"
```

---

### Task 1.5: Atualizar `copy.ts` com estrutura por ato

**Files:**
- Modify: `frontend/src/content/copy.ts` (ou `.tsx` — verificar extensão)

- [ ] **Step 1: Ler copy atual**

Ler `frontend/src/content/copy.ts` (ou similar). Identificar todos os blocos: hero, paradox, twoRealities, howItWorks, numbers, demo, useCases, developers, momentum, closingCta.

- [ ] **Step 2: Adicionar blocos `paradox` (act 2), `engine` (act 3), `move` (act 4)**

No final do objeto `COPY`, adicionar:

```ts
export const COPY = {
  // ... blocos existentes preservados ...

  paradox: {
    eyebrow: "$9T moved in 2025. Until now, only one option.",
    headline: ["Same transaction.", "Two realities."] as const,
    closer:
      "Compliance e privacidade — impossível até 2025. Agora é só uma proof.",
    // recap fields migram do TwoRealitiesSection durante Phase 3
    leftLabel: "Without ZK",
    rightLabel: "With ZK",
  },

  engine: {
    eyebrow: "How it works",
    headline: "Verify once. Prove anywhere. Settle forever.",
    chapters: [
      {
        title: "Verify once.",
        body:
          "KYC issuer signs once. The Merkle tree root goes on-chain. You never expose a document again.",
      },
      {
        title: "Prove anywhere.",
        body:
          "The browser generates a Groth16 proof in <5s. No server. No trust assumption.",
      },
      {
        title: "Settle forever.",
        body:
          "The Transfer Hook verifies in $0.001 of compute. Audit trail lives forever.",
      },
    ],
    benchmarks: [
      { value: "181ms", label: "Settlement" },
      { value: "<5s", label: "Proof generation" },
      { value: "$0.001", label: "Verify cost" },
      { value: "0", label: "PII leaked" },
    ],
    demoCta: "Try it →",
  },

  move: {
    code: {
      label: "Three lines.",
      lines: [
        "$ npm i @zksettle/sdk",
        "→ zksettle.prove(credential)",
        "→ zksettle.wrap(transferIx, proof)",
      ] as const,
    },
    useCases: [
      "Remittances",
      "Payroll",
      "DEX",
      "Bridges",
      "Institutional",
      "Settlements",
    ] as const,
    closer: {
      headline: "Compliance is no longer a six-month moat.",
      sub: "It's an SDK. Integrate in an afternoon.",
      ctas: {
        primary: { label: "Read the docs →", href: "/docs" },
        secondary: { label: "Talk to founders", href: "mailto:hello@zksettle.dev" },
      },
    },
  },
} as const;
```

NÃO remover ainda os blocos antigos (`paradox`, `twoRealities`, `howItWorks`, etc. já existentes) — eles ainda são usados pelos componentes legados durante a transição. Ajustar nome do novo bloco `paradox` se conflitar — usar `paradoxAct` se necessário.

- [ ] **Step 3: Typecheck**

```bash
cd /home/mario/zksettle/frontend && pnpm typecheck
```

Esperado: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/content/copy.ts
git commit -m "feat(landing): add new copy blocks for 4-act structure"
```

---

## Phase 2 — Act 1 (Hero pin)

Objetivo: pinar o hero atual por 1.5× viewport e adicionar headline reveal cinematográfico, sem mexer no veil canvas (já entregue).

### Task 2.1: Criar `ActOneHero` wrapper

**Files:**
- Create: `frontend/src/components/landing/acts/act-one-hero.tsx`

- [ ] **Step 1: Implementar wrapper**

```tsx
// frontend/src/components/landing/acts/act-one-hero.tsx
"use client";

import { useRef } from "react";

import { Hero } from "@/components/landing/hero/hero";

import { useActPin } from "./use-act-pin";

export function ActOneHero() {
  const containerRef = useRef<HTMLDivElement>(null);

  useActPin(containerRef, {
    duration: "+=150%", // pin por 1.5× viewport
  });

  return (
    <div ref={containerRef} className="relative">
      <Hero />
    </div>
  );
}
```

- [ ] **Step 2: Adicionar export ao barrel**

Editar `frontend/src/components/landing/acts/index.ts`:

```ts
export { useActPin } from "./use-act-pin";
export { ActOneHero } from "./act-one-hero";
```

- [ ] **Step 3: Substituir `<Hero />` por `<ActOneHero />` em `page.tsx`**

Onde estiver `import { Hero } from "@/components/landing/hero/hero"` e `<Hero />`, trocar por `import { ActOneHero } from "@/components/landing/acts"` e `<ActOneHero />`.

- [ ] **Step 4: Typecheck + lint**

```bash
cd /home/mario/zksettle/frontend && pnpm typecheck && pnpm lint
```

Esperado: PASS.

- [ ] **Step 5: Verificação visual**

```bash
cd /home/mario/zksettle/frontend && pnpm dev
```

Abrir `/`. Scrollar lentamente — o hero deve **ficar fixo na tela enquanto você scrolla por ~1.5 viewports**, depois soltar pra próxima seção. Mobile (< 768px no DevTools): hero scrolla normal sem pin.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/landing/acts/act-one-hero.tsx frontend/src/components/landing/acts/index.ts frontend/src/app/page.tsx
git commit -m "feat(landing): pin hero in act-one wrapper"
```

---

### Task 2.2: Adicionar headline reveal cinematográfico

**Files:**
- Modify: `frontend/src/components/landing/hero/hero.tsx`

- [ ] **Step 1: Importar `useGSAP` e refs**

Adicionar `"use client"` no topo se não tiver. Importar:

```tsx
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { useRef } from "react";
```

- [ ] **Step 2: Implementar reveal por linha**

Refatorar o JSX do headline pra usar refs em cada linha (ou um único ref pai). Usar `useGSAP` pra animar:

```tsx
const headlineRef = useRef<HTMLHeadingElement>(null);

useGSAP(
  () => {
    const lines = headlineRef.current?.querySelectorAll("[data-line]");
    if (!lines || lines.length === 0) return;
    gsap.from(lines, {
      yPercent: 100,
      opacity: 0,
      duration: 1.0,
      stagger: 0.15,
      ease: "expo.out",
    });
  },
  { scope: headlineRef },
);
```

E no JSX, dividir o headline em spans com `data-line`:

```tsx
<DisplayHeading id="hero-heading" level="xl" className="max-w-[18ch]" ref={headlineRef}>
  {headline.split(",").map((part, i) => (
    <span key={i} data-line className="block overflow-hidden">
      <span className="inline-block">{part}{i === 0 ? "," : ""}</span>
    </span>
  ))}
</DisplayHeading>
```

(Ajustar split conforme o copy do headline atual — talvez já seja split em duas linhas pelo design, então split por palavras-chave manuais.)

- [ ] **Step 3: Verificação visual**

Recarregar `/`. Confirmar que ao carregar/entrar no hero, as linhas do headline **entram em sequência** com slide-up + fade. CTAs aparecem logo após.

- [ ] **Step 4: Reduced motion check**

Em DevTools → Rendering → Emulate `prefers-reduced-motion: reduce`. Recarregar — animação não deve disparar (ou aplicar uma versão estática). Atualmente o `useGSAP` não respeita por default — wrap dentro de `gsap.matchMedia()` se necessário, ou usar o hook `useReducedMotion` existente pra pular.

Adicionar:

```tsx
const reduceMotion = useReducedMotion();
useGSAP(
  () => {
    if (reduceMotion) return;
    // ... animação ...
  },
  { scope: headlineRef, dependencies: [reduceMotion] },
);
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/landing/hero/hero.tsx
git commit -m "feat(landing): cinematic headline reveal in hero"
```

---

## Phase 3 — Act 2 (Paradox + Video centerpiece)

Objetivo: substituir `ParadoxSection` + `TwoRealitiesSection` por `ActTwoParadox` com vídeo central + recap estático.

### Task 3.1: Criar estrutura base de `ActTwoParadox`

**Files:**
- Create: `frontend/src/components/landing/acts/act-two-paradox.tsx`

- [ ] **Step 1: Implementar shell com 3 fases**

```tsx
// frontend/src/components/landing/acts/act-two-paradox.tsx
"use client";

import { useRef, useState } from "react";

import { COPY } from "@/content/copy";
import { DisplayHeading } from "@/components/ui/display-heading";

import { useActPin } from "./use-act-pin";

const ACT_DURATION = "+=300%"; // 3× viewport

export function ActTwoParadox() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useActPin(containerRef, {
    duration: ACT_DURATION,
    onUpdate: setProgress,
  });

  const { eyebrow, headline, closer } = COPY.paradox;

  return (
    <section
      ref={containerRef}
      aria-labelledby="act-two-heading"
      className="relative isolate min-h-screen overflow-hidden bg-canvas"
    >
      <div className="absolute inset-0 mx-auto flex max-w-6xl flex-col justify-center gap-10 px-5 py-24 md:px-8">
        <p className="font-mono text-xs uppercase tracking-[0.08em] text-stone">
          {eyebrow}
        </p>

        <DisplayHeading id="act-two-heading" level="xl" className="max-w-[18ch]">
          {headline.map((line, i) => (
            <span key={i} className="block">
              {line}
            </span>
          ))}
        </DisplayHeading>

        {/* Video centerpiece — Phase 3.2 */}
        <ActTwoVideo progress={progress} />

        {/* Recap — Phase 3.3 */}
        <ActTwoRecap progress={progress} />

        <p className="max-w-[55ch] text-lg leading-relaxed text-quill md:text-xl">
          {closer}
        </p>
      </div>
    </section>
  );
}

function ActTwoVideo({ progress }: { progress: number }) {
  // Implementação no Task 3.2
  return null;
}

function ActTwoRecap({ progress }: { progress: number }) {
  // Implementação no Task 3.3
  return null;
}
```

- [ ] **Step 2: Adicionar ao barrel + page.tsx**

Editar `frontend/src/components/landing/acts/index.ts` adicionando `export { ActTwoParadox } from "./act-two-paradox";`.

Em `page.tsx`, **temporariamente** adicionar `<ActTwoParadox />` LOGO ABAIXO do `<ActOneHero />`, **antes** das seções legadas (Paradox + TwoRealities). Não remover as legadas ainda — usar pra comparar visualmente.

- [ ] **Step 3: Typecheck**

```bash
cd /home/mario/zksettle/frontend && pnpm typecheck
```

Esperado: PASS.

- [ ] **Step 4: Verificação visual**

`pnpm dev`. Confirmar:
- Hero pina ✓
- Logo após, ActTwoParadox aparece, pina por 3× viewport com headline + eyebrow visíveis
- Em seguida, as seções legadas (Paradox + TwoRealities) ainda aparecem normalmente

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/landing/acts/act-two-paradox.tsx frontend/src/components/landing/acts/index.ts frontend/src/app/page.tsx
git commit -m "feat(landing): scaffold ActTwoParadox with pin shell"
```

---

### Task 3.2: Implementar `ActTwoVideo` (vídeo centerpiece)

**Files:**
- Modify: `frontend/src/components/landing/acts/act-two-paradox.tsx`
- **Asset necessário:** `frontend/public/videos/paradox-centerpiece.mp4` + `frontend/public/videos/paradox-centerpiece-poster.jpg` — pedir ao usuário durante esse task. Enquanto não chega, usar placeholder de `https://placehold.co/...` ou um vídeo creative-commons curto.

- [ ] **Step 1: Solicitar/preparar asset**

Antes de codar, perguntar ao usuário pelos arquivos de vídeo + poster e adicionar em `frontend/public/videos/`.

Se ainda não há vídeo final, usar placeholder:
```bash
mkdir -p frontend/public/videos
# placeholder via creative commons ou um vídeo do user
# ex.: https://www.w3schools.com/html/mov_bbb.mp4 (apenas pra dev)
```

- [ ] **Step 2: Implementar `ActTwoVideo`**

Substituir o stub no `act-two-paradox.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";

import { useReducedMotion } from "@/hooks/use-reduced-motion";

function ActTwoVideo({ progress }: { progress: number }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const reduceMotion = useReducedMotion();
  const [autoplayed, setAutoplayed] = useState(false);

  // Trigger autoplay when phase 2 enters (progress crosses 0.20).
  useEffect(() => {
    if (reduceMotion || autoplayed) return;
    if (progress > 0.2 && videoRef.current) {
      videoRef.current.play().catch(() => {
        // autoplay blocked — user precisa clicar em play
      });
      setAutoplayed(true);
    }
  }, [progress, reduceMotion, autoplayed]);

  // Scale + opacity baseado em progress entre 0.2 (entrada) e 0.8 (saída pro recap)
  const phaseProgress = Math.min(Math.max((progress - 0.2) / 0.6, 0), 1);
  const scale = 0.92 + phaseProgress * 0.08;
  const opacity = phaseProgress < 0.95 ? 1 : 1 - (phaseProgress - 0.95) * 20;

  return (
    <div
      className="relative mx-auto w-full max-w-4xl rounded-[var(--radius-6)] overflow-hidden shadow-xl"
      style={{ transform: `scale(${scale})`, opacity, transition: "transform 0.1s linear" }}
    >
      <video
        ref={videoRef}
        src="/videos/paradox-centerpiece.mp4"
        poster="/videos/paradox-centerpiece-poster.jpg"
        muted
        playsInline
        preload="metadata"
        className="h-auto w-full"
        controls={reduceMotion}
      />
    </div>
  );
}
```

- [ ] **Step 3: Typecheck + lint**

```bash
cd /home/mario/zksettle/frontend && pnpm typecheck && pnpm lint
```

Esperado: PASS.

- [ ] **Step 4: Verificação visual**

`pnpm dev`. Scrollar até o ActTwoParadox. Confirmar:
- Vídeo aparece centralizado
- Autoplay (mute) ao entrar na fase 2
- Scale leve conforme avança
- Reduced motion: vídeo NÃO autoplay, mostra controles

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/landing/acts/act-two-paradox.tsx frontend/public/videos/
git commit -m "feat(landing): add video centerpiece to act 2"
```

---

### Task 3.3: Implementar `ActTwoRecap` (split estático curto)

**Files:**
- Modify: `frontend/src/components/landing/acts/act-two-paradox.tsx`

- [ ] **Step 1: Migrar dados de `TwoRealitiesSection` pra `copy.ts`**

Ler `frontend/src/components/landing/two-realities-section.tsx`. Extrair os 4-6 fields que ele compara (sem ZK / com ZK). Adicionar em `COPY.paradox`:

```ts
paradox: {
  // ... existente ...
  recap: {
    leftFields: [
      { key: "name", value: "Maria Silva", flag: "GDPR" },
      { key: "document", value: "123.456.789-00", flag: "LGPD" },
      // ... (migrar do TwoRealitiesSection atual)
    ],
    rightFields: [
      { key: "proof_hash", value: "0xa3f1...", flag: null },
      { key: "commitment", value: "0xb7e2...", flag: null },
      // ... (paralelo ao left, mas com hashes)
    ],
  },
},
```

- [ ] **Step 2: Implementar `ActTwoRecap`**

```tsx
import { COPY } from "@/content/copy";

function ActTwoRecap({ progress }: { progress: number }) {
  // Aparece quando progress > 0.8
  const recapProgress = Math.min(Math.max((progress - 0.8) / 0.18, 0), 1);
  const opacity = recapProgress;
  const yOffset = (1 - recapProgress) * 24;

  const { leftLabel, rightLabel, recap } = COPY.paradox;

  return (
    <div
      className="grid grid-cols-1 gap-6 md:grid-cols-2"
      style={{
        opacity,
        transform: `translateY(${yOffset}px)`,
        transition: "opacity 0.1s linear, transform 0.1s linear",
      }}
    >
      <RecapColumn label={leftLabel} fields={recap.leftFields} variant="without" />
      <RecapColumn label={rightLabel} fields={recap.rightFields} variant="with" />
    </div>
  );
}

type RecapField = { key: string; value: string; flag: string | null };

function RecapColumn({
  label,
  fields,
  variant,
}: {
  label: string;
  fields: readonly RecapField[];
  variant: "without" | "with";
}) {
  return (
    <article
      className={
        variant === "with"
          ? "rounded-[var(--radius-6)] border border-forest/20 bg-surface-deep p-6"
          : "rounded-[var(--radius-6)] border border-danger-text/20 bg-canvas p-6"
      }
    >
      <p className="font-mono text-xs uppercase tracking-[0.08em] text-stone">{label}</p>
      <dl className="mt-4 space-y-2 font-mono text-sm">
        {fields.map((f) => (
          <div key={f.key} className="flex justify-between gap-4">
            <dt className="text-stone">{f.key}:</dt>
            <dd className={variant === "without" ? "text-quill" : "text-forest"}>
              {f.value}
              {f.flag ? (
                <span className="ml-2 rounded-sm bg-danger-text/15 px-1 py-0.5 text-xs text-danger-text">
                  {f.flag}
                </span>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
    </article>
  );
}
```

Ajustar tokens CSS (`text-quill`, `text-forest`, `text-stone`, `text-danger-text`) conforme o que está disponível em `globals.css`.

- [ ] **Step 3: Verificação visual**

`pnpm dev`. Scrollar até o final do Act 2 — confirmar que o recap aparece com fade + slide-up depois do vídeo, mostrando os 2 cards de recapitulação.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/landing/acts/act-two-paradox.tsx frontend/src/content/copy.ts
git commit -m "feat(landing): add recap split to act 2"
```

---

### Task 3.4: Remover seções legadas (Paradox + TwoRealities) do `page.tsx`

**Files:**
- Modify: `frontend/src/app/page.tsx`

- [ ] **Step 1: Remover imports e tags legadas**

Remover `import { ParadoxSection } from "..."` e `<ParadoxSection />`. Remover `import { TwoRealitiesSection } from "..."` e `<TwoRealitiesSection />`. Manter `<ActTwoParadox />` no lugar.

- [ ] **Step 2: Typecheck**

```bash
cd /home/mario/zksettle/frontend && pnpm typecheck
```

Esperado: PASS.

- [ ] **Step 3: Verificação visual**

`/` deve ter agora: ActOneHero (pinned) → ActTwoParadox (pinned) → HowItWorks → Numbers → Demo → UseCases → Developers → Momentum → ClosingCta → Footer.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/page.tsx
git commit -m "feat(landing): remove legacy paradox + two-realities sections"
```

---

## Phase 4 — Act 3 (Engine sticky split)

Objetivo: substituir `HowItWorksSection` + `NumbersSection` + `DemoSection` por `ActThreeEngine` com sticky split (aside fixo + chapters rolando).

### Task 4.1: Criar shell `ActThreeEngine` com sticky split

**Files:**
- Create: `frontend/src/components/landing/acts/act-three-engine.tsx`

- [ ] **Step 1: Implementar layout grid sticky**

```tsx
// frontend/src/components/landing/acts/act-three-engine.tsx
"use client";

import { useRef, useState } from "react";

import { COPY } from "@/content/copy";
import { DisplayHeading } from "@/components/ui/display-heading";

import { useActPin } from "./use-act-pin";

const ACT_DURATION = "+=300%";

export function ActThreeEngine() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useActPin(containerRef, {
    duration: ACT_DURATION,
    onUpdate: setProgress,
  });

  const { eyebrow, headline, chapters, benchmarks } = COPY.engine;

  return (
    <section
      ref={containerRef}
      aria-labelledby="act-three-heading"
      className="relative isolate min-h-screen overflow-hidden bg-canvas"
    >
      <div className="absolute inset-0 mx-auto grid h-full max-w-6xl grid-cols-1 gap-12 px-5 py-24 md:grid-cols-12 md:px-8">

        {/* Aside fixo — visual evolui com progress */}
        <aside className="md:col-span-6 md:sticky md:top-24 md:self-start">
          <p className="font-mono text-xs uppercase tracking-[0.08em] text-stone">
            {eyebrow}
          </p>
          <DisplayHeading id="act-three-heading" level="l" className="mt-6">
            {headline}
          </DisplayHeading>
          <EngineDiagram progress={progress} benchmarks={benchmarks} />
        </aside>

        {/* Chapters rolando */}
        <div className="md:col-span-6 md:col-start-7 flex flex-col gap-32 pt-12 md:pt-32">
          {chapters.map((ch, i) => (
            <ChapterBlock key={ch.title} index={i} progress={progress} chapter={ch} />
          ))}
          <DemoButton progress={progress} />
        </div>
      </div>
    </section>
  );
}

function EngineDiagram(props: {
  progress: number;
  benchmarks: ReadonlyArray<{ value: string; label: string }>;
}) {
  // Implementação no Task 4.2
  return <div className="mt-8 h-64 rounded-md bg-surface-deep" aria-hidden />;
}

function ChapterBlock(props: {
  index: number;
  progress: number;
  chapter: { title: string; body: string };
}) {
  // Cada chapter ativa quando progress está em sua faixa (0–33, 33–66, 66–100)
  const start = props.index / 3;
  const end = (props.index + 1) / 3;
  const isActive = props.progress >= start && props.progress < end;
  return (
    <article
      className={`transition-opacity duration-300 ${isActive ? "opacity-100" : "opacity-30"}`}
    >
      <h3 className="text-3xl font-semibold tracking-tight md:text-4xl">{props.chapter.title}</h3>
      <p className="mt-4 max-w-prose text-lg leading-relaxed text-quill">{props.chapter.body}</p>
    </article>
  );
}

function DemoButton({ progress }: { progress: number }) {
  // Implementação no Task 4.3
  return null;
}
```

- [ ] **Step 2: Adicionar ao barrel + page.tsx**

Adicionar `export { ActThreeEngine } from "./act-three-engine";` em `acts/index.ts`. Em `page.tsx`, adicionar `<ActThreeEngine />` ANTES de `<HowItWorksSection />`.

- [ ] **Step 3: Typecheck**

```bash
cd /home/mario/zksettle/frontend && pnpm typecheck
```

- [ ] **Step 4: Verificação visual**

`/` agora tem ActThreeEngine pinado entre Act2 e HowItWorks legado. Confirmar:
- Aside (esquerda): eyebrow + headline + placeholder do diagrama (caixa cinza)
- Direita: 3 chapters scrolling internamente com fade conforme avança
- Mobile: tudo empilha vertical

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/landing/acts/act-three-engine.tsx frontend/src/components/landing/acts/index.ts frontend/src/app/page.tsx
git commit -m "feat(landing): scaffold ActThreeEngine sticky split"
```

---

### Task 4.2: Implementar `EngineDiagram` (SVG + GSAP, 3 fases)

**Files:**
- Modify: `frontend/src/components/landing/acts/act-three-engine.tsx`

- [ ] **Step 1: Substituir o stub `EngineDiagram`**

```tsx
function EngineDiagram({
  progress,
  benchmarks,
}: {
  progress: number;
  benchmarks: ReadonlyArray<{ value: string; label: string }>;
}) {
  // 3 fases: A=verify (0..0.33), B=prove (0.33..0.66), C=settle (0.66..1)
  const phaseA = Math.max(0, Math.min(1, progress / 0.33));
  const phaseB = Math.max(0, Math.min(1, (progress - 0.33) / 0.33));
  const phaseC = Math.max(0, Math.min(1, (progress - 0.66) / 0.34));

  return (
    <div className="mt-8 rounded-md bg-surface-deep p-8">
      <svg viewBox="0 0 320 200" className="w-full" aria-hidden>
        {/* Fase A: Merkle tree forming */}
        <g opacity={phaseA}>
          <circle cx="60" cy="40" r="6" fill="var(--color-stone)" />
          <circle cx="100" cy="40" r="6" fill="var(--color-stone)" />
          <line x1="60" y1="40" x2="80" y2="80" stroke="var(--color-stone)" strokeWidth="1.2" />
          <line x1="100" y1="40" x2="80" y2="80" stroke="var(--color-stone)" strokeWidth="1.2" />
          <circle cx="80" cy="80" r="8" fill="var(--color-forest)" />
          <text x="80" y="110" textAnchor="middle" fontSize="10" fill="var(--color-quill)">root</text>
        </g>

        {/* Fase B: proof generation timer */}
        <g opacity={phaseB} transform="translate(150 0)">
          <rect x="0" y="20" width="100" height="80" rx="6" fill="none" stroke="var(--color-forest)" strokeWidth="1.5" />
          <text x="50" y="50" textAnchor="middle" fontSize="14" fill="var(--color-forest)" fontFamily="ui-monospace, monospace">
            {(phaseB * 4.8).toFixed(1)}s
          </text>
          <text x="50" y="80" textAnchor="middle" fontSize="9" fill="var(--color-quill)">proving...</text>
        </g>

        {/* Fase C: 4 numbers explode */}
        <g opacity={phaseC} transform="translate(0 130)">
          {benchmarks.map((b, i) => (
            <g key={b.label} transform={`translate(${i * 80} 0)`}>
              <text x="40" y="20" textAnchor="middle" fontSize="14" fontWeight="700" fill="var(--color-forest)">
                {b.value}
              </text>
              <text x="40" y="40" textAnchor="middle" fontSize="8" fill="var(--color-stone)">
                {b.label}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
```

- [ ] **Step 2: Verificação visual**

Recarregar `/`. Scrollar pelo Act 3 — confirmar que o SVG no aside evolui conforme você avança: árvore Merkle aparece, depois timer counta, depois 4 números aparecem.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/landing/acts/act-three-engine.tsx
git commit -m "feat(landing): animated SVG engine diagram in act 3"
```

---

### Task 4.3: Implementar `DemoButton` (mini-demo embarcada)

**Files:**
- Modify: `frontend/src/components/landing/acts/act-three-engine.tsx`

- [ ] **Step 1: Implementar botão + animação fake**

```tsx
import { useState } from "react";
import { ProofConsole } from "@/components/landing/proof-console";

function DemoButton({ progress }: { progress: number }) {
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  // Aparece quando progress > 0.85
  const visible = progress > 0.85;

  function runDemo() {
    setRunning(true);
    setDone(false);
    setTimeout(() => {
      setRunning(false);
      setDone(true);
    }, 2000);
  }

  if (!visible) return null;

  return (
    <div className="mt-8 transition-opacity duration-500">
      <button
        type="button"
        onClick={runDemo}
        disabled={running}
        className="rounded-md bg-forest px-5 py-2 text-sm font-medium text-canvas hover:bg-forest-hover disabled:opacity-60"
      >
        {running ? "Generating proof..." : done ? "Generate again →" : "Try it →"}
      </button>
      {(running || done) ? (
        <div className="mt-4">
          <ProofConsole
            initial="$ zksettle.prove(credential)"
            lines={
              done
                ? [
                    { kind: "muted", text: "$ zksettle.prove(credential)" },
                    { kind: "ok", text: "[ok] credential verified (issuer: zk-mock-1)" },
                    { kind: "ok", text: "[ok] proof generated in 4.8s" },
                    { kind: "result", text: "proof: 0xa3f1...c7e2" },
                  ]
                : [
                    { kind: "muted", text: "$ zksettle.prove(credential)" },
                    { kind: "muted", text: "[..] proving..." },
                  ]
            }
          />
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Verificação visual**

Scrollar até quase o final do Act 3. Botão "Try it →" aparece. Click → mostra console "proving..." → após 2s mostra resultado fake.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/landing/acts/act-three-engine.tsx
git commit -m "feat(landing): mini-demo button in act 3"
```

---

### Task 4.4: Remover `HowItWorksSection`, `NumbersSection`, `DemoSection`

**Files:**
- Modify: `frontend/src/app/page.tsx`

- [ ] **Step 1: Remover imports + tags**

Remover `<HowItWorksSection />`, `<NumbersSection />`, `<DemoSection />` e seus imports. Manter `<ActThreeEngine />`.

- [ ] **Step 2: Typecheck + lint + visual**

```bash
cd /home/mario/zksettle/frontend && pnpm typecheck && pnpm lint && pnpm dev
```

`/` agora tem: ActOneHero → ActTwoParadox → ActThreeEngine → UseCases → Developers → Momentum → ClosingCta → Footer.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/page.tsx
git commit -m "feat(landing): remove how-it-works/numbers/demo legacy sections"
```

---

## Phase 5 — Act 4 (Move + closing)

Objetivo: substituir `DevelopersSection` + `UseCasesSection` + `MomentumSection` + `ClosingCta` por `ActFourMove`.

### Task 5.1: Criar `ActFourMove` shell + 3 fases

**Files:**
- Create: `frontend/src/components/landing/acts/act-four-move.tsx`

- [ ] **Step 1: Implementar componente completo**

```tsx
// frontend/src/components/landing/acts/act-four-move.tsx
"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { COPY } from "@/content/copy";
import { DisplayHeading } from "@/components/ui/display-heading";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { cn } from "@/lib/cn";

import { useActPin } from "./use-act-pin";

const ACT_DURATION = "+=150%";

export function ActFourMove() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useActPin(containerRef, {
    duration: ACT_DURATION,
    onUpdate: setProgress,
  });

  const { code, useCases, closer } = COPY.move;

  return (
    <section
      ref={containerRef}
      aria-labelledby="act-four-heading"
      className="relative isolate min-h-screen overflow-hidden bg-surface-deep text-canvas"
    >
      <div className="absolute inset-0 mx-auto flex max-w-6xl flex-col justify-center gap-16 px-5 py-24 md:px-8">
        <CodeReveal code={code} progress={progress} />
        <UseCaseChips useCases={useCases} progress={progress} />
        <ClosingCard closer={closer} progress={progress} />
      </div>
    </section>
  );
}

function CodeReveal({
  code,
  progress,
}: {
  code: { label: string; lines: ReadonlyArray<string> };
  progress: number;
}) {
  const reduceMotion = useReducedMotion();
  const [visibleLines, setVisibleLines] = useState(reduceMotion ? code.lines.length : 0);

  useEffect(() => {
    if (reduceMotion) return;
    if (progress < 0.05) {
      setVisibleLines(0);
      return;
    }
    // typewriter: line N revela em (0.05 + N*0.12)
    const target = Math.min(
      code.lines.length,
      Math.floor((progress - 0.05) / 0.12) + 1,
    );
    setVisibleLines(target);
  }, [progress, code.lines.length, reduceMotion]);

  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-[0.08em] text-stone">
        {code.label}
      </p>
      <pre className="mt-4 rounded-md bg-black/30 p-6 font-mono text-base text-forest">
        {code.lines.slice(0, visibleLines).map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </pre>
    </div>
  );
}

function UseCaseChips({
  useCases,
  progress,
}: {
  useCases: ReadonlyArray<string>;
  progress: number;
}) {
  // Aparece quando progress > 0.4
  const visible = progress > 0.4;
  return (
    <div
      className="flex flex-wrap gap-2 transition-opacity duration-500"
      style={{ opacity: visible ? 1 : 0 }}
    >
      {useCases.map((uc) => (
        <span
          key={uc}
          className="rounded-full border border-canvas/20 px-3 py-1 text-sm"
        >
          {uc}
        </span>
      ))}
    </div>
  );
}

function ClosingCard({
  closer,
  progress,
}: {
  closer: {
    headline: string;
    sub: string;
    ctas: {
      primary: { label: string; href: string };
      secondary: { label: string; href: string };
    };
  };
  progress: number;
}) {
  const visible = progress > 0.7;
  return (
    <div
      className="transition-opacity duration-500"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <DisplayHeading id="act-four-heading" level="l" className="max-w-[18ch]">
        {closer.headline}
      </DisplayHeading>
      <p className="mt-4 max-w-[55ch] text-lg text-canvas/80">{closer.sub}</p>
      <div className="mt-8 flex flex-wrap gap-4">
        <Link
          href={closer.ctas.primary.href}
          className={cn(buttonVariants({ variant: "primary", size: "lg" }))}
        >
          {closer.ctas.primary.label}
        </Link>
        <Link
          href={closer.ctas.secondary.href}
          className={cn(buttonVariants({ variant: "ghost", size: "lg" }))}
        >
          {closer.ctas.secondary.label}
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Adicionar ao barrel**

Editar `acts/index.ts` adicionando `export { ActFourMove } from "./act-four-move";`.

- [ ] **Step 3: Substituir em `page.tsx`**

Adicionar `<ActFourMove />` ANTES de `<DevelopersSection />`. Manter as legadas por enquanto.

- [ ] **Step 4: Verificação visual**

`/`: ActFourMove aparece pinada com fundo dark, code typewriter, chips, closing CTA.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/landing/acts/act-four-move.tsx frontend/src/components/landing/acts/index.ts frontend/src/app/page.tsx
git commit -m "feat(landing): scaffold ActFourMove with code/chips/closing"
```

---

### Task 5.2: Remover seções legadas Act 4

**Files:**
- Modify: `frontend/src/app/page.tsx`

- [ ] **Step 1: Remover imports + tags**

Remover `<UseCasesSection />`, `<DevelopersSection />`, `<MomentumSection />`, `<ClosingCta />` e imports. Manter `<ActFourMove />`.

- [ ] **Step 2: Verificação visual**

`/` agora: ActOneHero → ActTwoParadox → ActThreeEngine → ActFourMove → Footer.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/page.tsx
git commit -m "feat(landing): remove legacy use-cases/developers/momentum/closing-cta"
```

---

### Task 5.3: Atualizar Footer pra versão minimalista

**Files:**
- Modify: `frontend/src/components/landing/footer.tsx`

- [ ] **Step 1: Reescrever Footer minimal**

```tsx
// frontend/src/components/landing/footer.tsx
import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border-subtle py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-5 md:flex-row md:items-center md:px-8">
        <div className="flex items-center gap-3">
          <span className="font-display text-lg font-semibold tracking-tight">ZKSettle</span>
          <span className="text-sm text-stone">— compliance via proofs.</span>
        </div>
        <nav aria-label="Footer" className="flex gap-6 text-sm text-stone">
          <Link href="/docs" className="hover:text-quill">Docs</Link>
          <Link href="https://github.com/zksettle" className="hover:text-quill">GitHub</Link>
          <Link href="https://twitter.com/zksettle" className="hover:text-quill">Twitter</Link>
        </nav>
      </div>
      <p className="mx-auto mt-8 max-w-6xl px-5 text-xs text-stone md:px-8">
        Built for the Colosseum Frontier 2026 · Solana
      </p>
    </footer>
  );
}
```

Ajustar tokens (`text-stone`, `border-border-subtle`, `font-display`) se diferentes no projeto.

- [ ] **Step 2: Verificar visual**

Scrollar até o footer. Confirmar layout limpo: logo + tagline (esquerda), 3 links (direita), bottom rule.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/landing/footer.tsx
git commit -m "feat(landing): minimal footer (logo + 3 links + tagline)"
```

---

### Task 5.4: Atualizar Nav pra transparent fixed

**Files:**
- Modify: `frontend/src/components/landing/nav.tsx`
- Create: `frontend/src/components/landing/nav-scrolled.tsx` (opcional, se separar lógica)

- [ ] **Step 1: Adicionar lógica de scroll-aware backdrop**

Refatorar `Nav` (ou adicionar wrapper):

```tsx
"use client";

import { useEffect, useState } from "react";

export function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > window.innerHeight * 0.8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-border-subtle bg-canvas/80 backdrop-blur-md"
          : "bg-transparent"
      }`}
    >
      {/* ... resto do JSX existente do Nav ... */}
    </header>
  );
}
```

(Preservar o conteúdo interno do Nav atual — só envolver com a lógica de scrolled.)

- [ ] **Step 2: Verificar visual**

`/`: Nav transparent no hero. Scroll pra baixo — Nav ganha background branco/cinza com blur. Scroll pra cima — volta a ser transparente.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/landing/nav.tsx
git commit -m "feat(landing): transparent fixed nav with scrolled state"
```

---

## Phase 6 — Cleanup + verification final

Objetivo: remover componentes legados não usados, rodar verificações de a11y/perf/mobile/reduced-motion, ajustar polish final.

### Task 6.1: Remover componentes legados não-usados

**Files:**
- Delete: vários em `frontend/src/components/landing/`

- [ ] **Step 1: Identificar componentes órfãos**

```bash
cd /home/mario/zksettle/frontend && grep -rn "ParadoxSection\|TwoRealitiesSection\|HowItWorksSection\|NumbersSection\|DemoSection\|UseCasesSection\|DevelopersSection\|MomentumSection\|ClosingCta" src/ | grep -v ".test." | grep -v "// " | grep -v "// removed"
```

Se zero resultados (fora de comentários), são órfãos.

- [ ] **Step 2: Deletar arquivos órfãos**

```bash
cd /home/mario/zksettle/frontend
rm src/components/landing/paradox-section.tsx
rm src/components/landing/two-realities-section.tsx
rm src/components/landing/how-it-works-section.tsx
rm src/components/landing/numbers-section.tsx
rm src/components/landing/demo-section.tsx
rm src/components/landing/use-cases-section.tsx
rm src/components/landing/developers-section.tsx
rm src/components/landing/momentum-section.tsx
rm src/components/landing/closing-cta.tsx
```

(Confirmar nomes de arquivo antes — alguns podem estar em subpastas.)

- [ ] **Step 3: Remover blocos antigos do `copy.ts`**

Em `frontend/src/content/copy.ts`, remover blocos `paradox` antigo, `twoRealities`, `howItWorks`, `numbers`, `demo`, `useCases`, `developers`, `momentum`, `closingCta` se não forem mais referenciados em parte alguma.

```bash
cd /home/mario/zksettle/frontend && grep -rn "COPY\.\(twoRealities\|howItWorks\|numbers\|demo\|useCases\|developers\|momentum\|closingCta\)" src/
```

Se zero, remover do `copy.ts`.

- [ ] **Step 4: Typecheck + lint + test**

```bash
cd /home/mario/zksettle/frontend && pnpm typecheck && pnpm lint && pnpm test
```

Esperado: todos PASS. Se algum teste quebrar (ex.: testes de seções deletadas), remover os testes correspondentes.

- [ ] **Step 5: Commit**

```bash
git add -A frontend/src/
git commit -m "chore(landing): remove legacy section components and copy"
```

---

### Task 6.2: Verificação a11y

- [ ] **Step 1: Lighthouse Accessibility**

`pnpm dev`, abrir `/`, DevTools → Lighthouse → Accessibility category. Rodar.

Esperado: score ≥ 95. Corrigir quaisquer issues (labels faltando, contraste, headings).

- [ ] **Step 2: Keyboard navigation**

Fechar mouse. Usar somente Tab. Confirmar que:
- Skip-link aparece (se existir) → vai pro main
- CTAs do hero recebem focus visível
- Demo button (Act 3) é focusable
- CTAs do closing (Act 4) recebem focus
- Footer links navegáveis

Se algo não foca corretamente, ajustar `tabIndex` / botões reais (não divs).

- [ ] **Step 3: Screen reader spot check**

VoiceOver/NVDA/Orca: confirmar que cada `<section aria-labelledby>` lê o headline correspondente.

- [ ] **Step 4: Commit (se houve fix)**

```bash
git add -A
git commit -m "fix(landing): a11y polish from lighthouse + keyboard pass"
```

---

### Task 6.3: Verificação reduced-motion

- [ ] **Step 1: Emular reduced motion**

DevTools → Rendering → Emulate `prefers-reduced-motion: reduce`. Recarregar `/`.

Esperado:
- Lenis NÃO está rodando (scroll nativo)
- Pin NÃO instala (todas as seções rolam normais)
- Hero veil canvas: frame único (sem animação contínua) — comportamento já entregue
- Vídeo Act 2: NÃO autoplay; mostra controles
- Headline reveal Hero: estático (texto já visível)
- Code typewriter Act 4: tudo visível imediato

Se alguma animação ainda rola, ajustar o componente correspondente.

- [ ] **Step 2: Commit (se houve fix)**

```bash
git add -A
git commit -m "fix(landing): respect prefers-reduced-motion across acts"
```

---

### Task 6.4: Verificação mobile

- [ ] **Step 1: Emular mobile (DevTools → iPhone 14 ou Pixel 7)**

Recarregar `/`. Confirmar:
- Hero scrolla normal sem pin (já que `useActPin` gateia em `min-width: 768px`)
- Act 2: vídeo aparece, recap empilha vertical (não pin)
- Act 3: aside e chapters empilham (não sticky split)
- Act 4: code + chips + closing empilham
- Lenis: ATIVO (Lenis funciona em mobile)
- Footer: layout em coluna

Se algum layout quebra, adicionar breakpoints / ajustar grid.

- [ ] **Step 2: Touch scroll**

No emulador, usar drag + flick. Lenis deve dar smooth scroll natural. Sem jank.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "fix(landing): mobile layout and touch scroll polish"
```

---

### Task 6.5: Verificação performance

- [ ] **Step 1: Lighthouse Performance**

DevTools → Lighthouse → Performance (desktop). Rodar.

Targets:
- Performance score ≥ 80
- TBT < 200ms
- CLS < 0.05
- LCP < 2.5s

Se ficar abaixo:
- Verificar se Lenis ou GSAP estão sendo lazy-loaded onde possível
- Verificar tamanho do bundle (`pnpm build` + análise)
- WebGL veil já tem FPS monitor (entregue) — não deve degradar perf

- [ ] **Step 2: CPU 4× throttle**

DevTools → Performance → CPU 4× slowdown. Scrollar. Confirmar que:
- Sem jank visível (frames > 30fps)
- Pinning funciona corretamente
- Vídeo Act 2 não congela

- [ ] **Step 3: Commit (se houve otimização)**

```bash
git add -A
git commit -m "perf(landing): tighten bundle / lazy-load where applicable"
```

---

### Task 6.6: Smoke test final completo

- [ ] **Step 1: Build production**

```bash
cd /home/mario/zksettle/frontend && pnpm build
```

Esperado: build limpo, sem warnings críticos.

- [ ] **Step 2: Run production**

```bash
pnpm start
```

Abrir `/`. Confirmar comportamento idêntico ao dev: scroll smooth, 4 atos pinam, vídeo toca, demo button funciona, closing CTA navega.

- [ ] **Step 3: Test suite**

```bash
pnpm test
```

Esperado: 100% pass.

- [ ] **Step 4: Commit final**

```bash
git add -A
git commit --allow-empty -m "feat(landing): 4-cenas cinematic landing complete"
```

---

## Resumo de arquivos

**Criados:**
- `frontend/src/components/landing/smooth-scroll-provider.tsx` (+ test)
- `frontend/src/components/landing/acts/use-act-pin.ts`
- `frontend/src/components/landing/acts/index.ts`
- `frontend/src/components/landing/acts/act-one-hero.tsx`
- `frontend/src/components/landing/acts/act-two-paradox.tsx`
- `frontend/src/components/landing/acts/act-three-engine.tsx`
- `frontend/src/components/landing/acts/act-four-move.tsx`
- `frontend/public/videos/paradox-centerpiece.mp4` (+ poster) — usuário provê

**Modificados:**
- `frontend/package.json` (+ pnpm-lock.yaml)
- `frontend/src/app/page.tsx`
- `frontend/src/app/layout.tsx` (se SmoothScrollProvider for global)
- `frontend/src/content/copy.ts`
- `frontend/src/components/landing/hero/hero.tsx`
- `frontend/src/components/landing/footer.tsx`
- `frontend/src/components/landing/nav.tsx`

**Deletados (Phase 6):**
- `paradox-section.tsx`, `two-realities-section.tsx`, `how-it-works-section.tsx`, `numbers-section.tsx`, `demo-section.tsx`, `use-cases-section.tsx`, `developers-section.tsx`, `momentum-section.tsx`, `closing-cta.tsx`
