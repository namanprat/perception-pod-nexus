#!/usr/bin/env node
/**
 * Proves the bundle flags actually gate the bundle.
 *
 * The whole promise of src/features.json is that "off" means the bytes never
 * reach the browser. That rests on an assumption about Astro — that a component
 * which is never rendered never has its script hoisted into the page — and an
 * assumption is not a guarantee. So this builds the site for real, once per
 * combination that matters, and greps the emitted client assets for each
 * library's fingerprint.
 *
 * It restores src/features.json afterwards, including on failure.
 *
 * Run with `npm run check:features`. Slow by design (one full build per case).
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync, statSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  FEATURE_KEYS,
  normaliseFeatures,
  serialiseFeatures,
  type FeatureKey,
  type Features,
} from "../src/lib/features.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const FEATURES_PATH = join(ROOT, "src/features.json");
const DIST = join(ROOT, "dist");

/* Strings that appear in the emitted assets only when the library itself is
   really there.
 *
 * These are library *internals* on purpose. The obvious choices — "gsap",
 * "lenis", "react-dom" — are all package names, and package names are also
 * printed on the /styling toggles via FEATURE_META. The styling page's script
 * chunk survives in dist/ even though the integration strips the page's HTML,
 * so matching on a package name reports a hit that is really just our own UI
 * label. Every marker below was checked to appear in zero source files. */
const FINGERPRINTS: Record<FeatureKey, readonly string[]> = {
  gsap: ["_gsap"],
  lenis: ["virtualScroll"],
  r3f: ["WebGLRenderer", "Minified React error"],
};

const failures: string[] = [];

const walk = (dir: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
};

/** Every byte the browser could load: JS, CSS and the HTML that references it. */
function readClientAssets(): string {
  return walk(DIST)
    .filter((file) => /\.(js|mjs|css|html)$/.test(file))
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");
}

function build(features: Features): string {
  writeFileSync(FEATURES_PATH, serialiseFeatures(features), "utf8");
  rmSync(DIST, { recursive: true, force: true });
  execFileSync("npx", ["astro", "build"], { cwd: ROOT, stdio: "pipe" });
  return readClientAssets();
}

const original = readFileSync(FEATURES_PATH, "utf8");
const allOff: Features = { gsap: false, lenis: false, r3f: false };
const allOn: Features = { gsap: true, lenis: true, r3f: true };

try {
  /* Case 1 — everything off: no fingerprint may survive anywhere. This is the
     claim that actually matters; the rest is a control. */
  const offAssets = build(allOff);
  for (const key of FEATURE_KEYS) {
    for (const mark of FINGERPRINTS[key]) {
      if (offAssets.includes(mark)) {
        failures.push(`${key} is off but "${mark}" still appears in dist/ — it is shipping anyway`);
      }
    }
  }

  /* Case 2 — everything on: the fingerprints must come back. Without this a
     broken build (or a typo'd fingerprint) would make case 1 pass vacuously. */
  const onAssets = build(allOn);
  for (const key of FEATURE_KEYS) {
    for (const mark of FINGERPRINTS[key]) {
      if (!onAssets.includes(mark)) {
        failures.push(
          `${key} is on but "${mark}" is absent from dist/ — the gate is stuck shut, ` +
            `or the fingerprint no longer matches what the library emits`
        );
      }
    }
  }
} finally {
  writeFileSync(FEATURES_PATH, original, "utf8");
}

if (failures.length) {
  console.error(`\n✗ ${failures.length} bundle gate problem(s):\n`);
  for (const message of failures) console.error(`  · ${message}`);
  console.error("");
  process.exit(1);
}

const enabled = normaliseFeatures(JSON.parse(original));
console.log(
  `✓ bundle gates ok — off ships nothing, on ships all of ${FEATURE_KEYS.join(", ")}\n` +
    `  features.json restored to: ${FEATURE_KEYS.filter((k) => enabled[k]).join(", ") || "none"}`
);
