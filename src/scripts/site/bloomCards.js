// Bloom Room — pin stage (same pattern as scrubText) + scrubbed stack timeline.
// Header fades out, then cards arrive one per beat, each landing on the pile a
// few pixels below the last. Landed cards never move again.

import { gsap, ScrollTrigger, prefersReducedMotion } from "./gsapRuntime.js";

export const OFFSET_PERCENT = 2; // ≈11px on a 560px card — a deck-edge sliver, not a gap
/** Light x jitter + rotation only — vertical settle is yPercent from center. */
const STACK = [
  { x: -16, rotation: -7 },
  { x: 14, rotation: 5.2 },
  { x: -10, rotation: -3.4 },
  { x: 16, rotation: 6.1 },
  { x: -4, rotation: -1.8 },
];

// Beats map 1:1 to viewport heights of scroll — larger = slower card arrivals.
const HEAD_BEAT = 1; // header fade-out
const BEAT = 1; // scroll between one card arrival and the next
const RISE = 1.5; // a card's own travel — longer than BEAT, so arrivals overlap
const TAIL = 0.6; // hold the finished pile before unpin
const PAD_ABOVE_SVH = 25; // matches .bloom_wrap padding-top: 25svh

/** Parked just below the fold — no dead travel before the card is visible. */
const ENTER_YPERCENT = 100;

/** Scrub lag (seconds). Low enough to stay locked to the wheel, high enough to smooth it. */
const SCRUB = 0.9;

let timeline = null;
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

  cards.forEach((card, index) => {
    const pose = STACK[index] ?? STACK[STACK.length - 1];
    gsap.set(card, {
      xPercent: -50,
      yPercent: ENTER_YPERCENT,
      x: pose.x,
      y: 0,
      rotation: pose.rotation,
      force3D: true,
    });
  });

  // Last card starts at HEAD_BEAT + (n-1)*BEAT and still needs RISE to land.
  const totalBeats = HEAD_BEAT + (cards.length - 1) * BEAT + RISE + TAIL;

  timeline = gsap.timeline({
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
    timeline.to(head, { autoAlpha: 0, duration: HEAD_BEAT, ease: "none" }, 0);
  }

  // 2. Each card rises onto the pile. RISE > BEAT so the next card is already on
  //    its way before this one lands — the stack never fully stops mid-section.
  cards.forEach((card, index) => {
    const pose = STACK[index] ?? STACK[STACK.length - 1];

    timeline.to(
      card,
      {
        yPercent: slotYPercent(index),
        xPercent: -50,
        x: pose.x,
        rotation: pose.rotation,
        duration: RISE,
      },
      HEAD_BEAT + index * BEAT,
    );
  });

  // 3. Hold the finished pile before unpinning.
  timeline.to({}, { duration: TAIL });
}

export function destroyBloomCards() {
  if (timeline) {
    timeline.scrollTrigger?.kill();
    timeline.kill();
    timeline = null;
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
