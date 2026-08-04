/**
 * Runtime control for editable swatch bases and user-added colours.
 * Core swatches + extras persist to localStorage and (during astro dev)
 * into src/styles/nexus/variables.css.
 */

export const SWATCHES_KEY = "nexus:swatches";
export const EXTRA_SWATCHES_KEY = "nexus:extra-swatches";

export const SWATCH_KEYS = ["light", "dark", "brand", "accent", "overscroll"] as const;
export type SwatchKey = (typeof SWATCH_KEYS)[number];

export type SwatchSettings = Record<SwatchKey, string>;
export type ExtraSwatches = Record<string, string>;

export type ExtraSwatch = {
  /** CSS token slug, e.g. "coral" → --swatch--coral */
  slug: string;
  hex: string;
  token: string;
};

export const SWATCH_TOKENS: Record<SwatchKey, string> = {
  light: "--swatch--light-100",
  dark: "--swatch--dark-900",
  brand: "--swatch--brand-500",
  accent: "--swatch--accent",
  overscroll: "--swatch--overscroll",
};

export const DEFAULT_SWATCHES: SwatchSettings = {
  light: "#ffffeb",
  dark: "#000000",
  brand: "#eae9e4",
  accent: "#c17f59",
  overscroll: "#c3c3c3",
};

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const SLUG_RE = /^[a-z][a-z0-9-]{0,31}$/;

/** Names that collide with the built-in palette / ramps. */
const RESERVED_SLUGS = new Set([
  ...SWATCH_KEYS,
  "light-100",
  "light-200",
  "dark-800",
  "dark-900",
  "brand-100",
  "brand-200",
  "brand-300",
  "brand-400",
  "brand-500",
  "brand-600",
  "brand-700",
  "brand-800",
  "brand-900",
  "brand-text",
  "accent-100",
  "accent-200",
  "accent-300",
  "accent-400",
  "accent-500",
  "accent-600",
  "accent-700",
  "accent-800",
  "accent-900",
]);

export function normalizeHex(value: string, fallback: string): string {
  const trimmed = value.trim();
  if (HEX_RE.test(trimmed)) return trimmed.toLowerCase();
  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) return `#${trimmed.toLowerCase()}`;
  return fallback;
}

export function slugifySwatchName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

export function extraSwatchToken(slug: string): string {
  return `--swatch--${slug}`;
}

function cssColorToHex(value: string, fallback: string): string {
  if (HEX_RE.test(value)) return value.toLowerCase();
  if (typeof document === "undefined") return fallback;
  const probe = document.createElement("div");
  probe.style.color = value;
  document.documentElement.appendChild(probe);
  const rgb = getComputedStyle(probe).color;
  probe.remove();
  const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return fallback;
  const hex = [match[1], match[2], match[3]]
    .map((part) => Number(part).toString(16).padStart(2, "0"))
    .join("");
  return `#${hex}`;
}

export function readSwatchesFromCss(): SwatchSettings {
  const settings = { ...DEFAULT_SWATCHES };
  if (typeof document === "undefined") return settings;
  const root = getComputedStyle(document.documentElement);
  for (const key of SWATCH_KEYS) {
    const value = root.getPropertyValue(SWATCH_TOKENS[key]).trim();
    if (value) settings[key] = cssColorToHex(value, DEFAULT_SWATCHES[key]);
  }
  return settings;
}

export function readSwatchSettings(): SwatchSettings {
  const fromCss = readSwatchesFromCss();
  try {
    const raw = localStorage.getItem(SWATCHES_KEY);
    if (!raw) return fromCss;
    const parsed = JSON.parse(raw) as Partial<SwatchSettings>;
    for (const key of SWATCH_KEYS) {
      if (typeof parsed[key] === "string") {
        fromCss[key] = normalizeHex(parsed[key]!, DEFAULT_SWATCHES[key]);
      }
    }
    return fromCss;
  } catch {
    return fromCss;
  }
}

