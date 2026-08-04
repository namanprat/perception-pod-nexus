import { gsap, ScrollTrigger } from "./gsapRuntime.js";
import { buildFrameUrls, resolveScrubConfig } from "./scrubConfig.js";

function resolveScrubConfigSource(scrubWrap, scrubContain) {
  const dataset = scrubContain?.dataset ?? scrubWrap?.dataset ?? {};

  return resolveScrubConfig({
    assetBaseUrl: dataset.assetBaseUrl,
    extension: dataset.assetExtension,
    firstFrame: dataset.firstFrame,
    frameCount: dataset.frameCount,
    eagerCount: dataset.eagerCount,
    batchSize: dataset.batchSize,
  });
}

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
 * @param {{ wrap: Element, trackScrollPx: () => number, reducedMotion?: boolean }} options
 */
export function initScrubSequence({ wrap, trackScrollPx, reducedMotion = false } = {}) {
  const scrubWrap = wrap ?? document.querySelector("[data-scrub-text]");
  const scrubContain =
    scrubWrap?.querySelector(".scrub_contain") ?? document.querySelector(".scrub_contain");

  if (!scrubContain || !scrubWrap) {
    return () => {};
  }

  const config = resolveScrubConfigSource(scrubWrap, scrubContain);
  const imageUrls = buildFrameUrls(config);
  const imageSequence = {
    frame: 0,
    images: new Array(imageUrls.length).fill(null),
    loaded: new Set(),
    totalImages: imageUrls.length,
  };
  const cleanupCallbacks = [];
  const frameLoadPromises = new Map();
  let scrollTween = null;

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

    // object-fit: contain — full frame visible, letterboxed (no crop zoom).
    const scale = Math.min(
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

  const loadFrame = (index) => {
    if (imageSequence.loaded.has(index)) {
      return Promise.resolve(imageSequence.images[index]);
    }

    if (frameLoadPromises.has(index)) {
      return frameLoadPromises.get(index);
    }

    const promise = new Promise((resolve) => {
      const image = new Image();

      image.onload = () => {
        imageSequence.images[index] = image;
        imageSequence.loaded.add(index);
        frameLoadPromises.delete(index);
        resolve(image);
      };

      image.onerror = () => {
        console.error(`Failed to load image: ${imageUrls[index]}`);
        frameLoadPromises.delete(index);
        resolve(null);
      };

      image.src = imageUrls[index];
    });

    frameLoadPromises.set(index, promise);
    return promise;
  };

  const loadFrameRange = async (indexes) => {
    const batchSize = Math.max(1, config.batchSize);

    for (let start = 0; start < indexes.length; start += batchSize) {
      const batch = indexes.slice(start, start + batchSize);
      await Promise.all(batch.map((index) => loadFrame(index)));
    }
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

  const allIndexes = Array.from({ length: imageSequence.totalImages }, (_, index) => index);
  const eagerCount = Math.min(config.eagerCount, imageSequence.totalImages);
  const eagerIndexes = allIndexes.slice(0, eagerCount);
  const restIndexes = allIndexes.slice(eagerCount);

  const staticFrame = Math.floor(imageSequence.totalImages / 2);

  loadFrameRange(eagerIndexes).then(() => {
    if (reducedMotion) {
      imageSequence.frame = staticFrame;
      drawFrame();
      // Still warm the rest in the background for a sharp static paint if mid wasn't eager.
      void loadFrame(staticFrame).then(() => {
        imageSequence.frame = staticFrame;
        drawFrame();
      });
      return;
    }

    initScrollTrigger();
    void loadFrameRange(restIndexes).then(() => drawFrame());
  });

  return () => {
    cleanupCallbacks.splice(0).forEach((cleanup) => cleanup());
  };
}
