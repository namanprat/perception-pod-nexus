#!/usr/bin/env node
/**
 * Token & framework integrity check.
 *
 * What this guards:
 *
 *   1. A var() reference whose token was never declared. CSS degrades
 *      silently: the declaration drops and nothing in the browser reports it.
 *   2. The phi ladder drifting off the ratio after a hand edit.
 *   3. The column guides falling out of step with the column counts.
 *   4. Fluid type sizes with unequal clamp spans (mid-band ratio drift).
 *   5. Width-based @media outside nexus/responsive.css — use flags, keyword
 *      vars, or @container in components for one-offs.
 *   6. Gutter lock and margin = φ × gutter relationships.
 *
 * Node built-ins only — run with `npm run check:tokens`. Node strips the types
 * natively (>= 22.6), so there is no build step in front of this.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PHI = (1 + Math.sqrt(5)) / 2;
const SQRT_PHI = Math.sqrt(PHI);
const TOLERANCE = 0.005;
const RESPONSIVE_BANDS = ["wide", "xlarge", "large", "medium", "small", "xsmall"] as const;

const failures: string[] = [];
const fail = (msg: string) => failures.push(msg);

/* ── Collect source files ───────────────────────────────────────────────── */

const walk = (dir: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(css|astro)$/.test(full)) out.push(full);
  }
  return out;
};

type SourceFile = { path: string; rel: string; text: string };

const files: SourceFile[] = walk(join(ROOT, "src")).map((path) => ({
  path,
  rel: relative(ROOT, path),
  // Drop var() calls built from template expressions — `var(--column-width-${n})`
  // resolves at render time, so its name can't be checked statically.
  text: readFileSync(path, "utf8").replace(/var\(\s*[^)]*\$\{[^}]*\}[^)]*\)/g, "var(--dynamic)"),
}));

/* ── 1. Every var() reference resolves ──────────────────────────────────── */

