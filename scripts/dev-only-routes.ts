/**
 * Two small build-time integrations.
 */
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";

/**
 * Keeps /styling available in `astro dev`, but strips the specimen HTML from
 * production output so that page never goes live with a published site.
 */
export function excludeStylingFromBuild(): AstroIntegration {
  return {
    name: "nexus-exclude-styling-from-build",
    hooks: {
      "astro:build:done": async ({ dir, logger }) => {
        const outDir = fileURLToPath(dir);
        await rm(join(outDir, "styling"), { recursive: true, force: true });
        logger.info("Excluded /styling from production build");
      },
    },
  };
}

/**
 * Restarts the dev server when src/features.json changes.
 *
 * The bundle flags reach the build as Vite `define` literals, and those are
 * computed once, while astro.config is loading. Without this, toggling a
 * feature from /styling rewrites the file and reloads the page but the server
 * keeps serving the old flags — the toggle looks broken, because it is. Astro
 * does not watch the file on its own: importing JSON from astro.config is not
 * enough to register it as a config dependency.
 */
export function watchFeatureFlags(): AstroIntegration {
  return {
    name: "nexus-watch-feature-flags",
    hooks: {
      "astro:config:setup": ({ addWatchFile }) => {
        addWatchFile(new URL("../src/features.json", import.meta.url));
      },
    },
  };
}
