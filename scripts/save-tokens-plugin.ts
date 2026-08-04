/**
 * Vite middleware (astro dev only): POST /__nexus/save-tokens writes the
 * styling-page token edits into src/styles/nexus/variables.css.
 *
 * The payload arrives from the browser, so it is typed `unknown` and narrowed
 * here rather than trusted — every value that reaches variables.css has to pass
 * one of the shape checks below.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { IncomingMessage } from "node:http";
import type { Plugin } from "vite";
import { normaliseFeatures, serialiseFeatures } from "../src/lib/features.ts";
import {
  isTypekitKitId,
  parseTypekitFontFamilies,
  typekitCssUrl,
} from "../src/lib/typekit.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const VARIABLES_PATH = join(ROOT, "src/styles/nexus/variables.css");
const FEATURES_PATH = join(ROOT, "src/features.json");
const KIT_ID_TOKEN = "--_typography---typekit-kit-id";
const TYPE_STYLES_ENABLED_TOKEN = "--_typography---type-styles-enabled";
const KIT_ID_RE = /^[a-z0-9]{5,10}$/i;

const SWATCH_TOKENS: Record<string, string> = {
  light: "--swatch--light-100",
  dark: "--swatch--dark-900",
  brand: "--swatch--brand-500",
  accent: "--swatch--accent",
  overscroll: "--swatch--overscroll",
};

const FAMILY_TOKENS: Record<string, string> = {
  primary: "--_typography---font--primary",
  secondary: "--_typography---font--secondary",
  tertiary: "--_typography---font--tertiary",
};

const BUTTON_STYLE_TOKENS: Record<string, string> = {
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

const BUTTON_PADDING_PRESETS: Record<string, { block: string; inline: string }> = {
  compact: {
    block: "var(--_spacing---space--2)",
    inline: "var(--_spacing---space--4)",
  },
  default: {
    block: "var(--_spacing---space--3)",
    inline: "var(--_spacing---space--5)",
  },
  comfortable: {
    block: "var(--_spacing---space--4)",
    inline: "var(--_spacing---space--6)",
  },
};

const BUTTON_VAR_RE = /^var\(--[a-zA-Z0-9_-]+\)$/;
const BUTTON_RADIUS_RE = /^(\d*\.?\d+rem|100vw)$/;
const BUTTON_PADDING_PRESET_RE = /^(compact|default|comfortable)$/;

const TEXT_STYLE_KEYS = [
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
];

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const ROLE_RE = /^(primary|secondary|tertiary)$/;
const WRAP_RE = /^(balance|pretty|wrap|nowrap|stable)$/;
const TRANSFORM_RE = /^(none|uppercase|lowercase|capitalize)$/;
const ALIGN_RE = /^(start|center|end|justify)$/;
const WEIGHT_RE = /^(300|400|500|600|700)$/;

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null;

/** The record at `key`, or undefined when the client sent something else. */
const recordAt = (source: UnknownRecord, key: string): UnknownRecord | undefined => {
  const value = source[key];
  return isRecord(value) ? value : undefined;
};

