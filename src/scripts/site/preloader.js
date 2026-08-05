import { gsap, CustomEase, getLenis, prefersReducedMotion } from "./gsapRuntime.js";
import { playHeroReveal, skipHeroToFinalState } from "./hero.js";
import { resetScrollTop, setupPageInitialStates } from "./initialStates.js";
import { preloadScrubFrames } from "./scrubFrames.js";

/** Exit timings ×1.3 (30% slower than the Larose reference). */
const EXIT = {
  fadeLogo: 0.5 * 1.3,
  slide: 0.8 * 1.3,
  curve: 0.7 * 1.3,
  delaySlide: 0.2 * 1.3,
  delayCurve: 0.3 * 1.3,
};

/** Keep the bar from flashing past on a warm cache / fast network. */
const MIN_PRELOAD_MS = 1200;

/**
 * Curve bulge scales with the shorter viewport axis so the wipe reads the same
 * on phones, tablets, and wide desktops (clamped so it never disappears or
 * eats the whole screen).
 */
function curveBulge(width, height) {
  const shortSide = Math.min(width, height);
  return Math.round(Math.min(Math.max(shortSide * 0.22, 96), 320));
}

function curvePaths(width, height) {
  const bulge = curveBulge(width, height);
  const midX = width / 2;
  const bottom = height;
  return {
    bulge,
    viewBox: `0 0 ${width} ${bottom + bulge}`,
    initial: `M0 0 L${width} 0 L${width} ${bottom} Q${midX} ${bottom + bulge} 0 ${bottom} Z`,
    flat: `M0 0 L${width} 0 L${width} ${bottom} Q${midX} ${bottom} 0 ${bottom} Z`,
  };
}

function applyCurveGeometry(wrap, curveSvg, curvePath) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const paths = curvePaths(width, height);

  wrap?.style.setProperty("--preloader-curve-bulge", `${paths.bulge}px`);

  if (curveSvg) {
    curveSvg.setAttribute("viewBox", paths.viewBox);
    curveSvg.setAttribute("preserveAspectRatio", "none");
  }

  if (curvePath) {
    curvePath.setAttribute("d", paths.initial);
  }

  return paths;
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

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export async function initPreloader({ onComplete } = {}) {
  resetScrollTop();

  if (!CustomEase.get("preloaderExit")) {
    CustomEase.create("preloaderExit", "0.76, 0, 0.24, 1");
  }

  const wrap = document.querySelector(".preloader_wrap");
  if (!wrap) {
    await preloadScrubFrames({ eagerOnly: true }).catch(() => {});
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
    await preloadScrubFrames({ eagerOnly: true }).catch(() => {});
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
  const curveSvg = document.querySelector(".preloader_curve");
  const curvePath = document.querySelector(".preloader_curve_path");

  const { flat: flatPath } = applyCurveGeometry(wrap, curveSvg, curvePath);

  if (bar) {
    gsap.set(bar, { scaleX: 0, transformOrigin: "left center" });
  }

  const startedAt = performance.now();

  let framesReady = false;
  try {
    // Only block on the first eagerCount frames; the rest keep loading.
    await preloadScrubFrames({
      eagerOnly: true,
      onProgress: (loaded, total) => {
        if (!bar || total <= 0) return;
        gsap.to(bar, {
          scaleX: loaded / total,
          duration: 0.2,
          ease: "power1.out",
          overwrite: "auto",
        });
      },
    });
    framesReady = true;
  } catch (error) {
    console.error("Scrub frame preload failed:", error);
  }

  // Hold at 100% once the eager band is ready (remaining frames load in background).
  if (bar) {
    gsap.to(bar, {
      scaleX: 1,
      duration: framesReady ? 0.2 : 0.35,
      ease: "power1.out",
    });
  }

  if (framesReady) {
    const remaining = Math.max(0, MIN_PRELOAD_MS - (performance.now() - startedAt));
    if (remaining > 0) await wait(remaining);
  } else {
    await wait(350);
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

  // Fade logo, then curved slide-up exit (progress already filled by asset load).
  if (logo) {
    tl.to(logo, { autoAlpha: 0, duration: EXIT.fadeLogo, ease: "power2.out" });
  }

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
