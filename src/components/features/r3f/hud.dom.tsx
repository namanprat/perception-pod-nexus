/**
 * Ported from pmndrs/react-three-start, examples/minimal (MIT).
 * https://github.com/pmndrs/react-three-start
 *
 * `*.dom.tsx` files render in the DOM overlay above the Canvas.
 *
 * Only change from upstream: the colour. Upstream hard-codes black for its own
 * white shell; this site's theme is dark, so it reads off --_theme---text like
 * everything else here.
 */
export default function Hud() {
  return (
    <div
      style={{
        position: "absolute",
        top: 24,
        left: 24,
        color: "var(--_theme---text)",
        fontFamily: "system-ui, sans-serif",
        fontSize: 14,
        pointerEvents: "auto",
      }}
    >
      react-three-start minimal
    </div>
  );
}
