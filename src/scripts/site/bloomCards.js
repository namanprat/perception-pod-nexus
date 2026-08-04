// Bloom Room — pin stage (same pattern as scrubText) + scrubbed stack timeline.
// Header fades out, then cards arrive one per beat, each landing on the pile a
// few pixels below the last. Landed cards never move again.

import { gsap, ScrollTrigger, prefersReducedMotion } from "./gsapRuntime.js";

export const OFFSET_PERCENT = 2; // ≈11px on a ~538px card — a deck-edge sliver, not a gap
/** Light x jitter + rotation only — vertical settle is yPercent from center. */
const STACK = [
  { x: -16, rotation: -7 },
  { x: 14, rotation: 5.2 },
  { x: -10, rotation: -3.4 },
  { x: 16, rotation: 6.1 },
  { x: -4, rotation: -1.8 },
];

// Beats map 1:1 to viewport heights of scroll — larger = slower card arrivals.
// RISE > beat so the next card is already moving before this one lands.
// Mobile runs the whole sequence shorter: same choreography, ~30% less scroll.
const PACE = {
  desktop: { head: 1, beat: 1, rise: 1.5, tail: 0.6 }, // 7.1vh total for 5 cards
  mobile: { head: 0.7, beat: 0.7, rise: 1, tail: 0.4 }, // 4.9vh total for 5 cards
};

// Both branches are declared, and together they cover every width on purpose:
// gsap.matchMedia only runs the callback while at least one condition matches,
// so a lone mobile query would leave desktop with no timeline and no pin.
const QUERIES = {
  isMobile: "(width <= 35em)",
  isWide: "(width > 35em)",
};

const PAD_ABOVE_SVH = 25; // matches .bloom_wrap padding-top: 25svh

/** Scrub lag (seconds). Low enough to stay locked to the wheel, high enough to smooth it. */
const SCRUB = 0.9;

let mm = null;
let cardsRef = [];
let headRef = null;

/** Resting yPercent for a card. -50 == dead center; each card sits a sliver lower. */
export function slotYPercent(index) {
  return -50 + index * OFFSET_PERCENT;
}

export function initBloomCards() {
  destroyBloomCards();

  const wrap = document.querySelector(".bloom_wrap");
  const stage = document.querySelector(".bloom_stage");
  const head = document.querySelector(".bloom_head");
  const cards = Array.from(document.querySelectorAll(".bloom_card"));

  if (!wrap || !stage || cards.length === 0) return;

  if (prefersReducedMotion()) {
    return;
  }

  cardsRef = cards;
  headRef = head;

  // matchMedia rebuilds the timeline when the breakpoint flips and reverts
  // everything it created — including the gsap.set poses — on the way out.
  mm = gsap.matchMedia();

  mm.add(QUERIES, (ctx) => {
    const pace = ctx.conditions.isMobile ? PACE.mobile : PACE.desktop;

    // Rest pose. Everything here is size-independent; the offscreen park is a
    // viewport-height translate on y, set per-card in the fromTo below.
    cards.forEach((card, index) => {
      const pose = STACK[index] ?? STACK[STACK.length - 1];
      gsap.set(card, {
        xPercent: -50,
        yPercent: slotYPercent(index),
        x: pose.x,
        rotation: pose.rotation,
        force3D: true,
      });
    });

    // Last card starts at head + (n-1)*beat and still needs rise to land.
    const totalBeats =
      pace.head + (cards.length - 1) * pace.beat + pace.rise + pace.tail;

    const timeline = gsap.timeline({
      defaults: { ease: "power1.out" },
      scrollTrigger: {
        trigger: wrap,
        pin: stage,
        // After 25svh padding so stage sits at viewport top when pin engages.
        start: () => `top+=${window.innerHeight * (PAD_ABOVE_SVH / 100)} top`,
        end: () => `+=${window.innerHeight * totalBeats}`,
        scrub: SCRUB,
        pinSpacing: true,
        anticipatePin: 0,
        // After scrub pins (1), before manifesto scrub (-2), so lower sections remeasure with spacing.
        refreshPriority: 0,
        invalidateOnRefresh: true,
        // No snap: on a scrubbed stack it fights the wheel and reads as a yank.
      },
    });

    // 1. Header holds its position and fades out. Linear, so opacity tracks scroll
    //    evenly and hits 0 exactly as the first card starts to rise.
    if (head) {
      timeline.to(head, { autoAlpha: 0, duration: pace.head, ease: "none" }, 0);
    }

    // 2. Each card rises from one full viewport below its slot. Parking by
    //    viewport (not by card height) keeps it offscreen on any screen — a
    //    card-height park leaves short mobile cards visible at rest.
    //    invalidateOnRefresh re-reads innerHeight on resize/rotate.
    cards.forEach((card, index) => {
      timeline.fromTo(
        card,
        { y: () => window.innerHeight },
        { y: 0, duration: pace.rise },
        pace.head + index * pace.beat,
      );
    });

    // 3. Hold the finished pile before unpinning.
    timeline.to({}, { duration: pace.tail });
  });
}

export function destroyBloomCards() {
  if (mm) {
    mm.kill(); // reverts the timeline, its ScrollTrigger, and the gsap.set poses
    mm = null;
  }

  if (cardsRef.length) {
    gsap.set(cardsRef, { clearProps: "transform" });
    cardsRef = [];
  }

  if (headRef) {
    gsap.set(headRef, { clearProps: "opacity,visibility,transform" });
    headRef = null;
  }
}
