/**
 * Runtime control for button recipe tokens (fill, label, tertiary underline
 * text, font, padding, radius). Persists to localStorage and variables.css
 * during astro dev.
 */

export const BUTTON_STYLES_KEY = "nexus:button-styles";

export const BUTTON_PADDING_PRESETS = ["compact", "default", "comfortable"] as const;
export type ButtonPaddingPreset = (typeof BUTTON_PADDING_PRESETS)[number];

export const BUTTON_PADDING_PRESET_OPTIONS = [
  { value: "compact", label: "Compact" },
  { value: "default", label: "Default" },
  { value: "comfortable", label: "Comfortable" },
] as const;

/** space--N pairs for each padding preset (block / inline). */
export const BUTTON_PADDING_PRESET_SPACES: Record<
  ButtonPaddingPreset,
  { block: number; inline: number }
> = {
  compact: { block: 2, inline: 4 },
  default: { block: 3, inline: 5 },
  comfortable: { block: 4, inline: 6 },
};

export const BUTTON_STYLE_KEYS = [
  "fontFamily",
  "primaryBackground",
  "primaryBackgroundHover",
  "primaryText",
  "primaryTextHover",
  "secondaryText",
  "secondaryTextHover",
  "tertiaryText",
  "tertiaryTextHover",
  "paddingPreset",
  "radius",
] as const;

export type ButtonStyleKey = (typeof BUTTON_STYLE_KEYS)[number];
export type ButtonStyleSettings = Record<ButtonStyleKey, string>;

/** CSS custom property each setting writes (paddingPreset expands to two). */
export const BUTTON_STYLE_TOKENS: Record<
  Exclude<ButtonStyleKey, "paddingPreset">,
  string
> = {
  fontFamily: "--button--font-family",
  primaryBackground: "--button-primary--background",
  primaryBackgroundHover: "--button-primary--background-hover",
  primaryText: "--button-primary--text",
  primaryTextHover: "--button-primary--text-hover",
  secondaryText: "--button-secondary--text",
  secondaryTextHover: "--button-secondary--text-hover",
  tertiaryText: "--button-tertiary--text",
  tertiaryTextHover: "--button-tertiary--text-hover",
  radius: "--button--radius",
};

export const BUTTON_PADDING_BLOCK_TOKEN = "--button--padding-block";
export const BUTTON_PADDING_INLINE_TOKEN = "--button--padding-inline";

/**
 * Default values — what variables.css ships.
 * Font uses a family role token; colours use swatch tokens; radius is pill.
 */
export const DEFAULT_BUTTON_STYLES: ButtonStyleSettings = {
  fontFamily: "var(--_typography---font--secondary)",
  primaryBackground: "var(--swatch--dark-900)",
  primaryBackgroundHover: "var(--swatch--accent)",
  primaryText: "var(--swatch--light-100)",
  primaryTextHover: "var(--swatch--light-100)",
  secondaryText: "var(--swatch--dark-900)",
  secondaryTextHover: "var(--swatch--light-100)",
  tertiaryText: "var(--swatch--dark-900)",
  tertiaryTextHover: "var(--swatch--accent)",
  paddingPreset: "default",
  radius: "100vw",
};

const VAR_RE = /^var\(--[a-zA-Z0-9_-]+\)$/;
const FONT_ROLE_RE = /^var\(--_typography---font--(primary|secondary|tertiary)\)$/;
const FONT_STYLE_RE =
  /^var\(--_typography---font-style--(display|h1|h2|h3|h4|h5|h6|large|main|small|mono|eyebrow)\)$/;
const RADIUS_RE = /^(\d*\.?\d+rem|100vw|var\(--radius--(small|main|round)\))$/;
const SPACE_VAR_RE = /^var\(--_spacing---space--([1-8])\)$/;

export function isButtonPaddingPreset(value: string): value is ButtonPaddingPreset {
  return (BUTTON_PADDING_PRESETS as readonly string[]).includes(value);
}

export function isButtonRadiusValue(value: string): boolean {
  return RADIUS_RE.test(value.trim());
}

export function isButtonFontValue(value: string): boolean {
  const v = value.trim();
  return FONT_ROLE_RE.test(v) || FONT_STYLE_RE.test(v);
}

export function isButtonColourValue(value: string): boolean {
  return /^var\(--swatch--[a-zA-Z0-9_-]+\)$/.test(value.trim());
}

export function isButtonStyleValue(key: ButtonStyleKey, value: string): boolean {
  const v = value.trim();
  if (key === "paddingPreset") return isButtonPaddingPreset(v);
  if (key === "radius") return isButtonRadiusValue(v);
  if (key === "fontFamily") return isButtonFontValue(v) || VAR_RE.test(v);
  return isButtonColourValue(v) || VAR_RE.test(v);
}

export function paddingPresetToVars(preset: ButtonPaddingPreset): {
  block: string;
  inline: string;
} {
  const spaces = BUTTON_PADDING_PRESET_SPACES[preset];
  return {
    block: `var(--_spacing---space--${spaces.block})`,
    inline: `var(--_spacing---space--${spaces.inline})`,
  };
}

