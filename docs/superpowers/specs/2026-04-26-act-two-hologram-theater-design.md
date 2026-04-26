# Act 2 — Hologram Theater Redesign

## Motivacao

O Act 2 atual (Paradox) e um slideshow de 3 fases pinado (headline -> video placeholder -> recap "Without/With ZK"). Problemas:
- Estrutura de 3 fases nao funciona — sente-se como slides discretos, nao uma cena
- Falta continuidade visual entre as fases
- Falta presenca/atmosfera — Acts 1 e 3 carregam clima (canvas WebGL, engine illustration), Act 2 fica "sem alma" no meio

## Decisoes de Design

- **Sem pin** — secao e `100vh`, scroll normal
- **Recap "Without/With ZK" removido** — nao sobrevive em nenhuma forma
- **Video fullbleed** — edge-to-edge, headline e closer sao overlays de texto
- **Shader hologram-glitch como atmosfera** — canvas WebGL fullbleed atras do video, intensidade media
- **Headline centralizado -> sobe** — headline comeca centralizado, migra pro topo quando video da play
- **Canvas WebGL separado** — fragment shader GLSL proprio, nao compartilha contexto com o hero

## Composicao e Layout

Uma secao `100vh` sem pin. Tres layers empilhadas via `position: absolute`:

1. **Layer 0 — Shader canvas** (`z-0`): `<canvas>` WebGL fullbleed com fragment shader hologram-glitch. Roda em loop, intensidade media (scan lines visiveis, micro-glitch a cada ~3-5s, RGB split leve constante). `requestAnimationFrame` pausa quando fora do viewport via `IntersectionObserver`.

2. **Layer 1 — Video** (`z-10`): `<video>` fullbleed, `object-fit: cover`, mute, autoplay trigado por `IntersectionObserver`. Poster frame estatico como fallback. `prefers-reduced-motion: reduce` -> mostra poster + botao play manual. Overlay escuro sutil (`bg-black/30`) pra dar contraste pro texto.

3. **Layer 2 — Texto** (`z-20`): headline centralizado + eyebrow em cima, closer no bottom. Quando o video entra, headline migra pro topo via CSS transition (`top: 50% -> top: ~8%`, `scale: 1 -> 0.8`, ~600ms ease-out).

**Enquanto video e TBD:** Layer 1 mostra um frame escuro com noise sutil (ou o proprio shader em opacidade reduzida), pra que a secao ja funcione visualmente sem o asset final.

## Shader — Fragment Shader Hologram-Glitch

**Uniforms:**
- `uTime` — clock pro loop
- `uResolution` — viewport size
- `uGlitchSeed` — random seed atualizado a cada ~3-5s pra triggerar micro-glitches

**Efeitos compostos no fragment shader:**
- **Scan lines** — `sin(gl_FragCoord.y * density + uTime * speed)` com multiplicador de opacidade. Linhas horizontais finas rolando pra cima lentamente.
- **RGB chromatic aberration** — offset sutil nos canais R e B (+/-2-3px), constante. Da o look "transmissao holografica".
- **Micro-glitch** — a cada 3-5s, uma faixa horizontal (~5-15% da altura) desloca X por ~10-30px durante 2-3 frames, com noise no canal de cor. Controlado por `step(threshold, fract(uTime * glitchFreq))`.
- **Base color** — gradiente escuro com tint levemente ciano/teal (alinhado com a paleta `forest` do projeto). Nao e um fundo solido — tem noise/grain pra dar textura.
- **Vignette** — escurece bordas pra focar atencao no centro (onde o video vai estar).

**Performance:**
- Single draw call (fullscreen quad + fragment shader)
- `requestAnimationFrame` com `IntersectionObserver` — pausa quando secao sai do viewport
- Fallback: se `WebGL` nao disponivel, mostra `div` com `background: radial-gradient(...)` + CSS scan lines via `repeating-linear-gradient`

## Headline e Texto

**Estado inicial (antes do video dar play):**
- Eyebrow: `"$9T moved in 2025. Until now, only one option."` — font-mono, xs, uppercase, tracking wide. Posicionado acima do headline.
- Headline: `"Same transaction. Two realities."` — `DisplayHeading` level `xl`, centralizado vertical e horizontalmente na secao. Branco com leve text-shadow pra contraste sobre o shader.

