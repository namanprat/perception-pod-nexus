// Live IST clock — fills every [data-clock] element.

export function initClock() {
  const targets = document.querySelectorAll("[data-clock]");
  if (targets.length === 0) return;

  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const render = () => {
    const value = `${formatter.format(new Date())} IST`;
    targets.forEach((node) => {
      if (node.textContent !== value) node.textContent = value;
    });
  };

  render();
  // ponytail: a 1s interval is fine for a wall clock; no drift correction needed.
  setInterval(render, 1000);
}
