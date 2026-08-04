import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import { saveTokensPlugin } from "./scripts/save-tokens-plugin.ts";
import { excludeStylingFromBuild, watchFeatureFlags } from "./scripts/dev-only-routes.ts";
import rawFeatures from "./src/features.json";
import { FEATURE_KEYS, normaliseFeatures } from "./src/lib/features.ts";

// No Lightning CSS transformer — esbuild handles the stylesheet pipeline.
// If you add glass surfaces that need backdrop-filter prefixes, install
// lightningcss and set vite.css.transformer = "lightningcss".
const features = normaliseFeatures(rawFeatures);

export default defineConfig({
  // The React renderer is pulled in only when R3F is on — a falsy entry here is
  // ignored by Astro, so with the flag off the integration never runs and no
  // react/react-dom client runtime is emitted. Toggle it from /styling.
  integrations: [excludeStylingFromBuild(), watchFeatureFlags(), features.r3f && react()],
  vite: {
    // Real compile-time literals, not runtime reads. Astro pulls in a
    // component's hoisted <script> (and any client: island) as soon as the
    // component is *imported*, whether or not it ever renders — so a plain
    // `{features.gsap && <Gsap />}` still shipped the library. `features[key]`
    // is a function call over a JSON import, which the bundler cannot
    // constant-fold; a defined literal it can, dropping the dynamic import
    // behind it and everything downstream. check:features proves this against
    // the real build output, in both directions.
    define: Object.fromEntries(
      FEATURE_KEYS.map((key) => [
        `__FEATURE_${key.toUpperCase()}__`,
        JSON.stringify(features[key]),
      ]),
    ),
    plugins: [saveTokensPlugin()],
  },
});