const declared = new Set<string>(["--dynamic"]);
for (const { text } of files) {
  for (const match of text.matchAll(/(?:^|[;{\s"'`])(--[\w-]+)\s*:/gm)) declared.add(match[1]);
}

for (const { rel, text } of files) {
  const seen = new Set<string>();
  for (const match of text.matchAll(/var\(\s*(--[\w-]+)\s*([,)])/g)) {
    const [, name, next] = match;
    if (next === ",") continue; // has a fallback — degrades on purpose
    if (declared.has(name) || seen.has(name)) continue;
    seen.add(name);
    fail(`undeclared token ${name} referenced in ${rel}`);
  }
}

/* ── 2. The phi ladder is actually golden ───────────────────────────────── */

const tokensCss = readFileSync(join(ROOT, "src/styles/nexus/variables.css"), "utf8");

const rungs = [...tokensCss.matchAll(/--phi-(\d+):\s*([\d.]+);/g)]
  .map(([, index, value]) => ({ index: Number(index), value: Number(value) }))
  .sort((a, b) => a.index - b.index);

if (rungs.length < 3) {
  fail(`expected a --phi-* ladder in variables.css, found ${rungs.length} rungs`);
}

for (let i = 1; i < rungs.length; i++) {
  const ratio = rungs[i].value / rungs[i - 1].value;
  if (Math.abs(ratio - SQRT_PHI) > TOLERANCE) {
    fail(
      `--phi-${rungs[i].index} / --phi-${rungs[i - 1].index} = ${ratio.toFixed(5)}, ` +
        `expected sqrt(phi) ${SQRT_PHI.toFixed(5)} (±${TOLERANCE})`
    );
  }
}

for (let i = 2; i < rungs.length; i++) {
  const ratio = rungs[i].value / rungs[i - 2].value;
  if (Math.abs(ratio - PHI) > TOLERANCE) {
    fail(
      `--phi-${rungs[i].index} / --phi-${rungs[i - 2].index} = ${ratio.toFixed(5)}, ` +
        `expected phi ${PHI.toFixed(5)} (±${TOLERANCE})`
    );
  }
}

/* Every fluid display size must span exactly two rungs (a factor of phi).
   Uniform spans are what keep the ratios between sizes constant across the
   whole viewport band — mixed spans make them drift mid-band. */
const rungValues = new Set(rungs.map((r) => r.value));
const nearestRung = (value: number): number =>
  [...rungValues].reduce((best, v) => (Math.abs(v - value) < Math.abs(best - value) ? v : best));

for (const [, name, min, max] of tokensCss.matchAll(
  /--_typography---size--([\w-]+):\s*clamp\(\s*([\d.]+)rem\s*,[^,]*,\s*([\d.]+)rem\s*\)/g
)) {
  const [lo, hi] = [Number(min), Number(max)];

  for (const [label, value] of [
    ["min", lo],
    ["max", hi],
  ] as const) {
    if (Math.abs(nearestRung(value) - value) > 0.001) {
      fail(`--_typography---size--${name} ${label} ${value}rem is not a --phi-* rung`);
    }
  }

  const span = hi / lo;
  if (Math.abs(span - PHI) > TOLERANCE) {
    fail(
      `--_typography---size--${name} spans ${lo} -> ${hi} = ${span.toFixed(5)}, ` +
        `expected a two-rung phi span ${PHI.toFixed(5)} (±${TOLERANCE})`
    );
  }
}

/* Margin must stay phi x gutter — the relationship, not a copied number. */
const marginDecl = tokensCss.match(/--site--margin:\s*([\s\S]*?);/);
if (!marginDecl) {
  fail("could not find the --site--margin declaration in variables.css");
} else {
  if (!marginDecl[1].includes("--ratio--phi")) {
    fail("--site--margin no longer derives from --ratio--phi");
  }
  if (!marginDecl[1].includes("--site--gutter")) {
    fail("--site--margin no longer derives from --site--gutter, so the ratio can drift");
  }
}

/* The gutter must lock with the container. An unlocked (plain vw) gutter keeps
   widening past --max-width--main while the columns stay fixed. */
const gutterDecl = tokensCss.match(/--site--gutter:\s*([\s\S]*?);/);
if (!gutterDecl) {
  fail("could not find the --site--gutter declaration in variables.css");
} else if (!gutterDecl[1].includes("--max-width--main")) {
  fail(
    "--site--gutter is not capped by --max-width--main — past the lock width " +
      "the gaps grow but the columns do not"
  );
}

/* ── 3. Column counts, guides and the component agree ───────────────────── */

const countExpr = tokensCss.match(/--site--column-count:\s*calc\(([\s\S]*?)\);/)?.[1] ?? "";
const countsByBand = Object.fromEntries(
  RESPONSIVE_BANDS.map((size) => [
    size,
    Number(countExpr.match(new RegExp(`--_responsive---${size}\\)\\s*\\*\\s*(\\d+)`))?.[1]),
  ]),
) as Record<(typeof RESPONSIVE_BANDS)[number], number>;

if (RESPONSIVE_BANDS.some((size) => Number.isNaN(countsByBand[size]))) {
  fail("could not read per-breakpoint column counts from --site--column-count");
}

/* Twelve-column desktop grid: 12 / 8 / 4 across large / medium / small. */
const EXPECTED_COUNTS = {
  wide: 12,
  xlarge: 12,
  large: 12,
  medium: 8,
  small: 4,
  xsmall: 4,
} as const;

for (const size of RESPONSIVE_BANDS) {
  if (countsByBand[size] !== EXPECTED_COUNTS[size]) {
    fail(
      `column count at ${size} is ${countsByBand[size]}, expected ${EXPECTED_COUNTS[size]}`
    );
  }
}

/* The guides hide surplus columns with keyword variables. A column is hidden
   from the breakpoint below the one where the count drops, so the thresholds
   are (next count + 1). */
const utilitiesCss = readFileSync(join(ROOT, "src/styles/nexus/utilities.css"), "utf8");
const gridLines = readFileSync(join(ROOT, "src/components/GridLines.astro"), "utf8");

for (const [size, nextCount] of [
  ["medium", countsByBand.medium],
  ["small", countsByBand.small],
] as const) {
  const threshold = nextCount + 1;
  const rule = new RegExp(
    `\\.u-grid-lines_col\\.is-${threshold}\\s*\\{[^}]*var\\(--none-${size},`
  );
  if (!rule.test(utilitiesCss)) {
    fail(
      `utilities.css is missing '.u-grid-lines_col.is-${threshold} { display: ` +
        `var(--none-${size}, block) }' — the ${size} count is ${nextCount}`
    );
  }
  if (!gridLines.includes(`is-${threshold}`)) {
    fail(`GridLines.astro never assigns is-${threshold}, so no column is hidden at ${size}`);
  }
}

const rendered = Number(gridLines.match(/length:\s*(\d+)/)?.[1]);
const baseCount = countsByBand.large;
if (rendered !== baseCount) {
  fail(`GridLines.astro renders ${rendered} columns, the base grid is ${baseCount}`);
}

const spans = [...tokensCss.matchAll(/--site--span-(\d+):\s*([^;]+);/g)].map(
  ([, index, value]) => ({ n: Number(index), value })
);

if (!spans.length) {
  fail("no --site--span-* helpers found in variables.css");
}

for (const { n, value } of spans) {
  if (n === 1) {
    if (!/var\(--site--column-width\)/.test(value)) {
      fail(`--site--span-1 should be --site--column-width, got "${value.trim()}"`);
    }
    continue;
  }
  if (!value.includes("--site--column-width-plus-gutter")) {
    fail(`--site--span-${n} does not derive from --site--column-width-plus-gutter`);
  }
  if (!new RegExp(`\\*\\s*${n}\\b`).test(value)) {
    fail(`--site--span-${n} does not multiply by ${n}`);
  }
  if (!/-\s*var\(--site--gutter\)/.test(value)) {
    fail(`--site--span-${n} never subtracts the trailing gutter, so it is one gutter too wide`);
  }
}

const utilitySpans = [...utilitiesCss.matchAll(/\.u-column-span-(\d+)\s*\{/g)].map((m) =>
  Number(m[1])
);
const spanNumbers = new Set(spans.map((s) => s.n));

for (const n of utilitySpans) {
  if (!spanNumbers.has(n)) {
    fail(`.u-column-span-${n} exists but --site--span-${n} does not`);
  }
}
for (const n of spanNumbers) {
  if (n !== 1 && !utilitySpans.includes(n)) {
    fail(`--site--span-${n} exists but .u-column-span-${n} does not`);
  }
}

/* ── 4. Nexus contract: width @media only in the responsive layer ─────────
   @container in components/pages is the escape hatch for one-off layout.
   Do not add bespoke keywords to responsive.css unless ≥2 sites need them. */

for (const { rel, text } of files) {
  if (rel.endsWith("nexus/responsive.css")) continue;
  const offenders = [...text.matchAll(/@media[^{]*\b(width|min-width|max-width)\b[^{]*\{/g)];
  if (offenders.length) {
    fail(
      `${rel} contains ${offenders.length} width-based @media rule(s) — put band ` +
        `flags/keywords in nexus/responsive.css, or use @container for one-offs`
    );
  }
}

/* ── Report ─────────────────────────────────────────────────────────────── */

if (failures.length) {
  console.error(`\n✗ ${failures.length} token problem(s):\n`);
  for (const message of failures) console.error(`  · ${message}`);
  console.error("");
  process.exit(1);
}

console.log(
  `✓ tokens ok — ${declared.size - 1} declared, ${rungs.length} phi rungs, ` +
    `columns ${RESPONSIVE_BANDS.map((b) => countsByBand[b]).join(" / ")}`
);
