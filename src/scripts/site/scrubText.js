import {
  gsap,
  ScrollTrigger,
  loadSplitText,
  prefersReducedMotion,
} from "./gsapRuntime.js";
import { initScrubSequence } from "./scrubSequence.js";

// Scroll budget per phase, in viewport heights. Mobile runs about half the
// desktop distance: at 250vh a beat, advancing one line of text costs 2.5
// screens of thumb-scrolling, and the section ran 11.5 screens on a phone.
const PACE = {
  desktop: { beat: 250, lead: 150, end: 150 },
  mobile: { beat: 125, lead: 80, end: 80 },
};

const MOBILE_QUERY = "(width <= 35em)";

/** Read live, not frozen at import — a rotate or resize picks up the other pace. */
function pace() {
  return window.matchMedia(MOBILE_QUERY).matches ? PACE.mobile : PACE.desktop;
}

function parseSlides(wrap) {
  const jsonEl = wrap.querySelector("[data-scrub-slides]");
  if (jsonEl) {
    try {
      const slides = JSON.parse(jsonEl.textContent || "[]");
      if (Array.isArray(slides) && slides.length) return slides;
    } catch {
      /* fall through */
    }
  }

  try {
    const raw = wrap.getAttribute("data-slides");
    const slides = raw ? JSON.parse(raw) : [];
    return Array.isArray(slides) ? slides : [];
  } catch {
    return [];
  }
}

export function totalTrackVh(slideCount) {
  const p = pace();
  return p.lead + slideCount * p.beat + p.end;
}

export function trackScrollPx(slideCount) {
  return (totalTrackVh(slideCount) / 100) * window.innerHeight;
}

/** -1 in lead-in; then 0..n-1 every beat after the lead. */
function indexFromScrolledVh(scrolledVh, slideCount) {
  const p = pace();
  const afterLead = scrolledVh - p.lead;
  if (afterLead < 0) return -1;
  if (slideCount <= 1) return 0;
  return Math.min(slideCount - 1, Math.floor(afterLead / p.beat));
}

