import { gsap, getLenis, prefersReducedMotion } from "./gsapRuntime.js";
import { setupHeroInitialState } from "./hero.js";

/** Force the document (and Lenis, if present) to y = 0. */
export function resetScrollTop() {
  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }
  window.scrollTo(0, 0);
  getLenis()?.scrollTo(0, { immediate: true });
}

/**
 * Park every homepage reveal target at its animation "from" state
 * before the preloader exit so nothing flashes at rest.
 */
export async function setupPageInitialStates() {
  if (prefersReducedMotion()) return;

  await setupHeroInitialState();

  gsap.set(".nav_wrap", { yPercent: -100 });
  gsap.set(".footer_top, .footer_bottom", { opacity: 0, y: 32 });
  gsap.set(".manifesto_text", { opacity: 0.2 });

  const scrubHeader = document.querySelector(".scrub_text_header");
  const scrubBody = document.querySelector(".scrub_text_body");
  const scrubTargets = [scrubHeader, scrubBody].filter(Boolean);
  if (scrubTargets.length) {
    gsap.set(scrubTargets, { autoAlpha: 0 });
  }
}
