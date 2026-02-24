/**
 * Simple in-memory TTL cache for API responses.
 * Module-level Map persists across re-renders within a browser session.
 * No external dependencies required.
 */

interface CacheEntry<T> {
  data: T;
  expires: number;
}

const store = new Map<string, CacheEntry<unknown>>();

export function getCached<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    store.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCache<T>(key: string, data: T, ttlMs = 60_000): void {
  store.set(key, { data, expires: Date.now() + ttlMs });
}

/**
 * Remove all cache entries whose key contains the given string.
 * Use after mutations to ensure stale data is not served.
 */
export function invalidateCache(pattern: string): void {
  for (const key of store.keys()) {
    if (key.includes(pattern)) store.delete(key);
  }
}
