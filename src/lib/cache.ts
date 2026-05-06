// Lightweight localStorage cache so the app can show previously loaded
// content when offline instead of blank screens or spinners.
const PREFIX = "hv_cache_";

export const cacheData = (key: string, data: unknown) => {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ data, timestamp: Date.now() }));
  } catch {
    /* quota / private mode — ignore */
  }
};

export const getCachedData = <T = unknown>(
  key: string,
  maxAgeMs = 24 * 60 * 60 * 1000
): T | null => {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const { data, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp > maxAgeMs) return null;
    return data as T;
  } catch {
    return null;
  }
};