/** The string at `key` when it matches `pattern`, trimmed. */
const matchedString = (
  source: UnknownRecord,
  key: string,
  pattern: RegExp
): string | undefined => {
  const value = source[key];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return pattern.test(trimmed) ? trimmed : undefined;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceDecl(css: string, prop: string, value: string): string {
  const re = new RegExp(`(${escapeRegExp(prop)}\\s*:\\s*)([^;]+)(;)`);
  if (!re.test(css)) {
    throw new Error(`declaration not found: ${prop}`);
  }
  return css.replace(re, `$1${value}$3`);
}

const EXTRA_START = "/* BEGIN EXTRA SWATCHES */";
const EXTRA_END = "/* END EXTRA SWATCHES */";
const EXTRA_SLUG_RE = /^[a-z][a-z0-9-]{0,31}$/;

function writeExtraSwatchesBlock(css: string, extras: UnknownRecord): string {
  const lines = [EXTRA_START];
  for (const slug of Object.keys(extras).sort()) {
    const hex = extras[slug];
    if (!EXTRA_SLUG_RE.test(slug) || typeof hex !== "string" || !HEX_RE.test(hex)) continue;
    lines.push(`  --swatch--${slug}: ${hex.toLowerCase()};`);
  }
  lines.push(`  ${EXTRA_END}`);
  const block = lines.join("\n");
  const re = /\/\* BEGIN EXTRA SWATCHES \*\/[\s\S]*?\/\* END EXTRA SWATCHES \*\//;
  if (!re.test(css)) {
    throw new Error("EXTRA SWATCHES markers missing from variables.css");
  }
  return css.replace(re, block);
}

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

/** Exported for save-tokens-plugin.test.ts — the validation is the risky part. */
export function applyPayload(css: string, payload: unknown): string {
  let next = css;
  if (!isRecord(payload)) return next;

  const swatches = recordAt(payload, "swatches");
  if (swatches) {
    for (const [key, token] of Object.entries(SWATCH_TOKENS)) {
      const value = matchedString(swatches, key, HEX_RE);
      if (value) next = replaceDecl(next, token, value.toLowerCase());
    }
  }

  const extraSwatches = recordAt(payload, "extraSwatches");
  if (extraSwatches) {
    next = writeExtraSwatchesBlock(next, extraSwatches);
  }

  const fontFamilies = recordAt(payload, "fontFamilies");
  if (fontFamilies) {
    for (const [key, token] of Object.entries(FAMILY_TOKENS)) {
      const value = matchedString(fontFamilies, key, /\S/);
      if (value) next = replaceDecl(next, token, value);
    }
  }

  const textStyleFonts = recordAt(payload, "textStyleFonts");
  if (textStyleFonts) {
    for (const key of TEXT_STYLE_KEYS) {
      const role = matchedString(textStyleFonts, key, ROLE_RE);
      if (role) {
        next = replaceDecl(
          next,
          `--_typography---font-style--${key}`,
          `var(--_typography---font--${role})`,
        );
      }
    }
  }

  const textStyleOptions = recordAt(payload, "textStyleOptions");
  if (textStyleOptions) {
    const wrap = recordAt(textStyleOptions, "wrap");
    const transform = recordAt(textStyleOptions, "transform");
    const align = recordAt(textStyleOptions, "align");
    const weight = recordAt(textStyleOptions, "weight");
    for (const key of TEXT_STYLE_KEYS) {
      const wrapValue = wrap && matchedString(wrap, key, WRAP_RE);
      const transformValue = transform && matchedString(transform, key, TRANSFORM_RE);
      const alignValue = align && matchedString(align, key, ALIGN_RE);
      const weightValue = weight && matchedString(weight, key, WEIGHT_RE);
      if (wrapValue) {
        next = replaceDecl(next, `--_typography---text-wrap--${key}`, wrapValue);
      }
      if (transformValue) {
        next = replaceDecl(next, `--_typography---text-transform--${key}`, transformValue);
      }
      if (alignValue) {
        next = replaceDecl(next, `--_typography---text-align--${key}`, alignValue);
      }
      if (weightValue) {
        next = replaceDecl(next, `--_typography---font-weight--${key}`, weightValue);
      }
    }
  }

  const buttonStyles = recordAt(payload, "buttonStyles");
  if (buttonStyles) {
    for (const [key, token] of Object.entries(BUTTON_STYLE_TOKENS)) {
      if (key === "radius") {
        const radius = matchedString(buttonStyles, key, BUTTON_RADIUS_RE);
        if (radius) next = replaceDecl(next, token, radius);
        continue;
      }
      const value = matchedString(buttonStyles, key, BUTTON_VAR_RE);
      if (value) next = replaceDecl(next, token, value);
    }
    const preset = matchedString(buttonStyles, "paddingPreset", BUTTON_PADDING_PRESET_RE);
    if (preset && BUTTON_PADDING_PRESETS[preset]) {
      const spaces = BUTTON_PADDING_PRESETS[preset];
      next = replaceDecl(next, "--button--padding-block", spaces.block);
      next = replaceDecl(next, "--button--padding-inline", spaces.inline);
    }
  }

  const container = recordAt(payload, "container");
  if (container) {
    const locked = container.locked !== false;
    const widthRem = Number(container.widthRem);
    const value =
      locked && Number.isFinite(widthRem) && widthRem > 0
        ? `${widthRem}rem`
        : "100vw";
    next = replaceDecl(next, "--max-width--main", value);
  }

  const spacingRungs = recordAt(payload, "spacingRungs");
  if (spacingRungs) {
    const clampRung = (value: unknown): number => {
      const n = Number(value);
      if (!Number.isFinite(n)) return 0;
      return Math.min(2, Math.max(-2, Math.round(n)));
    };
    if ("gutter" in spacingRungs) {
      next = replaceDecl(next, "--site--gutter-rung", String(clampRung(spacingRungs.gutter)));
    }
    if ("padding" in spacingRungs) {
      next = replaceDecl(
        next,
        "--_spacing---padding-rung",
        String(clampRung(spacingRungs.padding)),
      );
    }
  }

  if ("typeStylesEnabled" in payload) {
    const enabled = payload.typeStylesEnabled !== false && payload.typeStylesEnabled !== 0;
    next = replaceDecl(next, TYPE_STYLES_ENABLED_TOKEN, enabled ? "1" : "0");
  }

  if ("typekitKitId" in payload) {
    const raw = payload.typekitKitId;
    if (raw === "" || raw === null) {
      next = replaceDecl(next, KIT_ID_TOKEN, "none");
    } else if (typeof raw === "string" && KIT_ID_RE.test(raw.trim())) {
      next = replaceDecl(next, KIT_ID_TOKEN, raw.trim().toLowerCase());
    }
  }

  return next;
}

/**
 * Feature flags live in their own file, not variables.css — they decide what
 * gets bundled, not how anything looks. Returns the new file contents, or null
 * when the payload carried no feature changes.
 *
 * Exported for save-tokens-plugin.test.ts.
 */
export function applyFeaturePayload(currentJson: string, payload: unknown): string | null {
  if (!isRecord(payload)) return null;
  const incoming = recordAt(payload, "features");
  if (!incoming) return null;

  let current: unknown;
  try {
    current = JSON.parse(currentJson);
  } catch {
    current = {};
  }

  /* Merge onto what is on disk so a partial payload only moves the flags it
     names, and normalise so a bogus value falls back to its default rather
     than reading as "off". */
  return serialiseFeatures(
    normaliseFeatures({ ...normaliseFeatures(current), ...incoming }),
  );
}

export function saveTokensPlugin(): Plugin {
  return {
    name: "nexus-save-tokens",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const rawUrl = req.url ?? "";
        const url = rawUrl.split("?")[0];

        if (url === "/__nexus/typekit-fonts") {
          if (req.method === "OPTIONS") {
            res.statusCode = 204;
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
            res.end();
            return;
          }
          if (req.method !== "GET") {
            res.statusCode = 405;
            res.end("Method Not Allowed");
            return;
          }
          try {
            const id = new URL(rawUrl, "http://localhost").searchParams.get("id") ?? "";
            if (!isTypekitKitId(id)) {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: false, error: "Invalid Typekit kit id" }));
              return;
            }
            const response = await fetch(typekitCssUrl(id));
            if (!response.ok) {
              res.statusCode = 502;
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  ok: false,
                  error: `Typekit responded ${response.status} for kit ${id}`,
                }),
              );
              return;
            }
            const css = await response.text();
            const families = parseTypekitFontFamilies(css);
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: true, kitId: id.trim().toLowerCase(), families }));
          } catch (error) {
            res.statusCode = 502;
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                ok: false,
                error: error instanceof Error ? error.message : String(error),
              }),
            );
          }
          return;
        }

        if (url !== "/__nexus/save-tokens") {
          next();
          return;
        }

        if (req.method === "OPTIONS") {
          res.statusCode = 204;
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
          res.setHeader("Access-Control-Allow-Headers", "Content-Type");
          res.end();
          return;
        }

        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method Not Allowed");
          return;
        }

        try {
          const payload = await readBody(req);
          const written: string[] = [];

          const current = readFileSync(VARIABLES_PATH, "utf8");
          const updated = applyPayload(current, payload);
          if (updated !== current) {
            writeFileSync(VARIABLES_PATH, updated, "utf8");
            written.push("src/styles/nexus/variables.css");
          }

          const currentFeatures = readFileSync(FEATURES_PATH, "utf8");
          const nextFeatures = applyFeaturePayload(currentFeatures, payload);
          if (nextFeatures !== null && nextFeatures !== currentFeatures) {
            writeFileSync(FEATURES_PATH, nextFeatures, "utf8");
            written.push("src/features.json");
          }

          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: true, written }));
        } catch (error) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              ok: false,
              error: error instanceof Error ? error.message : String(error),
            }),
          );
        }
      });
    },
  };
}
