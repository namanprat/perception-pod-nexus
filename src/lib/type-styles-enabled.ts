/**
 * Master switch for the u-text-style-* system (per-style fonts, wrap, transform,
 * align, weight). When off, site + type styles fall back to Nexus Arial and ignore
 * user type-style configuration.
 */

import { NEXUS_FONT_STACK } from "./typekit";
import { TEXT_STYLE_KEYS, textStyleFontToken } from "./text-style-fonts";
import { textStyleOptionToken } from "./text-style-options";

export const TYPE_STYLES_ENABLED_KEY = "nexus:type-styles-enabled";
export const TYPE_STYLES_ENABLED_TOKEN = "--_typography---type-styles-enabled";

export const DEFAULT_TYPE_STYLES_ENABLED = true;

export function readTypeStylesEnabledFromCss(): boolean {
  if (typeof document === "undefined") return DEFAULT_TYPE_STYLES_ENABLED;
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(TYPE_STYLES_ENABLED_TOKEN)
    .trim();
  if (raw === "0") return false;
  if (raw === "1") return true;
  return DEFAULT_TYPE_STYLES_ENABLED;
}

export function readTypeStylesEnabled(): boolean {
  try {
    const raw = localStorage.getItem(TYPE_STYLES_ENABLED_KEY);
    if (raw === "0") return false;
    if (raw === "1") return true;
  } catch {
    /* ignore */
  }
  return readTypeStylesEnabledFromCss();
}

export function writeTypeStylesEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(TYPE_STYLES_ENABLED_KEY, enabled ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function clearTypeStylesEnabledStorage(): void {
  try {
    localStorage.removeItem(TYPE_STYLES_ENABLED_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Toggle the html class and force Arial onto type-style tokens when disabled.
 * When enabled, remove the forced overrides so CSS / user settings apply.
 */
export function applyTypeStylesEnabled(enabled: boolean): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("is-type-styles-off", !enabled);
  root.style.setProperty(TYPE_STYLES_ENABLED_TOKEN, enabled ? "1" : "0");

  if (!enabled) {
    for (const key of TEXT_STYLE_KEYS) {
      root.style.setProperty(textStyleFontToken(key), NEXUS_FONT_STACK);
      root.style.setProperty(textStyleOptionToken("wrap", key), "pretty");
      root.style.setProperty(textStyleOptionToken("transform", key), "none");
      root.style.setProperty(textStyleOptionToken("align", key), "start");
      root.style.setProperty(textStyleOptionToken("weight", key), "400");
    }
    return;
  }

  /* Drop the disable overrides so variables.css / session settings show through.
     Callers should re-apply text-style fonts/options after enabling. */
  for (const key of TEXT_STYLE_KEYS) {
    root.style.removeProperty(textStyleFontToken(key));
    root.style.removeProperty(textStyleOptionToken("wrap", key));
    root.style.removeProperty(textStyleOptionToken("transform", key));
    root.style.removeProperty(textStyleOptionToken("align", key));
    root.style.removeProperty(textStyleOptionToken("weight", key));
  }
}

export function clearTypeStylesEnabledOverride(): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("is-type-styles-off");
  root.style.removeProperty(TYPE_STYLES_ENABLED_TOKEN);
  clearTypeStylesEnabledStorage();
}