export function writeSwatchSettings(settings: SwatchSettings): void {
  try {
    localStorage.setItem(SWATCHES_KEY, JSON.stringify(settings));
  } catch {
    /* private mode / blocked storage — still apply in-session */
  }
}

export function applySwatchSettings(settings: SwatchSettings): void {
  const root = document.documentElement;
  for (const key of SWATCH_KEYS) {
    root.style.setProperty(SWATCH_TOKENS[key], settings[key]);
  }
}

export function clearSwatchStorage(): void {
  try {
    localStorage.removeItem(SWATCHES_KEY);
  } catch {
    /* ignore */
  }
}

export function clearSwatchOverride(): void {
  const root = document.documentElement;
  for (const key of SWATCH_KEYS) {
    root.style.removeProperty(SWATCH_TOKENS[key]);
  }
  clearSwatchStorage();
}

/* ─── Extra / user-added swatches ──────────────────────────────────────── */

export function readExtraSwatches(): ExtraSwatches {
  try {
    const raw = localStorage.getItem(EXTRA_SWATCHES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ExtraSwatches;
    const extras: ExtraSwatches = {};
    for (const [slug, hex] of Object.entries(parsed)) {
      if (!SLUG_RE.test(slug) || RESERVED_SLUGS.has(slug)) continue;
      if (typeof hex !== "string" || !HEX_RE.test(hex)) continue;
      extras[slug] = hex.toLowerCase();
    }
    return extras;
  } catch {
    return {};
  }
}

export function writeExtraSwatches(extras: ExtraSwatches): void {
  try {
    localStorage.setItem(EXTRA_SWATCHES_KEY, JSON.stringify(extras));
  } catch {
    /* ignore */
  }
}

export function applyExtraSwatches(extras: ExtraSwatches): void {
  const root = document.documentElement;
  for (const [slug, hex] of Object.entries(extras)) {
    root.style.setProperty(extraSwatchToken(slug), hex);
  }
}

export function clearExtraSwatchStorage(): void {
  try {
    localStorage.removeItem(EXTRA_SWATCHES_KEY);
  } catch {
    /* ignore */
  }
}

export function clearExtraSwatchOverride(extras: ExtraSwatches = readExtraSwatches()): void {
  const root = document.documentElement;
  for (const slug of Object.keys(extras)) {
    root.style.removeProperty(extraSwatchToken(slug));
  }
  clearExtraSwatchStorage();
}

export function listExtraSwatches(extras: ExtraSwatches = readExtraSwatches()): ExtraSwatch[] {
  return Object.entries(extras)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([slug, hex]) => ({
      slug,
      hex,
      token: extraSwatchToken(slug),
    }));
}

/**
 * Add a named colour to the palette.
 * Returns the new swatch, or null if the name/hex is invalid or reserved.
 *
 * @example
 * addSwatch("coral", "#e36a5c")
 * // → { slug: "coral", hex: "#e36a5c", token: "--swatch--coral" }
 */
export function addSwatch(name: string, hex: string): ExtraSwatch | null {
  const slug = slugifySwatchName(name);
  const colour = normalizeHex(hex, "");
  if (!slug || !SLUG_RE.test(slug) || RESERVED_SLUGS.has(slug) || !colour) return null;

  const extras = readExtraSwatches();
  extras[slug] = colour;
  writeExtraSwatches(extras);
  applyExtraSwatches({ [slug]: colour });
  return { slug, hex: colour, token: extraSwatchToken(slug) };
}

/** Remove a user-added colour by slug. Core swatches cannot be removed. */
export function removeSwatch(slug: string): boolean {
  const extras = readExtraSwatches();
  if (!(slug in extras)) return false;
  delete extras[slug];
  writeExtraSwatches(extras);
  if (typeof document !== "undefined") {
    document.documentElement.style.removeProperty(extraSwatchToken(slug));
  }
  return true;
}

export function isReservedSwatchSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug);
}
