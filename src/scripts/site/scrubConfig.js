const DEFAULT_SCRUB_CONFIG = {
  assetBaseUrl: "/frames",
  extension: "webp",
  firstFrame: 0,
  frameCount: 201,
  eagerCount: 25,
  batchSize: 12,
};

function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeBaseUrl(baseUrl = "") {
  return String(baseUrl).trim().replace(/\/+$/, "");
}

export function resolveScrubConfig(overrides = {}) {
  const config = {
    ...DEFAULT_SCRUB_CONFIG,
    ...overrides,
  };

  return {
    assetBaseUrl: normalizeBaseUrl(config.assetBaseUrl) || DEFAULT_SCRUB_CONFIG.assetBaseUrl,
    extension: String(config.extension || DEFAULT_SCRUB_CONFIG.extension).replace(/^\./, ""),
    firstFrame: parseNumber(config.firstFrame, DEFAULT_SCRUB_CONFIG.firstFrame),
    frameCount: parseNumber(config.frameCount, DEFAULT_SCRUB_CONFIG.frameCount),
    eagerCount: parseNumber(config.eagerCount, DEFAULT_SCRUB_CONFIG.eagerCount),
    batchSize: parseNumber(config.batchSize, DEFAULT_SCRUB_CONFIG.batchSize),
  };
}

export function buildFrameUrl(frameIndex, config) {
  const frameName = `${frameIndex}.${config.extension}`;
  return config.assetBaseUrl ? `${config.assetBaseUrl}/${frameName}` : `/${frameName}`;
}

export function buildFrameUrls(config) {
  return Array.from({ length: config.frameCount }, (_, offset) =>
    buildFrameUrl(config.firstFrame + offset, config)
  );
}

export { DEFAULT_SCRUB_CONFIG };
