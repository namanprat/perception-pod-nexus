/**
 * Persist styling-page edits into variables.css via the Vite middleware
 * available during `astro dev`. Returns false when the endpoint is unavailable
 * (preview / production), so callers can fall back to localStorage.
 */

import type { Features } from "./features";

export type SaveTokensPayload = {
  swatches?: Record<string, string>;
  extraSwatches?: Record<string, string>;
  fontFamilies?: Record<string, string>;
  textStyleFonts?: Record<string, string>;
  textStyleOptions?: {
    wrap: Record<string, string>;
    transform: Record<string, string>;
    align: Record<string, string>;
    weight?: Record<string, string>;
  };
  buttonStyles?: Record<string, string>;
  container?: { locked: boolean; widthRem: number };
  spacingRungs?: { gutter: number; padding: number };
  typeStylesEnabled?: boolean;
  typekitKitId?: string;
  /** Build-time bundle flags — written to src/features.json, not variables.css. */
  features?: Partial<Features>;
};

export async function saveTokensToCss(payload: SaveTokensPayload): Promise<boolean> {
  try {
    const response = await fetch("/__nexus/save-tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) return false;
    const result = (await response.json()) as { ok?: boolean };
    return Boolean(result.ok);
  } catch {
    return false;
  }
}
