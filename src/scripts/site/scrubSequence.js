import { gsap, ScrollTrigger } from "./gsapRuntime.js";
import {
  getScrubFrameCache,
  preloadScrubFrames,
  resolveScrubConfigFromDom,
} from "./scrubFrames.js";

function getNearestLoadedImage(images, targetIndex) {
  if (images[targetIndex]) {
    return images[targetIndex];
  }

  for (let offset = 1; offset < images.length; offset += 1) {
    const previousImage = images[targetIndex - offset];
    if (previousImage) {
      return previousImage;
    }

    const nextImage = images[targetIndex + offset];
    if (nextImage) {
      return nextImage;
    }
  }

  return null;
}

/**
 * Canvas PNG frame scrub bound to the same scroll track as text beats.
 * Prefers images preloaded by the preloader via {@link preloadScrubFrames}.
 *
 * @param {{ wrap: Element, trackScrollPx: () => number, reducedMotion?: boolean }} options
 */
export function initScrubSequence({ wrap, trackScrollPx, reducedMotion = false } = {}) {
  const scrubWrap = wrap ?? document.querySelector("[data-scrub-text]");
  const scrubContain =
    scrubWrap?.querySelector(".scrub_contain") ?? document.querySelector(".scrub_contain");

  if (!scrubContain || !scrubWrap) {
    return () => {};
  }

  const config = resolveScrubConfigFromDom(scrubWrap, scrubContain);
  const imageSequence = {
    frame: 0,
    images: new Array(config.frameCount).fill(null),
    loaded: new Set(),
    totalImages: config.frameCount,
  };
  const cleanupCallbacks = [];
  let scrollTween = null;

  const syncFromCache = () => {
    const cached = getScrubFrameCache();
    if (!cached.images.length) return;

    for (let i = 0; i < cached.images.length; i += 1) {
      const image = cached.images[i];
      if (!image) continue;
      imageSequence.images[i] = image;
      imageSequence.loaded.add(i);
    }
    imageSequence.totalImages = cached.totalImages || imageSequence.totalImages;
  };

  const mountNode = document.getElementById("pp-scrub") ?? scrubContain;
  let canvas = mountNode.querySelector("canvas");

  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    mountNode.appendChild(canvas);
  }

  let context = null;

  try {
    context = canvas.getContext("2d", { alpha: true, desynchronized: true });
  } catch (error) {
    console.error("Canvas context error:", error);
    return () => {};
  }

  const resizeCanvas = () => {
    // Size from the host — canvas rect can be stale before layout settles.
    const rect = scrubContain.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const drawFrame = () => {
    const targetFrame = Math.max(
      0,
      Math.min(Math.floor(imageSequence.frame), imageSequence.totalImages - 1)
    );
    const image = getNearestLoadedImage(imageSequence.images, targetFrame);

    if (!image) {
      return;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const canvasWidth = canvas.width / dpr;
    const canvasHeight = canvas.height / dpr;

    context.clearRect(0, 0, canvasWidth, canvasHeight);

    // Mobile (≤50em): cover so the frame spans full sticky height.
    // Desktop: contain so the full 16:9 plate stays visible.
    const cover = window.matchMedia("(width <= 50em)").matches;
    const scale = (cover ? Math.max : Math.min)(
      canvasWidth / image.naturalWidth,
      canvasHeight / image.naturalHeight
    );
    const scaledWidth = image.naturalWidth * scale;
    const scaledHeight = image.naturalHeight * scale;
    const x = (canvasWidth - scaledWidth) / 2;
    const y = (canvasHeight - scaledHeight) / 2;

    context.drawImage(image, x, y, scaledWidth, scaledHeight);

    const fadeHeight = canvasHeight * 0.1;
    const fadeStartY = canvasHeight - fadeHeight;

    if (fadeHeight <= 0 || fadeStartY <= 0) {
      return;
    }

    const fadeGradient = context.createLinearGradient(0, fadeStartY, 0, canvasHeight);
    fadeGradient.addColorStop(0, "rgba(0, 0, 0, 0)");
    fadeGradient.addColorStop(1, "rgba(0, 0, 0, 1)");

    context.globalCompositeOperation = "destination-out";
    context.fillStyle = fadeGradient;
    context.fillRect(0, fadeStartY, canvasWidth, fadeHeight);
    context.globalCompositeOperation = "source-over";
  };

  const initScrollTrigger = () => {
    drawFrame();

    if (scrollTween) {
      scrollTween.kill();
    }

    scrollTween = gsap.to(imageSequence, {
      frame: imageSequence.totalImages - 1,
      snap: "frame",
      ease: "none",
      scrollTrigger: {
        trigger: scrubWrap,
        start: "top top",
        end: () => `+=${trackScrollPx()}`,
        scrub: 0.5,
        onUpdate: () => drawFrame(),
      },
    });

    window.requestAnimationFrame(() => {
      ScrollTrigger.refresh();
    });
  };

  const handleResize = () => {
    resizeCanvas();
    drawFrame();
  };

  window.addEventListener("resize", handleResize);
  cleanupCallbacks.push(() => window.removeEventListener("resize", handleResize));
  cleanupCallbacks.push(() => {
    scrollTween?.kill();
  });

  resizeCanvas();

  const staticFrame = Math.floor(imageSequence.totalImages / 2);

  const boot = async () => {
    // Reuse preloader cache when present; otherwise load now.
    await preloadScrubFrames({ config });
    syncFromCache();

    if (reducedMotion) {
      imageSequence.frame = staticFrame;
      drawFrame();
      return;
    }

    initScrollTrigger();
  };

  void boot();

  return () => {
    cleanupCallbacks.splice(0).forEach((cleanup) => cleanup());
  };
}
