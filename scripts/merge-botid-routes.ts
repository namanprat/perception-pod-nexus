/**
 * Astro’s Vercel adapter emits Build Output API config and does not merge
 * root vercel.json rewrites/headers. BotID needs those challenge/proxy routes,
 * so this post-build step injects them into `.vercel/output/config.json`.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { getTransformedRoutes } from "@vercel/routing-utils";

const root = process.cwd();
const vercelJsonPath = join(root, "vercel.json");
const configPath = join(root, ".vercel/output/config.json");

if (!existsSync(configPath)) {
  console.warn("[merge-botid-routes] No .vercel/output/config.json — skipping");
  process.exit(0);
}

if (!existsSync(vercelJsonPath)) {
  console.warn("[merge-botid-routes] No vercel.json — skipping");
  process.exit(0);
}

const vercelJson = JSON.parse(readFileSync(vercelJsonPath, "utf8")) as {
  rewrites?: Array<{ source: string; destination: string }>;
  headers?: Array<{
    source: string;
    headers: Array<{ key: string; value: string }>;
  }>;
};

const { routes: botidRoutes = [], error } = getTransformedRoutes({
  rewrites: vercelJson.rewrites ?? [],
  redirects: [],
  headers: vercelJson.headers ?? [],
});

if (error) {
  console.error("[merge-botid-routes] Failed to transform routes:", error.message);
  process.exit(1);
}

if (!botidRoutes.length) {
  console.warn("[merge-botid-routes] No BotID routes to merge");
  process.exit(0);
}

const config = JSON.parse(readFileSync(configPath, "utf8")) as {
  version: number;
  routes: Array<Record<string, unknown>>;
  images?: unknown;
};

const existing = config.routes ?? [];
const alreadyMerged = existing.some(
  (r) =>
    typeof r.src === "string" &&
    r.src.includes("149e9513-01fa-4fb0-aad4-566afd725d1b"),
);

if (alreadyMerged) {
  console.log("[merge-botid-routes] BotID routes already present");
  process.exit(0);
}

// Preserve beforeFiles / afterFiles relative to filesystem (skip duplicate handle).
const botidFs = botidRoutes.findIndex(
  (r) => "handle" in r && (r as { handle?: string }).handle === "filesystem",
);
const beforeFs = botidRoutes
  .slice(0, botidFs >= 0 ? botidFs : 0)
  .filter((r) => !("handle" in r));
const afterFs = botidRoutes
  .slice(botidFs >= 0 ? botidFs + 1 : 0)
  .filter((r) => !("handle" in r));

const fsIndex = existing.findIndex(
  (r) => "handle" in r && r.handle === "filesystem",
);

let merged: Array<Record<string, unknown>>;
if (fsIndex >= 0) {
  merged = [
    ...existing.slice(0, fsIndex),
    ...beforeFs,
    existing[fsIndex],
    ...afterFs,
    ...existing.slice(fsIndex + 1),
  ];
} else {
  merged = [...beforeFs, ...afterFs, ...existing];
}

config.routes = merged;
writeFileSync(configPath, `${JSON.stringify(config, null, "\t")}\n`);
console.log(
  `[merge-botid-routes] Injected ${beforeFs.length + afterFs.length} BotID route(s)`,
);
