import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import { CustomEase } from "gsap/CustomEase";

const SPLIT_TEXT_URL =
  "https://cdn.prod.website-files.com/gsap/3.15.0/SplitText.min.js";

let splitTextPromise = null;
let reducedMotion = false;
let lenisBound = null;
let tickerFn = null;
let lenisListener = null;

export function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function getLenis() {
  return window.__nexusLenis ?? null;
}

export function loadSplitText() {
  if (splitTextPromise) return splitTextPromise;
  if (window.SplitText) {
    gsap.registerPlugin(window.SplitText);
    return Promise.resolve(window.SplitText);
  }

  splitTextPromise = new Promise((resolve, reject) => {
    window.gsap = gsap;
    const script = document.createElement("script");
    script.src = SPLIT_TEXT_URL;
    script.async = true;
    script.onload = () => {
      if (window.SplitText) {
        gsap.registerPlugin(window.SplitText);
        resolve(window.SplitText);
      } else {
        reject(new Error("SplitText failed to load"));
      }
    };
    script.onerror = () => reject(new Error("SplitText script error"));
    document.head.appendChild(script);
  });

  return splitTextPromise;
}

/** Keep Lenis + ScrollTrigger on one RAF (gsap.ticker). Idempotent. */
export function bindLenisScrollTrigger(lenis = getLenis()) {
  if (reducedMotion || !lenis) {
    unbindLenisScrollTrigger();
    return false;
  }
  if (lenisBound === lenis) return true;

  unbindLenisScrollTrigger();

  lenisBound = lenis;
  lenis.on("scroll", ScrollTrigger.update);

  tickerFn = (time) => {
    lenis.raf(time * 1000);
  };
  gsap.ticker.add(tickerFn);
  gsap.ticker.lagSmoothing(0);

  return true;
}

export function unbindLenisScrollTrigger() {
  if (lenisBound) {
    lenisBound.off("scroll", ScrollTrigger.update);
    lenisBound = null;
  }
  if (tickerFn) {
    gsap.ticker.remove(tickerFn);
    tickerFn = null;
  }
}

export function initGsapRuntime() {
  reducedMotion = prefersReducedMotion();
  gsap.registerPlugin(ScrollTrigger, ScrollToPlugin, CustomEase);

  // Lenis may boot after this module — bind now and on late create.
  bindLenisScrollTrigger();
  if (!lenisListener) {
    lenisListener = (event) => {
      bindLenisScrollTrigger(event.detail ?? getLenis());
      ScrollTrigger.refresh();
    };
    window.addEventListener("nexus:lenis", lenisListener);
  }

  ScrollTrigger.refresh();

  return { lenis: getLenis(), reducedMotion, gsap };
}

export function destroyGsapRuntime() {
  unbindLenisScrollTrigger();
  if (lenisListener) {
    window.removeEventListener("nexus:lenis", lenisListener);
    lenisListener = null;
  }
  ScrollTrigger.getAll().forEach((t) => t.kill());
}

export function scrollTo(target, { offset = 0, duration = 1.5 } = {}) {
  const el =
    typeof target === "string" ? document.querySelector(target) : target;

  if (!el) return;

  const lenis = getLenis();
  if (reducedMotion || !lenis) {
    el.scrollIntoView({ behavior: "auto", block: "start" });
    return;
  }

  lenis.scrollTo(el, { offset, duration: duration * 1000 });
}

export { gsap, ScrollTrigger, CustomEase };
