import {
  gsap,
  ScrollTrigger,
  loadSplitText,
  scrollTo,
  prefersReducedMotion,
} from "./gsapRuntime.js";
import { initScrubText } from "./scrubText.js";

export async function initPageAnimations({ reducedMotion } = {}) {
  if (reducedMotion ?? prefersReducedMotion()) {
    gsap.set("[data-animate-in]", { opacity: 1, y: 0 });
    await initScrubText({ reducedMotion: true });
    bindScrollLinks();
    return;
  }

  const hasHover =
    !("ontouchstart" in window || navigator.maxTouchPoints > 0) &&
    window.innerWidth >= 1024;

  // Nav / footer / manifesto / scrub are parked in setupPageInitialStates.

  const heroMain = document.querySelector(".hero_wrap");
  const scrubWrap = document.querySelector("[data-scrub-text]");

  // Hero sits fixed over the scrub section; fades out across the first 100vh.
  if (heroMain && scrubWrap) {
    gsap.to(heroMain, {
      autoAlpha: 0,
      ease: "none",
      scrollTrigger: {
        trigger: scrubWrap,
        start: "top top",
        end: () => `+=${window.innerHeight}`,
        scrub: true,
      },
    });
  } else if (heroMain) {
    gsap.to(heroMain, {
      autoAlpha: 0,
      ease: "none",
      scrollTrigger: {
        trigger: heroMain,
        start: "top top",
        end: () => `+=${window.innerHeight}`,
        scrub: true,
      },
    });
  }

  initMagneticButtons(hasHover);
  // Wait for scrub pins before Bloom inits — keeps pin stacking in document order.
  await initScrubText({ reducedMotion: false });
  // Create manifesto ST before Bloom so the later refresh can remeasure after pin spacing.
  await initManifestoScrub();
  initNavReveal();
  initFooterReveal();
  bindScrollLinks();
}

const MAGNETIC_STRENGTH = 150;

function initMagneticButtons(enabled) {
  if (!enabled) return;

  document.querySelectorAll(".btn_wrap").forEach((magnet) => {
    magnet.addEventListener("mousemove", moveMagnet);
    magnet.addEventListener("mouseleave", (event) => {
      gsap.to(event.currentTarget, {
        x: 0,
        y: 0,
        duration: 1,
        ease: "power4.out",
      });
    });
  });
}

function moveMagnet(event) {
  const magnet = event.currentTarget;
  const bounding = magnet.getBoundingClientRect();
  gsap.to(magnet, {
    x: ((event.clientX - bounding.left) / magnet.offsetWidth - 0.5) * MAGNETIC_STRENGTH,
    y: ((event.clientY - bounding.top) / magnet.offsetHeight - 0.5) * MAGNETIC_STRENGTH,
    duration: 0.5,
    ease: "power4.out",
  });
}

function initManifestoScrub() {
  const text = document.querySelector(".manifesto_text");
  const wrap = document.querySelector(".manifesto_wrap");
  if (!text || !wrap) return Promise.resolve();

  // Scrub across the full sticky track (wrap is 300vh). scrub:1 eases catch-up
  // with Lenis so words don't freeze then jump. refreshPriority below Bloom.
  const scrollTrigger = {
    trigger: wrap,
    start: "top top",
    end: "bottom bottom",
    scrub: 1,
    invalidateOnRefresh: true,
    refreshPriority: -2,
  };

  return loadSplitText()
    .then((SplitText) => {
      const split = new SplitText(text, { type: "words" });
      // Parent was parked at 0.2; words own the scrub once SplitText lands.
      gsap.set(text, { opacity: 1 });
      gsap.set(split.words, { opacity: 0.2 });
      // fromTo survives ScrollTrigger.refresh() — plain from() can re-capture 0.2 as the end.
      gsap.fromTo(
        split.words,
        { opacity: 0.2 },
        {
          opacity: 1,
          stagger: { each: 0.04, ease: "none" },
          ease: "none",
          scrollTrigger,
        },
      );
    })
    .catch(() => {
      gsap.fromTo(
        text,
        { opacity: 0.35 },
        {
          opacity: 1,
          ease: "none",
          scrollTrigger,
        },
      );
    });
}

function initNavReveal() {
  const nav = document.querySelector(".nav_wrap");
  const scrubWrap = document.querySelector("[data-scrub-text]");
  if (!nav || !scrubWrap) return;

  const show = gsap.timeline({ paused: true });
  show.to(nav, { yPercent: 0, duration: 0.5, ease: "power2.out" });

  const hide = gsap.timeline({ paused: true });
  hide.to(nav, { yPercent: -100, duration: 0.4, ease: "power2.in" });

  ScrollTrigger.create({
    trigger: scrubWrap,
    start: () => `top+=${window.innerHeight} top`,
    onEnter: () => show.restart(),
    onLeaveBack: () => hide.restart(),
  });
}

function initFooterReveal() {
  const footer = document.querySelector("footer");
  if (!footer) return;

  const blocks = footer.querySelectorAll(".footer_top, .footer_bottom");
  // fromTo keeps the parked from-state across ScrollTrigger.refresh().
  gsap.fromTo(
    blocks,
    { opacity: 0, y: 32 },
    {
      opacity: 1,
      y: 0,
      duration: 1,
      stagger: 0.15,
      ease: "power3.out",
      scrollTrigger: { trigger: footer, start: "top 85%" },
    },
  );
}

function bindScrollLinks() {
  const links = document.querySelectorAll(".hero_link, [data-scroll-to]");

  links.forEach((link) => {
    link.addEventListener("click", (event) => {
      let target = link.getAttribute("data-scroll-to");

      if (!target && link.getAttribute("href")?.includes("#")) {
        target = link.getAttribute("href");
      }

      if (!target?.startsWith("#") || target.length < 2) return;
      if (!document.querySelector(target)) return;

      event.preventDefault();
      scrollTo(target);
    });
  });

  const brand = document.querySelector(".footer_wordmark");
  brand?.addEventListener("click", (event) => {
    event.preventDefault();
    scrollTo("#top", { offset: 0 });
  });
}
