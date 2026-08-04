import { gsap, loadSplitText } from "./gsapRuntime.js";

let headerSplit = null;

export async function setupHeroInitialState() {
  gsap.set(".hero_wordmark", { yPercent: -100, opacity: 0 });
  gsap.set(".hero_nav_item", { yPercent: -100, opacity: 0 });

  const tagline = document.querySelector("#header-split");
  if (!tagline) return;

  try {
    const SplitText = await loadSplitText();
    headerSplit = new SplitText(tagline, {
      type: "lines, words",
      linesClass: "split_line",
    });
    // Parent CSS park hands off to per-word yPercent once SplitText lands.
    gsap.set(tagline, { opacity: 1, clearProps: "transform" });
    gsap.set(headerSplit.words, { yPercent: -100 });
  } catch {
    gsap.set(tagline, { opacity: 0, yPercent: -100 });
  }
}

export function playHeroReveal() {
  const tl = gsap.timeline();

  // Keep final transform inline so stylesheet opacity park can't snap y back.
  tl.to(".hero_wordmark", {
    yPercent: 0,
    opacity: 1,
    duration: 1.2,
    ease: "power3.out",
  });

  tl.to(
    ".hero_nav_item",
    {
      yPercent: 0,
      opacity: 1,
      duration: 0.8,
      ease: "power3.out",
      stagger: 0.1,
    },
    "-=0.8",
  );

  if (headerSplit?.lines?.length) {
    headerSplit.lines.forEach((line, index) => {
      const words = headerSplit.words.filter((word) => line.contains(word));
      tl.to(
        words,
        {
          yPercent: 0,
          duration: 0.8,
          ease: "power3.out",
          stagger: 0.05,
        },
        index * 0.1,
      );
    });
  } else {
    const tagline = document.querySelector("#header-split");
    if (tagline) {
      tl.to(
        tagline,
        { opacity: 1, yPercent: 0, duration: 0.8, ease: "power3.out" },
        "-=0.5",
      );
    }
  }

  return tl;
}

export function skipHeroToFinalState() {
  gsap.set(".hero_wordmark", { yPercent: 0, opacity: 1 });
  gsap.set(".hero_nav_item", { yPercent: 0, opacity: 1 });
  const tagline = document.querySelector("#header-split");
  if (tagline) gsap.set(tagline, { opacity: 1, yPercent: 0 });
  if (headerSplit?.words) gsap.set(headerSplit.words, { yPercent: 0 });
  headerSplit?.revert?.();
  headerSplit = null;
}
