/**
 * Runtime control for per–text-style wrap, transform, alignment and weight.
 * Persists to localStorage and variables.css during astro dev.
 */

import { TEXT_STYLE_KEYS, type TextStyleKey } from "./text-style-fonts";

export const TEXT_STYLE_OPTIONS_KEY = "nexus:text-style-options";

export const TEXT_WRAP_VALUES = ["balance", "pretty", "wrap", "nowrap", "stable"] as const;
export type TextWrap = (typeof TEXT_WRAP_VALUES)[number];

export const TEXT_TRANSFORM_VALUES = [
  "none",
  "uppercase",
  "lowercase",
  "capitalize",
] as const;
export type TextTransform = (typeof TEXT_TRANSFORM_VALUES)[number];

export const TEXT_ALIGN_VALUES = ["start", "center", "end", "justify"] as const;
export type TextAlign = (typeof TEXT_ALIGN_VALUES)[number];

/** Numeric CSS weights — Typekit New Spirit ships 400 / 700. */
export const TEXT_WEIGHT_VALUES = ["300", "400", "500", "600", "700"] as const;
export type TextWeight = (typeof TEXT_WEIGHT_VALUES)[number];

export type TextStyleOptionKind = "wrap" | "transform" | "align" | "weight";

export type TextStyleOptions = {
  wrap: Record<TextStyleKey, TextWrap>;
  transform: Record<TextStyleKey, TextTransform>;
  align: Record<TextStyleKey, TextAlign>;
  weight: Record<TextStyleKey, TextWeight>;
};

const HEADING_WRAP: TextWrap = "balance";
const BODY_WRAP: TextWrap = "pretty";

export const DEFAULT_TEXT_STYLE_OPTIONS: TextStyleOptions = {
  wrap: {
    display: HEADING_WRAP,
    h1: HEADING_WRAP,
    h2: HEADING_WRAP,
    h3: HEADING_WRAP,
    h4: HEADING_WRAP,
    h5: HEADING_WRAP,
    h6: HEADING_WRAP,
    large: BODY_WRAP,
    main: BODY_WRAP,
    small: BODY_WRAP,
    mono: BODY_WRAP,
    eyebrow: BODY_WRAP,
  },
  transform: {
    display: "none",
    h1: "none",
    h2: "none",
    h3: "none",
    h4: "none",
    h5: "none",
    h6: "uppercase",
    large: "none",
    main: "none",
    small: "none",
    mono: "none",
    eyebrow: "uppercase",
  },
  align: {
    display: "start",
    h1: "start",
    h2: "start",
    h3: "start",
    h4: "start",
    h5: "start",
    h6: "start",
    large: "start",
    main: "start",
    small: "start",
    mono: "start",
    eyebrow: "start",
  },
  weight: {
    display: "500",
    h1: "500",
    h2: "500",
    h3: "500",
    h4: "400",
    h5: "400",
    h6: "400",
    large: "400",
    main: "400",
    small: "400",
    mono: "400",
    eyebrow: "400",
  },
};

export const TEXT_WRAP_OPTIONS = [
  { value: "balance", label: "Balance" },
  { value: "pretty", label: "Pretty" },
  { value: "wrap", label: "Wrap" },
  { value: "nowrap", label: "No wrap" },
  { value: "stable", label: "Stable" },
] as const;

export const TEXT_TRANSFORM_OPTIONS = [
  { value: "none", label: "None" },
  { value: "uppercase", label: "Uppercase" },
  { value: "lowercase", label: "Lowercase" },
  { value: "capitalize", label: "Capitalize" },
] as const;

export const TEXT_ALIGN_OPTIONS = [
  { value: "start", label: "Start" },
  { value: "center", label: "Center" },
  { value: "end", label: "End" },
  { value: "justify", label: "Justify" },
] as const;

export const TEXT_WEIGHT_OPTIONS = [
  { value: "300", label: "300 Light" },
  { value: "400", label: "400 Regular" },
  { value: "500", label: "500 Medium" },
  { value: "600", label: "600 Semibold" },
  { value: "700", label: "700 Bold" },
] as const;

export function textStyleOptionToken(
  kind: TextStyleOptionKind,
  style: TextStyleKey,
): string {
  if (kind === "wrap") return `--_typography---text-wrap--${style}`;
  if (kind === "transform") return `--_typography---text-transform--${style}`;
  if (kind === "align") return `--_typography---text-align--${style}`;
  return `--_typography---font-weight--${style}`;
}

