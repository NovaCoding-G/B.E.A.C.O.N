interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

const DEFAULT_TTL_MS = 15 * 60 * 1000;

export function getCached<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function setCached<T>(
  key: string,
  value: T,
  ttlMs: number = DEFAULT_TTL_MS,
): void {
  store.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

/** Clear all entries (tests / explicit invalidation). */
export function clearCache(): void {
  store.clear();
}

export const CACHE_TTL_MS = DEFAULT_TTL_MS;

export const CACHE_KEYS = {
  JPL_CAD: "jpl-cad",
  JPL_SENTRY: "jpl-sentry",
  ESA_RISK: "esa-neocc-risk",
  ESA_CLOSE: "esa-neocc-close",
  RECONCILE: "reconcile",
} as const;
