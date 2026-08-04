import { gsap, CustomEase, getLenis, prefersReducedMotion } from "./gsapRuntime.js";
import { playHeroReveal, skipHeroToFinalState } from "./hero.js";
import { resetScrollTop, setupPageInitialStates } from "./initialStates.js";

/** Exit timings ×1.3 (30% slower than the Larose reference). */
const EXIT = {
  fadeLogo: 0.5 * 1.3,
  slide: 0.8 * 1.3,
  curve: 0.7 * 1.3,
  delaySlide: 0.2 * 1.3,
  delayCurve: 0.3 * 1.3,
};

function curvePaths(width, height) {
  const midX = width / 2;
  return {
    initial: `M0 0 L${width} 0 L${width} ${height} Q${midX} ${height + 300} 0 ${height} L0 0`,
    flat: `M0 0 L${width} 0 L${width} ${height} Q${midX} ${height} 0 ${height} L0 0`,
  };
}

function lockScroll() {
  document.documentElement.classList.add("is-preloading");
  getLenis()?.stop();
}

function unlockScroll() {
  resetScrollTop();
  document.documentElement.classList.remove("is-preloading");
  getLenis()?.start();
}

export async function initPreloader({ onComplete } = {}) {
  resetScrollTop();

  if (!CustomEase.get("preloaderExit")) {
    CustomEase.create("preloaderExit", "0.76, 0, 0.24, 1");
  }

  const wrap = document.querySelector(".preloader_wrap");
  if (!wrap) {
    await setupPageInitialStates();
    unlockScroll();
    if (prefersReducedMotion()) {
      skipHeroToFinalState();
    } else {
      playHeroReveal();
    }
    onComplete?.();
    return;
  }

  await setupPageInitialStates();

  if (prefersReducedMotion()) {
    gsap.set(wrap, { display: "none" });
    unlockScroll();
    skipHeroToFinalState();
    onComplete?.();
    return;
  }

  lockScroll();
  resetScrollTop();

  const logo = document.querySelector(".preloader_logo");
  const bar = document.querySelector(".preloader_progressbar");
  const curvePath = document.querySelector(".preloader_curve_path");

  const { initial: initialPath, flat: flatPath } = curvePaths(
    window.innerWidth,
    window.innerHeight,
  );
  if (curvePath) {
    curvePath.setAttribute("d", initialPath);
  }

  if (bar) {
    gsap.set(bar, { scaleX: 0, transformOrigin: "left center" });
  }

  let heroRevealed = false;
  const revealHero = () => {
    if (heroRevealed) return;
    heroRevealed = true;
    playHeroReveal();
  };

  const tl = gsap.timeline({
    onComplete: () => {
      unlockScroll();
      gsap.set(wrap, { display: "none" });
      revealHero();
      onComplete?.();
    },
  });

  // 1. Logo-masked progress fill
  if (bar) {
    tl.to(bar, {
      scaleX: 1,
      duration: 3,
      ease: "none",
    });
  } else {
    tl.to({}, { duration: 3 });
  }

  // 2. Fade logo
  if (logo) {
    tl.to(logo, { autoAlpha: 0, duration: EXIT.fadeLogo, ease: "power2.out" });
  }

  // 3. Curved slide-up exit
  tl.addLabel("exit");

  tl.to(
    wrap,
    {
      top: "-100vh",
      duration: EXIT.slide,
      ease: "preloaderExit",
    },
    `exit+=${EXIT.delaySlide}`,
  );

  if (curvePath) {
    tl.to(
      curvePath,
      {
        attr: { d: flatPath },
        duration: EXIT.curve,
        ease: "preloaderExit",
      },
      `exit+=${EXIT.delayCurve}`,
    );
  }

  // Hero reveal when the slide is halfway through
  tl.call(revealHero, null, `exit+=${EXIT.delaySlide + EXIT.slide * 0.5}`);
}
