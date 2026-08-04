/**
 * Resolve a CSS length custom property (e.g. `--_spacing---space--3`) to pixels.
 *
 * getComputedStyle().getPropertyValue() on a custom property returns the
 * *specified* value — you get the literal string "clamp(3.33rem, 2.87rem +
 * 2.29vw, 5.388rem)" back, not a number. Assigning it to a real length
 * property and measuring is the only way to get the resolved value.
 */
export function readCssLengthPx(customProperty: string, fallbackPx = 0): number {
  if (typeof document === "undefined") return fallbackPx;

  const probe = document.createElement("div");
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  probe.style.pointerEvents = "none";
  probe.style.width = `var(${customProperty})`;
  document.documentElement.appendChild(probe);
  const px = probe.getBoundingClientRect().width;
  probe.remove();

  return px > 0 ? px : fallbackPx;
}

/** Same, in rem, against the document root font size. */
export function readCssLengthRem(customProperty: string): number {
  const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  return readCssLengthPx(customProperty) / rootPx;
}