**Transicao (IntersectionObserver dispara):**
- Eyebrow faz fade-out (opacity 1->0, 400ms)
- Headline migra pro topo: `top: 50% -> top: 8%`, `scale: 1 -> 0.8`, 600ms ease-out
- Video comeca autoplay simultaneo

**Closer:**
- Aparece no bottom da secao com fade-in (delay ~1.5s apos o video iniciar)
- Texto curto, uma linha — algo como `"Compliance and privacy — one proof."`
- font-mono, sm, tracking wide, opacidade ~80%

## Comportamento e Edge Cases

**Autoplay:**
- `IntersectionObserver` com `threshold: 0.5` — dispara quando 50% da secao esta visivel
- Video: `muted autoplay playsinline` — necessario pra autoplay funcionar em mobile
- Unmute: icone discreto no canto inferior direito do video (speaker icon, opacidade baixa, hover revela)

**prefers-reduced-motion: reduce:**
- Shader: desliga glitch e scan line animation, mantem so a base estatica (gradiente + vignette + grain)
- Headline: sem transicao animada, ja comeca no topo
- Video: mostra poster frame + botao play manual centralizado

**WebGL indisponivel:**
- Fallback CSS: `div` com `background: radial-gradient(ellipse at center, forest/8, black)` + scan lines via `repeating-linear-gradient` + `@keyframes` glitch sutil via `clip-path`
- Funcional, nao identico — degrada gracefully

**Mobile:**
- Mesma composicao (fullbleed, sem pin), funciona naturalmente
- Shader roda mas com density reduzida (menos scan lines, glitch menos frequente) pra poupar GPU
- Video: alguns browsers mobile bloqueiam autoplay mesmo muted — fallback pro poster + play button

**Video TBD (estado atual):**
- Layer 1 mostra shader em opacidade reduzida (double-layer do mesmo efeito, mais escuro) como placeholder visual
- Headline fica centralizado (sem transicao, ja que nao tem video pra triggerar)
- Closer aparece normalmente no bottom

## Arquitetura de Arquivos

```
acts/
  act-two-paradox.tsx        <- rewrite total (composicao, IO, estado)
  hologram-canvas.tsx        <- componente React: canvas WebGL + lifecycle (novo)

canvas/shaders/
  hologram-glitch.frag.ts    <- fragment shader GLSL (novo)
  hologram-glitch.vert.ts    <- vertex shader fullscreen quad (novo)
```

**`hologram-glitch.frag.ts` / `.vert.ts`:**
- Shaders como template literal strings exportados (mesmo pattern dos shaders existentes em `canvas/shaders/dither.frag.ts`)
- Vert e trivial (fullscreen quad)
- Frag contem toda a logica: scan lines, RGB split, micro-glitch, vignette, base color

**`hologram-canvas.tsx`:**
- Cria `<canvas>`, inicializa WebGL context, compila shaders, seta uniforms
- Expoe via props: `paused` (IO toggle), `reducedMotion` (desliga animacoes)
- `useEffect` com `requestAnimationFrame` loop
- Cleanup no unmount (deleta programa, buffers, context)

**`act-two-paradox.tsx`:**
- Importa `HologramCanvas` + `DisplayHeading`
- Gerencia estado: `videoStarted` (boolean), IO via `IntersectionObserver`
- Compoe as 3 layers (canvas -> video -> texto)
- Lida com `prefers-reduced-motion` via `matchMedia`

## O Que Morre

- `PhaseLayer`, `ActTwoVideoCenterpiece`, `ActTwoRecap`, `RecapColumn`, `PlayGlyph` — tudo deletado
- `fadeWindow`, `clamp01` — nao precisa mais (sem pin, sem progress)
- `useActPin` import removido do act-two
- Interface `ParadoxActCopy` simplifica: remove `leftLabel`, `rightLabel`, `recap`
- `copy.ts`: remove campos `recap`, `leftLabel`, `rightLabel`, `leftFields`, `rightFields`
- Interface `RecapField` removida de `copy.ts`
