/**
 * Runtime control for φ-ladder rung offsets on gutters and section padding.
 * Each step multiplies the band by √φ (--ratio--phi-half).
 *
 *   0  = default
 *  -1  = one rung down
 *  +1  = one rung up
 */

export const SPACING_RUNGS_KEY = "nexus:spacing-rungs";

export const RUNG_MIN = -2;
export const RUNG_MAX = 2;
export const DEFAULT_GUTTER_RUNG = 0;
export const DEFAULT_PADDING_RUNG = 0;

export const GUTTER_RUNG_TOKEN = "--site--gutter-rung";
export const PADDING_RUNG_TOKEN = "--_spacing---padding-rung";

export type SpacingRungSettings = {
  gutter: number;
  padding: number;
};

export const DEFAULT_SPACING_RUNGS: SpacingRungSettings = {
  gutter: DEFAULT_GUTTER_RUNG,
  padding: DEFAULT_PADDING_RUNG,
};

/** Select options for the styling page (−2 … +2). */
export const RUNG_OPTIONS = [
  { value: -2, label: "−2 · two rungs down" },
  { value: -1, label: "−1 · one rung down" },
  { value: 0, label: "0 · default" },
  { value: 1, label: "+1 · one rung up" },
  { value: 2, label: "+2 · two rungs up" },
] as const;

export function clampRung(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(RUNG_MAX, Math.max(RUNG_MIN, Math.round(value)));
}

function readRungFromCss(token: string, fallback: number): number {
  if (typeof document === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  if (!raw) return fallback;
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) ? clampRung(parsed) : fallback;
}

export function readSpacingRungsFromCss(): SpacingRungSettings {
  return {
    gutter: readRungFromCss(GUTTER_RUNG_TOKEN, DEFAULT_GUTTER_RUNG),
    padding: readRungFromCss(PADDING_RUNG_TOKEN, DEFAULT_PADDING_RUNG),
  };
}

export function readSpacingRungSettings(): SpacingRungSettings {
  const fromCss = readSpacingRungsFromCss();
  try {
    const raw = localStorage.getItem(SPACING_RUNGS_KEY);
    if (!raw) return fromCss;
    const parsed = JSON.parse(raw) as Partial<SpacingRungSettings>;
    return {
      gutter:
        typeof parsed.gutter === "number" ? clampRung(parsed.gutter) : fromCss.gutter,
      padding:
        typeof parsed.padding === "number" ? clampRung(parsed.padding) : fromCss.padding,
    };
  } catch {
    return fromCss;
  }
}

export function writeSpacingRungSettings(settings: SpacingRungSettings): void {
  try {
    localStorage.setItem(
      SPACING_RUNGS_KEY,
      JSON.stringify({
        gutter: clampRung(settings.gutter),
        padding: clampRung(settings.padding),
      }),
    );
  } catch {
    /* ignore */
  }
}

export function applySpacingRungSettings(settings: SpacingRungSettings): void {
  const root = document.documentElement;
  root.style.setProperty(GUTTER_RUNG_TOKEN, String(clampRung(settings.gutter)));
  root.style.setProperty(PADDING_RUNG_TOKEN, String(clampRung(settings.padding)));
}

export function clearSpacingRungStorage(): void {
  try {
    localStorage.removeItem(SPACING_RUNGS_KEY);
  } catch {
    /* ignore */
  }
}

export function clearSpacingRungOverride(): void {
  const root = document.documentElement;
  root.style.removeProperty(GUTTER_RUNG_TOKEN);
  root.style.removeProperty(PADDING_RUNG_TOKEN);
  clearSpacingRungStorage();
}
