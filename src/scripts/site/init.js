// Perception Pod — site entry. No WebGL gradient; cream theme bg from Nexus.
import "./botid.js";
import { initClock } from "./clock.js";
import { initBloomCards, destroyBloomCards } from "./bloomCards.js";
import { destroyGsapRuntime, initGsapRuntime, bindLenisScrollTrigger, ScrollTrigger } from "./gsapRuntime.js";
import { initPreloader } from "./preloader.js";
import { initPageAnimations } from "./page.js";
import { initFaq } from "./faq.js";
import { initContactMenu } from "./contactMenu.js";
import { resetScrollTop } from "./initialStates.js";

export function initSite() {
  resetScrollTop();
  initClock();

  const runtime = initGsapRuntime();
  // Attach Contact listeners immediately — do not wait on page animation setup.
  initContactMenu();

  initPreloader({
    onComplete: async () => {
      resetScrollTop();
      // Lenis may have been created after first bind attempt — re-sync before pins.
      bindLenisScrollTrigger();
      await initPageAnimations(runtime);
      initFaq();
      // After scrub pins exist so Bloom’s pin stacks below, not over, prior sections.
      initBloomCards();
      ScrollTrigger.refresh();
    },
  });

  window.addEventListener("pagehide", () => {
    destroyBloomCards();
    destroyGsapRuntime();
  });
}
