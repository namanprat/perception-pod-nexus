/**
 * The one thing worth testing in the save-tokens middleware: applyPayload takes
 * unvalidated JSON from a browser and turns it into text written straight into
 * variables.css. If a check here goes soft, arbitrary strings land in the
 * stylesheet. Run with `npm test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyPayload, applyFeaturePayload } from "./save-tokens-plugin.ts";

const CSS = `:root {
  --swatch--brand-500: #eae9e4;
  --_typography---text-wrap--h1: balance;
  --_typography---font-weight--h1: 500;
  --_typography---font--primary: serif;
  --button--font-family: var(--_typography---font--secondary);
  --button--padding-block: var(--_spacing---space--3);
  --button--padding-inline: var(--_spacing---space--5);
  --button--radius: 100vw;
  --button-primary--background: var(--swatch--brand-500);
  --max-width--main: 90rem;
  --site--gutter-rung: 0;
  /* BEGIN EXTRA SWATCHES */
  /* END EXTRA SWATCHES */
}`;

test("valid values are written", () => {
  const out = applyPayload(CSS, {
    swatches: { brand: "#FF0000" },
    textStyleOptions: { wrap: { h1: "pretty" }, weight: { h1: "700" } },
    fontFamilies: { primary: "  Inter, sans-serif  " },
    buttonStyles: { primaryBackground: "var(--swatch--accent)" },
    container: { locked: true, widthRem: 72 },
    spacingRungs: { gutter: 1 },
    extraSwatches: { ink: "#123ABC" },
  });

  assert.match(out, /--swatch--brand-500: #ff0000;/); // normalised to lowercase
  assert.match(out, /--_typography---text-wrap--h1: pretty;/);
  assert.match(out, /--_typography---font-weight--h1: 700;/);
  assert.match(out, /--_typography---font--primary: Inter, sans-serif;/);
  assert.match(out, /--button-primary--background: var\(--swatch--accent\);/);
  assert.match(out, /--max-width--main: 72rem;/);
  assert.match(out, /--site--gutter-rung: 1;/);
  assert.match(out, /--swatch--ink: #123abc;/);
});

test("button padding preset and radius write through", () => {
  const out = applyPayload(CSS, {
    buttonStyles: {
      fontFamily: "var(--_typography---font-style--h6)",
      paddingPreset: "comfortable",
      radius: "0.5rem",
    },
  });
  assert.match(out, /--button--font-family: var\(--_typography---font-style--h6\);/);
  assert.match(out, /--button--padding-block: var\(--_spacing---space--4\);/);
  assert.match(out, /--button--padding-inline: var\(--_spacing---space--6\);/);
  assert.match(out, /--button--radius: 0\.5rem;/);
});

test("button pill radius writes 100vw", () => {
  const out = applyPayload(CSS, {
    buttonStyles: { radius: "100vw", paddingPreset: "compact" },
  });
  assert.match(out, /--button--radius: 100vw;/);
  assert.match(out, /--button--padding-block: var\(--_spacing---space--2\);/);
  assert.match(out, /--button--padding-inline: var\(--_spacing---space--4\);/);
});

test("hostile button padding or radius change nothing", () => {
  const out = applyPayload(CSS, {
    buttonStyles: {
      paddingPreset: "huge",
      radius: "10px; } body { display: none",
      fontFamily: "Comic Sans",
    },
  });
  assert.equal(out, CSS);
});

test("hostile or malformed values change nothing", () => {
  const out = applyPayload(CSS, {
    swatches: { brand: "red; } body { display: none" },
    textStyleOptions: { wrap: { h1: "evil" }, weight: { h1: "999" } },
    buttonStyles: { primaryBackground: "url(https://evil.example)" },
    extraSwatches: { "Bad Slug": "#000000", ok: "not-a-hex" },
    container: "nope",
    spacingRungs: "nope",
  });

  assert.equal(out, CSS);
});

test("out-of-range rungs clamp instead of passing through", () => {
  assert.match(applyPayload(CSS, { spacingRungs: { gutter: 99 } }), /--site--gutter-rung: 2;/);
  assert.match(applyPayload(CSS, { spacingRungs: { gutter: -99 } }), /--site--gutter-rung: -2;/);
  assert.match(applyPayload(CSS, { spacingRungs: { gutter: "x" } }), /--site--gutter-rung: 0;/);
});

test("an unlocked container falls back to 100vw", () => {
  const out = applyPayload(CSS, { container: { locked: false, widthRem: 72 } });
  assert.match(out, /--max-width--main: 100vw;/);
});

test("a non-object payload is a no-op", () => {
  for (const payload of [null, "string", 42, undefined]) {
    assert.equal(applyPayload(CSS, payload), CSS);
  }
});

/* Feature flags decide what gets bundled, so a payload that fails to parse must
   never read as "everything off" — that would silently strip the site's motion
   on the next build. */
const FEATURES_JSON = `{\n  "gsap": true,\n  "lenis": true,\n  "r3f": false\n}\n`;

test("a partial feature payload only moves the flag it names", () => {
  const out = applyFeaturePayload(FEATURES_JSON, { features: { r3f: true } });
  assert.equal(out, `{\n  "gsap": true,\n  "lenis": true,\n  "r3f": true\n}\n`);
});

test("payloads with no features key leave the file alone", () => {
  for (const payload of [{ swatches: { brand: "#ffffff" } }, {}, null, "nope"]) {
    assert.equal(applyFeaturePayload(FEATURES_JSON, payload), null);
  }
});

test("unknown keys and non-booleans fall back to defaults, never to off", () => {
  const out = applyFeaturePayload(FEATURES_JSON, {
    features: { gsap: "yes", nope: true, r3f: 1 },
  });
  // gsap/r3f were not valid booleans, so they keep their defaults (on/off),
  // and the bogus key is dropped entirely.
  assert.equal(out, `{\n  "gsap": true,\n  "lenis": true,\n  "r3f": false\n}\n`);
});

test("an unparseable features.json rebuilds from defaults, not from nothing", () => {
  const out = applyFeaturePayload("{ not json", { features: { r3f: true } });
  assert.equal(out, `{\n  "gsap": true,\n  "lenis": true,\n  "r3f": true\n}\n`);
});

import { parseTypekitFontFamilies } from "../src/lib/typekit.ts";

test("typekit css yields unique font-family names", () => {
  const css = `
    @font-face { font-family: "ivypresto-display"; font-weight: 400; }
    @font-face { font-family: "ivypresto-display"; font-weight: 700; }
    @font-face { font-family: futura-pt; src: url(x); }
  `;
  assert.deepEqual(parseTypekitFontFamilies(css), ["futura-pt", "ivypresto-display"]);
});

test("typeStylesEnabled and typekitKitId round-trip through applyPayload", () => {
  const css = `:root {
  --_typography---type-styles-enabled: 1;
  --_typography---typekit-kit-id: none;
}`;
  const off = applyPayload(css, { typeStylesEnabled: false, typekitKitId: "nci7cab" });
  assert.match(off, /--_typography---type-styles-enabled: 0;/);
  assert.match(off, /--_typography---typekit-kit-id: nci7cab;/);
  const cleared = applyPayload(off, { typeStylesEnabled: true, typekitKitId: "" });
  assert.match(cleared, /--_typography---type-styles-enabled: 1;/);
  assert.match(cleared, /--_typography---typekit-kit-id: none;/);
});
