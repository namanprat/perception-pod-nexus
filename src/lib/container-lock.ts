/**
 * Runtime control for `--max-width--main` — the site-wide container lock.
 * Persists in localStorage so the styling page can drive the whole site.
 *
 * Locked:   --max-width--main: Nrem  (default 90)
 * Unlocked: --max-width--main: 100vw (fluid forever; gutter stays at 2vw)
 */

export const CONTAINER_LOCK_KEY = "nexus:container-lock";
export const CONTAINER_WIDTH_KEY = "nexus:container-width";
export const DEFAULT_CONTAINER_WIDTH_REM = 90;
export const UNLOCKED_MAX_WIDTH = "100vw";

export type ContainerLockSettings = {
  locked: boolean;
  widthRem: number;
};

export function readContainerLockFromCss(): ContainerLockSettings {
  if (typeof document === "undefined") {
    return { locked: true, widthRem: DEFAULT_CONTAINER_WIDTH_REM };
  }
  const specified = getComputedStyle(document.documentElement)
    .getPropertyValue("--max-width--main")
    .trim();
  if (specified === "100vw" || specified === "100%") {
    return { locked: false, widthRem: DEFAULT_CONTAINER_WIDTH_REM };
  }
  const remMatch = specified.match(/^([\d.]+)rem$/);
  if (remMatch) {
    const widthRem = parseFloat(remMatch[1]);
    if (Number.isFinite(widthRem) && widthRem > 0) {
      return { locked: true, widthRem };
    }
  }
  return { locked: true, widthRem: DEFAULT_CONTAINER_WIDTH_REM };
}

export function readContainerLockSettings(): ContainerLockSettings {
  const fromCss = readContainerLockFromCss();
  try {
    const lockedRaw = localStorage.getItem(CONTAINER_LOCK_KEY);
    const widthRaw = localStorage.getItem(CONTAINER_WIDTH_KEY);
    if (lockedRaw === null && widthRaw === null) return fromCss;
    const locked = lockedRaw !== "0";
    const parsed = parseFloat(widthRaw ?? String(fromCss.widthRem));
    const widthRem =
      Number.isFinite(parsed) && parsed > 0 ? parsed : fromCss.widthRem;
    return { locked, widthRem };
  } catch {
    return fromCss;
  }
}

export function writeContainerLockSettings(settings: ContainerLockSettings): void {
  try {
    localStorage.setItem(CONTAINER_LOCK_KEY, settings.locked ? "1" : "0");
    localStorage.setItem(CONTAINER_WIDTH_KEY, String(settings.widthRem));
  } catch {
    /* private mode / blocked storage — still apply in-session */
  }
}

export function applyContainerLockSettings(settings: ContainerLockSettings): void {
  const value = settings.locked ? `${settings.widthRem}rem` : UNLOCKED_MAX_WIDTH;
  document.documentElement.style.setProperty("--max-width--main", value);
}

export function clearContainerLockStorage(): void {
  try {
    localStorage.removeItem(CONTAINER_LOCK_KEY);
    localStorage.removeItem(CONTAINER_WIDTH_KEY);
  } catch {
    /* ignore */
  }
}

export function clearContainerLockOverride(): void {
  document.documentElement.style.removeProperty("--max-width--main");
  clearContainerLockStorage();
}
