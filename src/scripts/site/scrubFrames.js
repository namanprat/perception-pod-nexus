import { buildFrameUrls, resolveScrubConfig } from "./scrubConfig.js";

const cache = {
  config: null,
  urls: [],
  images: [],
  loaded: new Set(),
  promise: null,
};

const progressListeners = new Set();

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 250;

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

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function emitProgress() {
  const total = cache.urls.length;
  const loaded = cache.loaded.size;
  for (const listener of progressListeners) {
    listener(loaded, total);
  }
}

function loadImageOnce(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";

    image.onload = () => {
      const finish = () => resolve(image);
      if (typeof image.decode === "function") {
        image.decode().then(finish).catch(finish);
      } else {
        finish();
      }
    };

    image.onerror = () => {
      reject(new Error(`Failed to load scrub frame: ${url}`));
    };

    image.src = url;
  });
}

async function loadImage(url) {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return await loadImageOnce(url);
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES) {
        await wait(RETRY_DELAY_MS * attempt);
      }
    }
  }

  console.error(lastError?.message ?? `Failed to load scrub frame: ${url}`);
  return null;
}

/**
 * Preload flower scrub PNGs into a shared cache.
 * Safe to call multiple times — reuses the in-flight / completed promise.
 *
 * Resolves only when every frame is loaded. Rejects if any remain missing
 * after per-frame retries and a final sweep.
 *
 * @param {{
 *   onProgress?: (loaded: number, total: number) => void,
 *   config?: ReturnType<typeof resolveScrubConfig>,
 * }} [options]
 */
export function preloadScrubFrames({ onProgress, config } = {}) {
  if (typeof onProgress === "function") {
    progressListeners.add(onProgress);
  }

  if (cache.promise) {
    if (cache.urls.length) emitProgress();
    return cache.promise;
  }

  const resolved = config ?? resolveScrubConfigFromDom();
  const urls = buildFrameUrls(resolved);
  const batchSize = Math.max(1, resolved.batchSize);
  const sameUrls =
    cache.urls.length === urls.length &&
    cache.urls.every((url, i) => url === urls[i]);

  cache.config = resolved;
  cache.urls = urls;

  if (!sameUrls) {
    cache.images = new Array(urls.length).fill(null);
    cache.loaded = new Set();
  } else if (cache.images.length !== urls.length) {
    cache.images = new Array(urls.length).fill(null);
    cache.loaded = new Set();
  }

  cache.promise = (async () => {
    emitProgress();

    const loadIndex = async (index) => {
      if (cache.images[index]) return;
      const image = await loadImage(urls[index]);
      if (image) {
        cache.images[index] = image;
        cache.loaded.add(index);
      }
      emitProgress();
    };

    // Load anything not already cached (supports resume after a failed run).
    const pending = [];
    for (let i = 0; i < urls.length; i += 1) {
      if (!cache.images[i]) pending.push(i);
    }

    for (let start = 0; start < pending.length; start += batchSize) {
      const slice = pending.slice(start, start + batchSize);
      await Promise.all(slice.map((index) => loadIndex(index)));
    }

    // Final sweep for anything still missing after the first pass.
    const missing = [];
    for (let i = 0; i < urls.length; i += 1) {
      if (!cache.images[i]) missing.push(i);
    }

    for (let start = 0; start < missing.length; start += batchSize) {
      const slice = missing.slice(start, start + batchSize);
      await Promise.all(slice.map((index) => loadIndex(index)));
    }

    const result = getScrubFrameCache();
    if (!result.ready) {
      const failed = urls.length - cache.loaded.size;
      // Allow a later caller (scrub boot) to try again.
      cache.promise = null;
      throw new Error(
        `Scrub preload incomplete: ${failed} of ${urls.length} frames failed`,
      );
    }

    return result;
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
