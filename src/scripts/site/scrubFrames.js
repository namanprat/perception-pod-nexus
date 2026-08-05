import { buildFrameUrls, resolveScrubConfig } from "./scrubConfig.js";

const cache = {
  config: null,
  urls: [],
  images: [],
  loaded: new Set(),
  eagerPromise: null,
  fullPromise: null,
  /** @type {null | { resolve: (v: unknown) => void, reject: (e: Error) => void }} */
  eagerGate: null,
};

/** @type {Set<{ fn: (loaded: number, total: number) => void, eagerOnly: boolean }>} */
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

function eagerTarget() {
  if (!cache.config) return 0;
  return Math.min(Math.max(0, cache.config.eagerCount), cache.urls.length);
}

function eagerLoadedCount() {
  const target = eagerTarget();
  let count = 0;
  for (let i = 0; i < target; i += 1) {
    if (cache.loaded.has(i)) count += 1;
  }
  return count;
}

function emitProgress() {
  const eagerTotal = eagerTarget();
  const eagerLoaded = eagerLoadedCount();
  const fullLoaded = cache.loaded.size;
  const fullTotal = cache.urls.length;

  for (const listener of progressListeners) {
    if (listener.eagerOnly) {
      listener.fn(eagerLoaded, eagerTotal);
    } else {
      listener.fn(fullLoaded, fullTotal);
    }
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

function initCache(config) {
  const resolved = config ?? resolveScrubConfigFromDom();
  const urls = buildFrameUrls(resolved);
  const sameUrls =
    cache.urls.length === urls.length &&
    cache.urls.every((url, i) => url === urls[i]);

  cache.config = resolved;
  cache.urls = urls;

  if (!sameUrls || cache.images.length !== urls.length) {
    cache.images = new Array(urls.length).fill(null);
    cache.loaded = new Set();
    cache.eagerPromise = null;
    cache.fullPromise = null;
    cache.eagerGate = null;
  }

  return resolved;
}

async function loadIndices(indices, batchSize) {
  const pending = indices.filter((index) => !cache.images[index]);

  for (let start = 0; start < pending.length; start += batchSize) {
    const slice = pending.slice(start, start + batchSize);
    await Promise.all(
      slice.map(async (index) => {
        if (cache.images[index]) return;
        const image = await loadImage(cache.urls[index]);
        if (image) {
          cache.images[index] = image;
          cache.loaded.add(index);
        }
        emitProgress();
      }),
    );
  }
}

function settleEager(error) {
  if (!cache.eagerGate) return;
  const gate = cache.eagerGate;
  cache.eagerGate = null;
  if (error) gate.reject(error);
  else gate.resolve(getScrubFrameCache());
}

function startFullLoad() {
  if (cache.fullPromise) return cache.fullPromise;

  const batchSize = Math.max(1, cache.config.batchSize);
  const eagerEnd = eagerTarget();

  if (!cache.eagerGate && !cache.eagerPromise) {
    cache.eagerPromise = new Promise((resolve, reject) => {
      cache.eagerGate = { resolve, reject };
    });
  }

  cache.fullPromise = (async () => {
    emitProgress();

    const eagerIndices = Array.from({ length: eagerEnd }, (_, i) => i);
    await loadIndices(eagerIndices, batchSize);

    const eagerMissing = eagerIndices.filter((i) => !cache.images[i]);
    if (eagerMissing.length) {
      await loadIndices(eagerMissing, batchSize);
    }

    if (eagerLoadedCount() < eagerEnd) {
      const err = new Error(
        `Scrub eager preload incomplete: ${eagerLoadedCount()} of ${eagerEnd} frames`,
      );
      settleEager(err);
      cache.fullPromise = null;
      throw err;
    }

    settleEager(null);

    const rest = [];
    for (let i = eagerEnd; i < cache.urls.length; i += 1) {
      if (!cache.images[i]) rest.push(i);
    }
    await loadIndices(rest, batchSize);

    const stillMissing = [];
    for (let i = 0; i < cache.urls.length; i += 1) {
      if (!cache.images[i]) stillMissing.push(i);
    }
    if (stillMissing.length) {
      await loadIndices(stillMissing, batchSize);
    }

    const result = getScrubFrameCache();
    if (!result.ready) {
      const failed = cache.urls.length - cache.loaded.size;
      cache.fullPromise = null;
      throw new Error(
        `Scrub preload incomplete: ${failed} of ${cache.urls.length} frames failed`,
      );
    }

    return result;
  })();

  return cache.fullPromise;
}

/**
 * Preload scrub frames into a shared cache.
 *
 * @param {{
 *   onProgress?: (loaded: number, total: number) => void,
 *   config?: ReturnType<typeof resolveScrubConfig>,
 *   eagerOnly?: boolean,
 * }} [options]
 *
 * - `eagerOnly: true` — wait for the first `eagerCount` frames; rest continues in background
 * - default — wait until every frame is loaded
 */
export function preloadScrubFrames({ onProgress, config, eagerOnly = false } = {}) {
  initCache(config);

  if (typeof onProgress === "function") {
    progressListeners.add({ fn: onProgress, eagerOnly });
  }

  const full = startFullLoad();

  if (eagerOnly) {
    if (!cache.eagerPromise) {
      // Eager already settled before a listener attached.
      cache.eagerPromise = Promise.resolve(getScrubFrameCache());
    }
    return cache.eagerPromise;
  }

  return full;
}

export function getScrubFrameCache() {
  const eagerTotal = eagerTarget();
  return {
    config: cache.config,
    urls: cache.urls,
    images: cache.images,
    loaded: cache.loaded,
    totalImages: cache.urls.length,
    eagerCount: eagerTotal,
    eagerReady: eagerTotal > 0 && eagerLoadedCount() === eagerTotal,
    ready: cache.urls.length > 0 && cache.loaded.size === cache.urls.length,
  };
}

export function hasScrubFrameCache() {
  return Boolean(cache.eagerPromise || cache.fullPromise);
}