export function isTextWrap(value: string): value is TextWrap {
  return (TEXT_WRAP_VALUES as readonly string[]).includes(value);
}

export function isTextTransform(value: string): value is TextTransform {
  return (TEXT_TRANSFORM_VALUES as readonly string[]).includes(value);
}

export function isTextAlign(value: string): value is TextAlign {
  return (TEXT_ALIGN_VALUES as readonly string[]).includes(value);
}

export function isTextWeight(value: string): value is TextWeight {
  return (TEXT_WEIGHT_VALUES as readonly string[]).includes(value);
}

function cloneDefaults(): TextStyleOptions {
  return {
    wrap: { ...DEFAULT_TEXT_STYLE_OPTIONS.wrap },
    transform: { ...DEFAULT_TEXT_STYLE_OPTIONS.transform },
    align: { ...DEFAULT_TEXT_STYLE_OPTIONS.align },
    weight: { ...DEFAULT_TEXT_STYLE_OPTIONS.weight },
  };
}

export function readTextStyleOptionsFromCss(): TextStyleOptions {
  const settings = cloneDefaults();
  if (typeof document === "undefined") return settings;
  const root = getComputedStyle(document.documentElement);
  for (const key of TEXT_STYLE_KEYS) {
    const wrap = root.getPropertyValue(textStyleOptionToken("wrap", key)).trim();
    const transform = root
      .getPropertyValue(textStyleOptionToken("transform", key))
      .trim();
    const align = root.getPropertyValue(textStyleOptionToken("align", key)).trim();
    const weight = root.getPropertyValue(textStyleOptionToken("weight", key)).trim();
    if (isTextWrap(wrap)) settings.wrap[key] = wrap;
    if (isTextTransform(transform)) settings.transform[key] = transform;
    if (isTextAlign(align)) settings.align[key] = align;
    if (isTextWeight(weight)) settings.weight[key] = weight;
  }
  return settings;
}

export function readTextStyleOptionSettings(): TextStyleOptions {
  const fromCss = readTextStyleOptionsFromCss();
  try {
    const raw = localStorage.getItem(TEXT_STYLE_OPTIONS_KEY);
    if (!raw) return fromCss;
    const parsed = JSON.parse(raw) as Partial<TextStyleOptions>;
    for (const key of TEXT_STYLE_KEYS) {
      const wrap = parsed.wrap?.[key];
      const transform = parsed.transform?.[key];
      const align = parsed.align?.[key];
      const weight = parsed.weight?.[key];
      if (typeof wrap === "string" && isTextWrap(wrap)) fromCss.wrap[key] = wrap;
      if (typeof transform === "string" && isTextTransform(transform)) {
        fromCss.transform[key] = transform;
      }
      if (typeof align === "string" && isTextAlign(align)) fromCss.align[key] = align;
      if (typeof weight === "string" && isTextWeight(weight)) {
        fromCss.weight[key] = weight;
      }
    }
    return fromCss;
  } catch {
    return fromCss;
  }
}

export function writeTextStyleOptionSettings(settings: TextStyleOptions): void {
  try {
    localStorage.setItem(TEXT_STYLE_OPTIONS_KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}

export function applyTextStyleOptionSettings(settings: TextStyleOptions): void {
  const root = document.documentElement;
  for (const key of TEXT_STYLE_KEYS) {
    root.style.setProperty(textStyleOptionToken("wrap", key), settings.wrap[key]);
    root.style.setProperty(
      textStyleOptionToken("transform", key),
      settings.transform[key],
    );
    root.style.setProperty(textStyleOptionToken("align", key), settings.align[key]);
    root.style.setProperty(textStyleOptionToken("weight", key), settings.weight[key]);
  }
}

export function clearTextStyleOptionStorage(): void {
  try {
    localStorage.removeItem(TEXT_STYLE_OPTIONS_KEY);
  } catch {
    /* ignore */
  }
}

export function clearTextStyleOptionOverride(): void {
  const root = document.documentElement;
  for (const key of TEXT_STYLE_KEYS) {
    root.style.removeProperty(textStyleOptionToken("wrap", key));
    root.style.removeProperty(textStyleOptionToken("transform", key));
    root.style.removeProperty(textStyleOptionToken("align", key));
    root.style.removeProperty(textStyleOptionToken("weight", key));
  }
  clearTextStyleOptionStorage();
}
