/**
 * Adobe Fonts (Typekit) kit loading and font catalog for /styling dropdowns.
 * Kit CSS is fetched server-side via /__nexus/typekit-fonts to avoid CORS.
 */

export const TYPEKIT_KIT_ID_KEY = "nexus:typekit-kit-id";
export const FONT_CATALOG_KEY = "nexus:font-catalog";

export const NEXUS_FONT_STACK = "Arial, sans-serif";
export const NEXUS_FONT_LABEL = "Arial";

export type FontCatalogEntry = {
  /** CSS font-family name as declared by the kit / system */
  family: string;
  /** Full stack written into --_typography---font--* */
  stack: string;
  source: "nexus" | "typekit";
};

export const DEFAULT_FONT_CATALOG: FontCatalogEntry[] = [
  {
    family: NEXUS_FONT_LABEL,
    stack: NEXUS_FONT_STACK,
    source: "nexus",
  },
];

const KIT_ID_RE = /^[a-z0-9]{5,10}$/i;

export function isTypekitKitId(value: string): boolean {
  return KIT_ID_RE.test(value.trim());
}

export function typekitCssUrl(kitId: string): string {
  return `https://use.typekit.net/${kitId.trim().toLowerCase()}.css`;
}

/** Pull unique font-family names out of a Typekit stylesheet. */
export function parseTypekitFontFamilies(css: string): string[] {
  const families = new Set<string>();
  for (const block of css.matchAll(/@font-face\s*\{([\s\S]*?)\}/gi)) {
    const familyMatch = block[1].match(/font-family\s*:\s*["']?([^"';}\n]+)["']?/i);
    if (!familyMatch) continue;
    const family = familyMatch[1].trim().replace(/^["']|["']$/g, "");
    if (family) families.add(family);
  }
  return [...families].sort((a, b) => a.localeCompare(b));
}

export function catalogEntryForFamily(
  family: string,
  source: FontCatalogEntry["source"] = "typekit",
): FontCatalogEntry {
  const stack =
    source === "nexus" ? NEXUS_FONT_STACK : `${family}, ${NEXUS_FONT_STACK}`;
  return { family, stack, source };
}

export function mergeFontCatalog(
  base: FontCatalogEntry[],
  typekitFamilies: string[],
): FontCatalogEntry[] {
  const byStack = new Map<string, FontCatalogEntry>();
  for (const entry of base) byStack.set(entry.stack, entry);
  for (const family of typekitFamilies) {
    const entry = catalogEntryForFamily(family, "typekit");
    byStack.set(entry.stack, entry);
  }
  return [...byStack.values()];
}

export function readTypekitKitId(): string {
  try {
    return localStorage.getItem(TYPEKIT_KIT_ID_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function writeTypekitKitId(kitId: string): void {
  try {
    const trimmed = kitId.trim().toLowerCase();
    if (!trimmed) localStorage.removeItem(TYPEKIT_KIT_ID_KEY);
    else localStorage.setItem(TYPEKIT_KIT_ID_KEY, trimmed);
  } catch {
    /* ignore */
  }
}

export function clearTypekitKitId(): void {
  try {
    localStorage.removeItem(TYPEKIT_KIT_ID_KEY);
  } catch {
    /* ignore */
  }
}

export function readFontCatalog(): FontCatalogEntry[] {
  try {
    const raw = localStorage.getItem(FONT_CATALOG_KEY);
    if (!raw) return [...DEFAULT_FONT_CATALOG];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [...DEFAULT_FONT_CATALOG];
    const entries: FontCatalogEntry[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;
      if (typeof record.family !== "string" || typeof record.stack !== "string") continue;
      const source = record.source === "typekit" ? "typekit" : "nexus";
      entries.push({ family: record.family, stack: record.stack, source });
    }
    return mergeFontCatalog(DEFAULT_FONT_CATALOG, entries.filter((e) => e.source === "typekit").map((e) => e.family));
  } catch {
    return [...DEFAULT_FONT_CATALOG];
  }
}

export function writeFontCatalog(catalog: FontCatalogEntry[]): void {
  try {
    localStorage.setItem(FONT_CATALOG_KEY, JSON.stringify(catalog));
  } catch {
    /* ignore */
  }
}

export function clearFontCatalogStorage(): void {
  try {
    localStorage.removeItem(FONT_CATALOG_KEY);
  } catch {
    /* ignore */
  }
}

/** Ensure a Typekit stylesheet link is in the document head. */
export function ensureTypekitLink(kitId: string): void {
  if (typeof document === "undefined") return;
  const id = kitId.trim().toLowerCase();
  const existing = document.querySelector<HTMLLinkElement>("link[data-nexus-typekit]");
  if (!id) {
    existing?.remove();
    return;
  }
  const href = typekitCssUrl(id);
  if (existing) {
    if (existing.href !== href) existing.href = href;
    return;
  }
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.dataset.nexusTypekit = id;
  document.head.appendChild(link);
}

export async function fetchTypekitFamilies(kitId: string): Promise<string[]> {
  const id = kitId.trim().toLowerCase();
  if (!isTypekitKitId(id)) throw new Error("Invalid Typekit kit id");
  const response = await fetch(`/__nexus/typekit-fonts?id=${encodeURIComponent(id)}`);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || `Could not load kit ${id}`);
  }
  const data = (await response.json()) as { families?: string[] };
  return Array.isArray(data.families) ? data.families : [];
}
