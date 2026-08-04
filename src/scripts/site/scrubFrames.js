import { buildFrameUrls, resolveScrubConfig } from "./scrubConfig.js";

const cache = {
  config: null,
  urls: [],
  images: [],
  loaded: new Set(),
  promise: null,
};

function parseDatasetConfig(scrubContain, scrubWrap) {
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

export function resolveScrubConfigFromDom(
  scrubWrap = document.querySelector("[data-scrub-text]"),
  scrubContain =
    scrubWrap?.querySelector(".scrub_contain") ?? document.querySelector(".scrub_contain")
) {
  return parseDatasetConfig(scrubContain, scrubWrap);
}

function loadImage(url) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => {
      console.error(`Failed to load scrub frame: ${url}`);
      resolve(null);
    };
    image.src = url;
  });
}

/**
 * Preload flower scrub PNGs into a shared cache.
 * Safe to call multiple times — reuses the in-flight / completed promise.
 *
 * @param {{
 *   onProgress?: (loaded: number, total: number) => void,
 *   config?: ReturnType<typeof resolveScrubConfig>,
 * }} [options]
 */
export function preloadScrubFrames({ onProgress, config } = {}) {
  if (cache.promise) {
    if (onProgress && cache.urls.length) {
      onProgress(cache.loaded.size, cache.urls.length);
    }
    return cache.promise;
  }

  const resolved = config ?? resolveScrubConfigFromDom();
  const urls = buildFrameUrls(resolved);
  const batchSize = Math.max(1, resolved.batchSize);

  cache.config = resolved;
  cache.urls = urls;
  cache.images = new Array(urls.length).fill(null);
  cache.loaded = new Set();

  cache.promise = (async () => {
    const total = urls.length;
    onProgress?.(0, total);

    for (let start = 0; start < urls.length; start += batchSize) {
      const batch = urls.slice(start, start + batchSize).map((url, offset) => {
        const index = start + offset;
        return loadImage(url).then((image) => {
          if (image) {
            cache.images[index] = image;
            cache.loaded.add(index);
          }
          onProgress?.(cache.loaded.size, total);
        });
      });
      await Promise.all(batch);
    }

    return getScrubFrameCache();
  })();

  return cache.promise;
}

export function getScrubFrameCache() {
  return {
    config: cache.config,
    urls: cache.urls,
    images: cache.images,
    loaded: cache.loaded,
    totalImages: cache.urls.length,
    ready: cache.loaded.size > 0 && cache.loaded.size === cache.urls.length,
  };
}

export function hasScrubFrameCache() {
  return Boolean(cache.promise);
}