export function varsToPaddingPreset(block: string, inline: string): ButtonPaddingPreset | null {
  const blockN = block.trim().match(SPACE_VAR_RE)?.[1];
  const inlineN = inline.trim().match(SPACE_VAR_RE)?.[1];
  if (!blockN || !inlineN) return null;
  const b = Number(blockN);
  const i = Number(inlineN);
  for (const preset of BUTTON_PADDING_PRESETS) {
    const spaces = BUTTON_PADDING_PRESET_SPACES[preset];
    if (spaces.block === b && spaces.inline === i) return preset;
  }
  return null;
}

export function readButtonStylesFromCss(): ButtonStyleSettings {
  const settings = { ...DEFAULT_BUTTON_STYLES };
  if (typeof document === "undefined") return settings;
  const root = getComputedStyle(document.documentElement);

  for (const key of BUTTON_STYLE_KEYS) {
    if (key === "paddingPreset" || key === "radius") continue;
    const token = BUTTON_STYLE_TOKENS[key];
    const value = root.getPropertyValue(token).trim();
    if (value && VAR_RE.test(value)) settings[key] = value;
  }

  const radius = root.getPropertyValue(BUTTON_STYLE_TOKENS.radius).trim();
  if (radius && isButtonRadiusValue(radius)) {
    settings.radius = radius === "var(--radius--round)" ? "100vw" : radius;
  } else if (radius === "100vw") {
    settings.radius = "100vw";
  }

  const block = root.getPropertyValue(BUTTON_PADDING_BLOCK_TOKEN).trim();
  const inline = root.getPropertyValue(BUTTON_PADDING_INLINE_TOKEN).trim();
  const preset = varsToPaddingPreset(block, inline);
  if (preset) settings.paddingPreset = preset;

  return settings;
}

export function readButtonStyleSettings(): ButtonStyleSettings {
  const fromCss = readButtonStylesFromCss();
  try {
    const raw = localStorage.getItem(BUTTON_STYLES_KEY);
    if (!raw) return fromCss;
    const parsed = JSON.parse(raw) as Partial<ButtonStyleSettings>;
    for (const key of BUTTON_STYLE_KEYS) {
      const value = parsed[key];
      if (typeof value === "string" && isButtonStyleValue(key, value)) {
        fromCss[key] = value.trim();
      }
    }
    return fromCss;
  } catch {
    return fromCss;
  }
}

export function writeButtonStyleSettings(settings: ButtonStyleSettings): void {
  try {
    localStorage.setItem(BUTTON_STYLES_KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}

export function applyButtonStyleSettings(settings: ButtonStyleSettings): void {
  const root = document.documentElement;
  for (const key of BUTTON_STYLE_KEYS) {
    if (key === "paddingPreset") {
      if (!isButtonPaddingPreset(settings.paddingPreset)) continue;
      const vars = paddingPresetToVars(settings.paddingPreset);
      root.style.setProperty(BUTTON_PADDING_BLOCK_TOKEN, vars.block);
      root.style.setProperty(BUTTON_PADDING_INLINE_TOKEN, vars.inline);
      continue;
    }
    root.style.setProperty(BUTTON_STYLE_TOKENS[key], settings[key]);
  }
}

export function clearButtonStyleStorage(): void {
  try {
    localStorage.removeItem(BUTTON_STYLES_KEY);
  } catch {
    /* ignore */
  }
}

export function clearButtonStyleOverride(): void {
  const root = document.documentElement;
  for (const key of BUTTON_STYLE_KEYS) {
    if (key === "paddingPreset") {
      root.style.removeProperty(BUTTON_PADDING_BLOCK_TOKEN);
      root.style.removeProperty(BUTTON_PADDING_INLINE_TOKEN);
      continue;
    }
    root.style.removeProperty(BUTTON_STYLE_TOKENS[key]);
  }
  clearButtonStyleStorage();
}

export function fontRoleToVar(role: "primary" | "secondary" | "tertiary"): string {
  return `var(--_typography---font--${role})`;
}

export function fontStyleToVar(style: string): string {
  return `var(--_typography---font-style--${style})`;
}

export function fontVarToRole(
  value: string,
): "primary" | "secondary" | "tertiary" | null {
  const match = value.trim().match(FONT_ROLE_RE);
  return match ? (match[1] as "primary" | "secondary" | "tertiary") : null;
}

export function swatchTokenToVar(token: string): string {
  return `var(${token})`;
}

export function varToSwatchToken(value: string): string | null {
  const match = value.trim().match(/^var\((--swatch--[a-z0-9-]+)\)$/);
  return match ? match[1] : null;
}

/** Parse rem slider value; returns null for pill / invalid. */
export function radiusToRem(value: string): number | null {
  const v = value.trim();
  if (v === "100vw" || v === "var(--radius--round)") return null;
  const match = v.match(/^(\d*\.?\d+)rem$/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
}

export function remToRadius(rem: number): string {
  const clamped = Math.min(2, Math.max(0, rem));
  const rounded = Math.round(clamped * 20) / 20;
  return `${rounded}rem`;
}

export function isPillRadius(value: string): boolean {
  const v = value.trim();
  return v === "100vw" || v === "var(--radius--round)";
}
