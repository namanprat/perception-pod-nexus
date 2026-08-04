// Self-check for the Bloom pile slot math. Run: node src/scripts/site/bloomCards.check.mjs
import assert from "node:assert/strict";
import { slotYPercent, OFFSET_PERCENT } from "./bloomCards.js";

assert.equal(slotYPercent(0), -50); // first card lands dead center
assert.equal(slotYPercent(1), -50 + OFFSET_PERCENT); // each one a sliver lower
assert.equal(slotYPercent(4), -50 + 4 * OFFSET_PERCENT);
assert.ok(slotYPercent(4) > slotYPercent(0)); // pile drifts down, never up
assert.ok(Math.abs(slotYPercent(4) + 50) < 15); // whole pile stays near center

console.log("bloomCards slot math ok");
