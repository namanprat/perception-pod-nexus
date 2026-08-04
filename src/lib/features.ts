/**
 * Which optional runtime libraries this site ships.
 *
 * These are *build-time* flags, not runtime ones. "Off" has to mean the bytes
 * never reach the browser, and no amount of localStorage can achieve that — so
 * the source of truth is src/features.json, read during the build, and the
 * /styling toggles rewrite that file through the same dev middleware the token
 * editors already use. Flipping a toggle changes the next build's output.
 *
 * This module deliberately does NOT import features.json: it is loaded both by
 * Vite (astro.config, components) and by bare Node (the dev middleware, tests),
 * and the two disagree about JSON import syntax. Callers read the JSON and pass
 * it through `normaliseFeatures`.
 */

/**
 * Replaced with literal `true`/`false` at build time by Vite `define` (see
 * astro.config.ts). Gating on these rather than on a `features.x` read is what
 * makes "off" mean "not in the bundle": Astro ships a component's hoisted
 * script the moment the component is imported, so only a literal the bundler
 * can fold will drop the import chain behind it.
 *
 * One per FEATURE_KEYS entry. Keep them in step.
 */
declare global {
  const __FEATURE_GSAP__: boolean;
  const __FEATURE_LENIS__: boolean;
  const __FEATURE_R3F__: boolean;
}

export const FEATURE_KEYS = ["gsap", "lenis", "r3f"] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];
export type Features = Record<FeatureKey, boolean>;

/** Lenis and GSAP carry the site's motion, so they are on out of the box. R3F
 *  drags in React + three (~hundreds of kB) for a canvas most pages never use. */
export const DEFAULT_FEATURES: Features = {
  gsap: true,
  lenis: true,
  r3f: false,
};

export type FeatureMeta = {
  /** Shown on the /styling toggle. */
  label: string;
  /** npm packages kept out of the bundle when this is off. */
  packages: readonly string[];
  /** What turning it on actually does. */
  note: string;
};

export const FEATURE_META: Record<FeatureKey, FeatureMeta> = {
  gsap: {
    label: "GSAP",
    packages: ["gsap"],
    note: "ScrollTrigger reveals on [data-animate]. Honours prefers-reduced-motion.",
  },
  lenis: {
    label: "Lenis",
    packages: ["lenis"],
    note: "Smooth scrolling, site-wide. Disables itself under prefers-reduced-motion.",
  },
  r3f: {
    label: "React Three Fiber",
    packages: ["@react-three/fiber", "three", "react", "react-dom"],
    note: "The react-three-start minimal scene on the home page. Adds the React renderer — the heaviest option by far.",
  },
};

const isFeatureKey = (value: string): value is FeatureKey =>
  (FEATURE_KEYS as readonly string[]).includes(value);

/**
 * Coerce whatever is sitting in features.json into a complete, boolean-valued
 * set. A missing, misspelled or non-boolean entry falls back to its default
 * rather than silently reading as "off".
 */
export function normaliseFeatures(raw: unknown): Features {
  if (typeof raw !== "object" || raw === null) return { ...DEFAULT_FEATURES };
  const source = raw as Record<string, unknown>;
  const next: Features = { ...DEFAULT_FEATURES };
  for (const key of Object.keys(source)) {
    const value = source[key];
    if (isFeatureKey(key) && typeof value === "boolean") next[key] = value;
  }
  return next;
}

/** Serialised exactly as the repo's features.json is formatted, so a toggle
 *  produces a one-line diff instead of a reformat. */
export function serialiseFeatures(features: Features): string {
  const body = FEATURE_KEYS.map((key) => `  ${JSON.stringify(key)}: ${features[key]}`).join(",\n");
  return `{\n${body}\n}\n`;
}