function initTextBeats(wrap, sticky, slides, headerEl, bodyEl, { reducedMotion } = {}) {
  const state = {
    headerEl,
    bodyEl,
    headerSplit: null,
    bodySplit: null,
    lines: [],
    index: -1,
    revealTween: null,
    SplitText: null,
  };

  const clearSplits = () => {
    if (state.revealTween) {
      state.revealTween.kill();
      state.revealTween = null;
    }
    if (state.headerSplit) {
      state.headerSplit.revert();
      state.headerSplit = null;
    }
    if (state.bodySplit) {
      state.bodySplit.revert();
      state.bodySplit = null;
    }
    state.lines = [];
  };

  const paintPlain = (index) => {
    const slide = slides[index];
    if (!slide) return;
    clearSplits();
    headerEl.textContent = slide.header;
    bodyEl.textContent = slide.body;
    gsap.set([headerEl, bodyEl], { autoAlpha: 1, clearProps: "transform" });
    state.index = index;
  };

  const wrapLines = (rawLines) =>
    rawLines.map((line) => {
      const mask = document.createElement("div");
      mask.className = "scrub-text-line-mask";
      line.parentNode.insertBefore(mask, line);
      mask.appendChild(line);
      return line;
    });

  const playLineReveal = (fromY = 100) => {
    // Parents may be parked at autoAlpha: 0 during preloader — lines can't show through that.
    gsap.set([headerEl, bodyEl], { autoAlpha: 1 });

    if (!state.lines.length) return;

    gsap.set(state.lines, { autoAlpha: 0, y: fromY });
    state.revealTween = gsap.to(state.lines, {
      autoAlpha: 1,
      y: 0,
      duration: 0.85,
      stagger: 0.08,
      ease: "power3.out",
      onComplete: () => {
        state.revealTween = null;
      },
    });
  };

  const mountSlide = (index, { animate, hidden } = {}) => {
    const slide = slides[index];
    if (!slide) return;

    // First cluster starts above; later clusters rise from below
    const fromY = index === 0 ? -100 : 100;

    if (!state.SplitText) {
      paintPlain(index);
      if (hidden) gsap.set([headerEl, bodyEl], { autoAlpha: 0 });
      return;
    }

    clearSplits();
    headerEl.textContent = slide.header;
    bodyEl.textContent = slide.body;

    state.headerSplit = new state.SplitText(headerEl, {
      type: "lines",
      linesClass: "scrub-text-line",
    });
    state.bodySplit = new state.SplitText(bodyEl, {
      type: "lines",
      linesClass: "scrub-text-line",
    });

    state.lines = wrapLines([
      ...(state.headerSplit?.lines ?? []),
      ...(state.bodySplit?.lines ?? []),
    ]);

    if (hidden) {
      gsap.set([headerEl, bodyEl], { autoAlpha: 1 });
      gsap.set(state.lines, { autoAlpha: 0, y: fromY });
      state.index = -1;
      return;
    }

    state.index = index;

    if (animate) {
      playLineReveal(fromY);
    } else {
      gsap.set([headerEl, bodyEl], { autoAlpha: 1 });
      gsap.set(state.lines, { autoAlpha: 1, y: 0 });
    }
  };

  const goTo = (index, { animate = true } = {}) => {
    if (index === state.index || !slides[index]) return;
    mountSlide(index, { animate });
  };

  const enterLead = () => {
    if (state.index === -1 && state.lines.length) {
      gsap.set(state.lines, { autoAlpha: 0, y: -100 });
      return;
    }
    mountSlide(0, { hidden: true });
  };

  const onTrackProgress = (progress) => {
    const scrolledVh = progress * totalTrackVh(slides.length);
    const index = indexFromScrolledVh(scrolledVh, slides.length);

    if (index < 0) {
      if (state.index !== -1) enterLead();
      return;
    }

    goTo(index, { animate: true });
  };

  if (reducedMotion) {
    paintPlain(0);
    return Promise.resolve();
  }

  return loadSplitText()
    .then((SplitText) => {
      state.SplitText = SplitText;
      enterLead();

      ScrollTrigger.create({
        trigger: wrap,
        start: "top top",
        end: () => `+=${trackScrollPx(slides.length)}`,
        pin: sticky,
        anticipatePin: 1,
        refreshPriority: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => onTrackProgress(self.progress),
        onLeaveBack: () => enterLead(),
      });

      ScrollTrigger.refresh();
    })
    .catch(() => {
      gsap.set([headerEl, bodyEl], { autoAlpha: 0 });

      ScrollTrigger.create({
        trigger: wrap,
        start: "top top",
        end: () => `+=${trackScrollPx(slides.length)}`,
        pin: sticky,
        anticipatePin: 1,
        refreshPriority: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          const scrolledVh = self.progress * totalTrackVh(slides.length);
          const index = indexFromScrolledVh(scrolledVh, slides.length);
          if (index < 0) {
            gsap.set([headerEl, bodyEl], { autoAlpha: 0 });
            state.index = -1;
            return;
          }
          goTo(index, { animate: false });
          gsap.set([headerEl, bodyEl], { autoAlpha: 1 });
        },
      });

      ScrollTrigger.refresh();
    });
}

export function initScrubText({ reducedMotion } = {}) {
  const wrap = document.querySelector("[data-scrub-text]");
  if (!wrap) return Promise.resolve();

  const sticky = wrap.querySelector(".scrub_text_sticky");
  const headerEl = wrap.querySelector(".scrub_text_header");
  const bodyEl = wrap.querySelector(".scrub_text_body");
  const slides = parseSlides(wrap);
  const reduced = reducedMotion ?? prefersReducedMotion();
  const slideCount = Math.max(slides.length, 1);

  if (!sticky) return Promise.resolve();

  initScrubSequence({
    wrap,
    trackScrollPx: () => trackScrollPx(slideCount),
    reducedMotion: reduced,
  });

  if (!headerEl || !bodyEl || slides.length === 0) return Promise.resolve();

  return initTextBeats(wrap, sticky, slides, headerEl, bodyEl, {
    reducedMotion: reduced,
  });
}
