# nexus-framework-astro

**Author:** Naman Pratulya

An Astro-native design system: φ-based tokens, utilities, and a live specimen —
owned as **Nexus**, not a third-party port.

```bash
npm install
npm run dev          # http://localhost:4321
npm run check:tokens # token & framework integrity check
npm run build        # runs check:tokens, then astro build
```

Open [`/styling`](http://localhost:4321/styling) in `astro dev`: a live specimen
of the whole system — the ratio ladder, the grid, the type scale with measured
ratios, the palette, the themes and the spacing scale. Production builds ship
the starter home at `/` and **strip `/styling` from `dist`**, so the specimen
never goes live. **Shift + G** toggles the column overlay.

Typography ships as **Arial** for primary, secondary and tertiary. No remote
font kits.

---

## The ratio

Everything hangs off one ladder of twelve rungs. Each rung is the previous rung
× √φ (1.272), so **every second rung is exactly φ** (1.618).

| Rung | Value | | Rung | Value | |
|---|---|---|---|---|---|
| `--phi-0` | 0.786 | φ^-0.5 | `--phi-6` | 3.33 | |
| `--phi-1` | 1 | base | `--phi-7` | 4.236 | φ³ |
| `--phi-2` | 1.272 | √φ | `--phi-8` | 5.388 | |
| `--phi-3` | 1.618 | φ | `--phi-9` | 6.854 | φ⁴ |
| `--phi-4` | 2.058 | | `--phi-10` | 8.72 | |
| `--phi-5` | 2.618 | φ² | `--phi-11` | 11.09 | φ⁵ |

Font sizes, spacing, radii and the margin/gutter relationship all read off it.

### Type

Four **static UI sizes** — they must not grow with the viewport:

| Token | Rung | Value |
|---|---|---|
| `--_typography---size--small` | `--phi-0` | 0.786rem |
| `--_typography---size--main` | `--phi-1` | 1rem |
| `--_typography---size--large` | `--phi-2` | 1.272rem |
| `--_typography---size--h6` | `--phi-2` | 1.272rem |

Six **fluid display sizes**, each spanning **exactly two rungs (×φ)** across a
20rem → 110rem viewport band:

| Token | Min | Max | Ratio to the size below |
|---|---|---|---|
| `--_typography---size--h5` | `--phi-1` | `--phi-3` | — |
| `--_typography---size--h4` | `--phi-2` | `--phi-4` | √φ |
| `--_typography---size--h3` | `--phi-3` | `--phi-5` | √φ |
| `--_typography---size--h2` | `--phi-5` | `--phi-7` | φ |
| `--_typography---size--h1` | `--phi-6` | `--phi-8` | √φ |
| `--_typography---size--display` | `--phi-8` | `--phi-10` | φ |

The **uniform two-rung span is the point**. Each size resolves to
`rung × (1 + t(φ − 1))` for the same `t`, so the ratio between any two of them
is fixed at *every* viewport. `npm run check:tokens` enforces the uniform span.

Ratios only drift where a fluid size meets a static one (h5 ÷ h6), which is
expected — the UI tier deliberately does not scale.

**Consumption matters.** Edits on `/styling` rewrite type tokens correctly, but
site chrome only picks them up when it uses `u-text-style-*` / the type tokens.
Hardcoding a family stack or raw size on nav/buttons bypasses the system — the
framework is fine; the page opted out.

### Grid

Column counts are **12 / 8 / 4** — a conventional twelve-column desktop grid
that steps down cleanly at medium and small. wide / xlarge / large share 12.

`--site--column-count` is assembled from the Nexus responsive flags:

```css
--site--column-count: calc(
  var(--_responsive---wide) * 12 + var(--_responsive---xlarge) * 12 +
  var(--_responsive---large) * 12 + var(--_responsive---medium) * 8 +
  var(--_responsive---small) * 4 + var(--_responsive---xsmall) * 4
);
```

**Margin is exactly φ × the gutter** at every viewport:

```css
--site--margin: calc(var(--site--gutter) * var(--ratio--phi));
```

**4-column rule:** spans wider than 4 need a narrower companion on small
screens (`var(--none-small, …)` or a second span utility), or use
`u-column-span-full` — the grid only has 4 columns there.

### The container lock

`--max-width--main` is the layout knob. Default in CSS is unlocked (`100vw`);
`/styling` can lock it to a rem width (e.g. `90rem`).

| Utility | Locks at |
|---|---|
| `u-container` | `--max-width--main` |
| `u-container-small` | `--max-width--small` — 50rem |
| `u-container-full` | never — fluid forever |

**The gutter locks with it.** An unlocked plain `vw` gutter keeps widening past
the lock while columns stay fixed. `check:tokens` fails if the gutter stops
being capped by `--max-width--main`, or if the margin stops deriving from the
gutter.

> Below roughly a 45rem lock the gutter floor takes over and φ proportions
> intentionally slip — legibility beats geometry at that size.

### Colour

Editable bases: light, dark, brand, accent and overscroll. Themes swap by
utility — `u-theme-light`, `u-theme-dark`, `u-theme-brand`. One-off colours
belong as declared `--swatch--*` tokens in `variables.css`, not raw hex in page
CSS.

During `astro dev`, `/styling` edits write into
`src/styles/nexus/variables.css`. Outside dev they fall back to a session
override (`nexus:*` localStorage keys).

---

## Nexus layers

```
src/styles/
  main.css                 imports the five layers in order
  nexus/
    responsive.css         band flags + shared keyword vars (only width @media)
    variables.css          swatches, themes, spacing, type, sizing
    state.css              --_state---* / --_trigger---* system
    base.css               reset + base element styling
    utilities.css          the u-* layer
```

### Responsive

Bands (exactly one flag is `1`):

| Band | Range |
|---|---|
| wide | ≥ 120em |
| xlarge | 75–120em |
| large | 50–75em |
| medium | 35–50em |
| small | 20–35em |
| xsmall | < 20em |

Prefer this order for layout switches:

1. Flag `calc()` with `--_responsive---*`
2. Shared keyword vars (`var(--flex-medium, grid)`, `var(--column-wide, row)`, …)
3. **`@container`** on a child of `u-container` for one-off layout
4. A new **shared** keyword in `responsive.css` only if ≥2 sites need it

Do **not** dump bespoke keywords (`--contact-align-medium`, …) into
`responsive.css`. Width `@media` outside that file fails `check:tokens`.
`@container` is the intentional escape hatch and is not checked as a media
query.

```css
.card_wrap { display: var(--flex-medium, grid); flex-direction: column; }
.card_header { flex-direction: var(--column-wide, row); }
```

Downward keywords (medium/small/xsmall) are set at their breakpoint and below;
upward keywords (xlarge/wide) at their breakpoint and above. `initial` makes
the `var()` fallback apply.

### State & trigger

`state.css` is the only file allowed to select `.is-active`, `[data-state]` or
`[data-trigger]`. Everything else reads the variables:

```css
.tabs_link_bar { transform: scaleY(var(--_state---false)); }
.card_title { opacity: calc(1 - 0.4 * var(--_trigger---on)); }
```

`true`/`on` always come first in `calc()` and `color-mix()` expressions.

### Naming

`[component]_[type]_[element]`, max three underscores; `_wrap` marks a
component or subcomponent root; utilities are `u-`; combo classes are `.is-*`
and always scoped (`.ladder_bar.is-3`, never a bare `.is-3`).

---

## Authoring contract (Astro-native)

Nexus is built for Astro components and React islands.

**Keep**

- Class-first naming (`[name]_wrap` / `_contain` / `_layout` + `u-layout`)
- Theme colours via `--_theme---*` (or declared `--swatch--*` tokens)
- State via `--_state---` / `--_trigger---` (only `state.css` selects the
  triggers)
- `rem` for design sizes; `ch` for readable text widths; `em` for container
  query breakpoints
- Section skeleton via `Section.astro` or the same markup pattern

**Astro / islands are first-class**

- Scoped `<style>` in `.astro` files is fine (placement is not Webflow-ordered)
- React islands may use `createElement`, templates, and normal DOM APIs
- No requirement for hidden clone templates or “no `innerHTML`”

**Pragmatic escapes (documented, not silent opt-outs)**

- `px` for focus rings, 1px hairlines, and `env(safe-area-*)`
- Decorative `::before` / `::after` **or** empty divs — either is fine
- Non-theme colours only when declared in `variables.css`

**Section skeleton**

```html
<section class="hero_wrap u-section">
  <div class="hero_contain u-container">
    <div class="hero_layout u-layout">
      …
    </div>
  </div>
</section>
```

Or `<Section name="hero">`. Never put layout on `u-container` — it owns
`container-type: inline-size`.

**Scope:** Nexus is a design kit (tokens + utilities + specimen), not a
portfolio product. Nav, contact, motion and R3F live beside it; the responsive
bands and `@container` hatch exist so that work does not fight the contract.

---

## The check

`npm run check:tokens` (also runs before `npm run build`):

1. **Every `var()` reference resolves** — undeclared tokens fail the build
2. **The φ ladder is still golden**
3. **Guides match the grid** (`is-9` / `is-5`, keyword vars, column counts)
4. **Fluid type spans are uniform**
5. **No width-based `@media` outside `nexus/responsive.css`**
6. **Gutter stays locked** to `--max-width--main`; margin stays φ × gutter

### Runtime measurement

`getComputedStyle` on a custom property returns the **specified** string
(`clamp(...)`), not px. Use `readCssLengthPx()` in `src/lib/css-length.ts`
(probe element) for live readouts on `/styling`.

---

## Components

| File | Purpose |
|---|---|
| `layouts/BaseLayout.astro` | Document shell, theme, session overrides |
| `components/Section.astro` | `_wrap` / `_contain` / `_layout u-layout` shell |
| `pages/styling/index.astro` | Design-system specimen (dev only) |
| `components/GridLines.astro` | Dashed column guides |
| `components/GridOverlay.astro` | Fixed overlay, Shift+G |
| `lib/css-length.ts` | Resolves a length custom property to px |

## Author

Naman Pratulya
