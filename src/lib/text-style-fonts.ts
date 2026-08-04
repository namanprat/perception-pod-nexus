/**
 * Runtime control for which font family each text style uses, plus the three
 * family stacks themselves. Persists in localStorage for site-wide apply.
 */

export const TEXT_STYLE_FONTS_KEY = "nexus:text-style-fonts";
export const FONT_FAMILIES_KEY = "nexus:font-families";

export const FONT_ROLES = ["primary", "secondary", "tertiary"] as const;
export type FontRole = (typeof FONT_ROLES)[number];

export const TEXT_STYLE_KEYS = [
  "display",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "large",
  "main",
  "small",
  "mono",
  "eyebrow",
] as const;
export type TextStyleKey = (typeof TEXT_STYLE_KEYS)[number];

export type TextStyleFontSettings = Record<TextStyleKey, FontRole>;
export type FontFamilySettings = Record<FontRole, string>;

export const DEFAULT_TEXT_STYLE_FONTS: TextStyleFontSettings = {
  display: "primary",
  h1: "primary",
  h2: "primary",
  h3: "primary",
  h4: "primary",
  h5: "primary",
  h6: "tertiary",
  large: "secondary",
  main: "secondary",
  small: "secondary",
  mono: "tertiary",
  eyebrow: "tertiary",
};

export const DEFAULT_FONT_FAMILIES: FontFamilySettings = {
  primary: '"new-spirit-condensed", Georgia, serif',
  secondary: "Arial, sans-serif",
  tertiary: "Arial, sans-serif",
};

export const FONT_FAMILY_TOKENS: Record<FontRole, string> = {
  primary: "--_typography---font--primary",
  secondary: "--_typography---font--secondary",
  tertiary: "--_typography---font--tertiary",
};

export function textStyleFontToken(style: TextStyleKey): string {
  return `--_typography---font-style--${style}`;
}

export function isFontRole(value: string): value is FontRole {
  return (FONT_ROLES as readonly string[]).includes(value);
}

export function readTextStyleFontsFromCss(): TextStyleFontSettings {
  const settings = { ...DEFAULT_TEXT_STYLE_FONTS };
  if (typeof document === "undefined") return settings;
  const root = getComputedStyle(document.documentElement);
  for (const key of TEXT_STYLE_KEYS) {
    const value = root.getPropertyValue(textStyleFontToken(key)).trim();
    const match = value.match(/--_typography---font--(primary|secondary|tertiary)/);
    if (match && isFontRole(match[1])) settings[key] = match[1];
  }
  return settings;
}

export function readTextStyleFontSettings(): TextStyleFontSettings {
  const fromCss = readTextStyleFontsFromCss();
  try {
    const raw = localStorage.getItem(TEXT_STYLE_FONTS_KEY);
    if (!raw) return fromCss;
    const parsed = JSON.parse(raw) as Partial<TextStyleFontSettings>;
    for (const key of TEXT_STYLE_KEYS) {
      const role = parsed[key];
      if (typeof role === "string" && isFontRole(role)) fromCss[key] = role;
    }
    return fromCss;
  } catch {
    return fromCss;
  }
}

export function writeTextStyleFontSettings(settings: TextStyleFontSettings): void {
  try {
    localStorage.setItem(TEXT_STYLE_FONTS_KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}

export function applyTextStyleFontSettings(settings: TextStyleFontSettings): void {
  const root = document.documentElement;
  for (const key of TEXT_STYLE_KEYS) {
    root.style.setProperty(
      textStyleFontToken(key),
      `var(--_typography---font--${settings[key]})`,
    );
  }
}

export function clearTextStyleFontStorage(): void {
  try {
    localStorage.removeItem(TEXT_STYLE_FONTS_KEY);
  } catch {
    /* ignore */
  }
}

export function clearTextStyleFontOverride(): void {
  const root = document.documentElement;
  for (const key of TEXT_STYLE_KEYS) {
    root.style.removeProperty(textStyleFontToken(key));
  }
  clearTextStyleFontStorage();
}

export function readFontFamiliesFromCss(): FontFamilySettings {
  const settings = { ...DEFAULT_FONT_FAMILIES };
  if (typeof document === "undefined") return settings;
  const root = getComputedStyle(document.documentElement);
  for (const role of FONT_ROLES) {
    const value = root.getPropertyValue(FONT_FAMILY_TOKENS[role]).trim();
    if (value) settings[role] = value;
  }
  return settings;
}

export function readFontFamilySettings(): FontFamilySettings {
  const fromCss = readFontFamiliesFromCss();
  try {
    const raw = localStorage.getItem(FONT_FAMILIES_KEY);
    if (!raw) return fromCss;
    const parsed = JSON.parse(raw) as Partial<FontFamilySettings>;
    for (const role of FONT_ROLES) {
      if (typeof parsed[role] === "string" && parsed[role]!.trim()) {
        fromCss[role] = parsed[role]!.trim();
      }
    }
    return fromCss;
  } catch {
    return fromCss;
  }
}

export function writeFontFamilySettings(settings: FontFamilySettings): void {
  try {
    localStorage.setItem(FONT_FAMILIES_KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}

export function applyFontFamilySettings(settings: FontFamilySettings): void {
  const root = document.documentElement;
  for (const role of FONT_ROLES) {
    root.style.setProperty(FONT_FAMILY_TOKENS[role], settings[role]);
  }
}

export function clearFontFamilyStorage(): void {
  try {
    localStorage.removeItem(FONT_FAMILIES_KEY);
  } catch {
    /* ignore */
  }
}

export function clearFontFamilyOverride(): void {
  const root = document.documentElement;
  for (const role of FONT_ROLES) {
    root.style.removeProperty(FONT_FAMILY_TOKENS[role]);
  }
  clearFontFamilyStorage();
}
