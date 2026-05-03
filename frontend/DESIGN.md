# ZKSettle Design System

## Design Tokens

Defined in `src/app/globals.css`. All colors, radii, and easings are CSS custom properties consumed via Tailwind.

### Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `canvas` | `#fafaf7` | Page background |
| `surface` | `#f5f3ee` | Card / panel background |
| `surface-deep` | `#efede8` | Active / hover surface |
| `border-subtle` | `#e8e5df` | Default borders |
| `border` | `#c8c4bc` | Emphasized borders |
| `ink` | `#1a1917` | Primary text |
| `quill` | `#4a4640` | Secondary text |
| `stone` | `#6b6762` | Tertiary text |
| `muted` | `#8a8880` | Disabled / hint text |
| `ghost` | `#b4b0a8` | Placeholder icons |
| `forest` | `#0c3d2e` | Brand primary (buttons, links, focus rings) |
| `forest-hover` | `#0f4d38` | Brand hover state |
| `emerald` | `#1a6b4a` | Success accent |
| `mint` | `#e8f2ee` | Success background |

### Semantic Colors

| Token | Background | Text |
|-------|-----------|------|
| Warning | `#fbf4e8` | `#7a5c1e` |
| Danger | `#faf0ef` | `#bc2a24` |
| Info | `#eef4fc` | `#2563a8` |

### Typography

| Token | Stack |
|-------|-------|
| `--font-display` | Georgia, "Times New Roman", serif |
| `--font-sans` | Geist Sans, system-ui, sans-serif |
| `--font-mono` | JetBrains Mono, "Berkeley Mono", monospace |

### Radii

| Token | Value |
|-------|-------|
| `--radius-2` | 2px |
| `--radius-3` | 3px |
| `--radius-6` | 6px |
| `--radius-10` | 10px |

### Easing

| Token | Value |
|-------|-------|
| `--ease-brand` | `cubic-bezier(0.32, 0.72, 0, 1)` |

---

## UI Primitives

All primitives live in `src/components/ui/` and use `class-variance-authority` for variant management.

### Button (`button.tsx`)

```tsx
<Button variant="primary" size="md">Label</Button>
```

| Variant | Description |
|---------|-------------|
| `primary` | Forest bg, canvas text |
| `ghost` | Transparent bg, subtle border on hover |
| `link` | Inline text link style |

| Size | Height |
|------|--------|
| `sm` | `h-8` |
| `md` | `h-10` |
| `lg` | `h-12` |

### DisplayHeading (`display-heading.tsx`)

Polymorphic heading with fluid type scales.

```tsx
<DisplayHeading level="xl">Headline</DisplayHeading>
<DisplayHeading level="m" as="p">Subhead as paragraph</DisplayHeading>
```

| Level | Clamp range | Line height | Tracking | Default tag |
|-------|------------|-------------|----------|-------------|
| `xl` | 56-128px | 0.95 | -3.5% | `h1` |
| `l` | 40-72px | 1.03 | -3.5% | `h2` |
| `m` | 32-48px | 1.05 | -2% | `h3` |

### Badge (`badge.tsx`)

```tsx
<Badge variant="success">Verified</Badge>
```

Variants: `default`, `success`, `warning`, `danger`, `info`, `forest`.

### Input (`input.tsx`)

Standard text input with border-subtle styling and forest focus ring.

### Select (`select.tsx`)

Native `<select>` wrapper with consistent styling.

### Slider (`slider.tsx`)

Range input with forest track color.

### Tabs (`tabs.tsx`)

```tsx
<Tabs defaultValue="proof">
  <TabsList>
    <TabsTrigger value="proof">Proof</TabsTrigger>
  </TabsList>
  <TabsContent value="proof">Content here</TabsContent>
</Tabs>
```

### CodeBlock (`code-block.tsx`)

Syntax-highlighted code display.

---

## Dashboard Components

Reusable components in `src/components/dashboard/`.

### StatCard (`stat-card.tsx`)

```tsx
<StatCard label="Proofs verified (24h)" value="1,847" sub="+12% vs yesterday" />
```

Metric card with mono label, display-size value, and optional mono subtitle.

### StatusPill (`status-pill.tsx`)

```tsx
<StatusPill kind="verified" />
<StatusPill kind="warning" label="Stale (>24h)" />
```

| Kind | Colors | Default label |
|------|--------|--------------|
| `verified` | mint/forest | Verified |
| `blocked` | danger-bg/danger-text | Blocked |
| `warning` | warning-bg/warning-text | Stale |
| `info` | info-bg/info-text | Info |
| `test` | surface-deep/muted | Test mode |

---

## Conventions

- **Focus rings**: all interactive elements use `outline-2 outline-offset-2 outline-forest`
- **Borders**: default `border-border-subtle`, hover `border-border`
- **Spacing**: Tailwind defaults; cards use `p-5` or `p-6`
- **Mono labels**: `font-mono text-[10px] uppercase tracking-[0.1em] text-muted` for section labels
- **Transitions**: `transition-colors` with `--ease-brand` duration `150ms` for color changes
