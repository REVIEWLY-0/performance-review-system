/**
 * Simple in-memory TTL cache + in-flight deduplication for API responses.
 * Module-level Maps persist across re-renders within a browser session.
 *
 * In-flight deduplication solves the React StrictMode double-invoke problem:
 * StrictMode fires every useEffect twice in ~10ms. Both calls miss the cache
 * (nothing is populated yet), but with dedupeAsync the second call returns the
 * same Promise as the first instead of launching a second HTTP request.
 */

interface CacheEntry<T> {
  data: T;
  expires: number;
}

const store = new Map<string, CacheEntry<unknown>>();
// Tracks in-flight fetches so concurrent callers share one Promise
const inflight = new Map<string, Promise<unknown>>();

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
 * Wraps a fetch in TTL caching + in-flight deduplication.
 * If the same key is already being fetched, returns the existing Promise.
 * On success, stores the result in cache for ttlMs milliseconds.
 *
 * Usage:
 *   return cachedFetch('my:key', () => fetchWithAuth(url), 30_000);
 */
export function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = 60_000,
): Promise<T> {
  // Return cached value if fresh
  const cached = getCached<T>(key);
  if (cached !== null) return Promise.resolve(cached);

  // Return the in-flight promise if one exists (deduplication)
  if (inflight.has(key)) return inflight.get(key) as Promise<T>;

  // Launch fetch, cache on success, always clear in-flight when done
  const p = fetcher()
    .then((data) => {
      setCache(key, data, ttlMs);
      return data;
    })
    .finally(() => inflight.delete(key));

  inflight.set(key, p);
  return p;
}

/**
 * Remove all cache entries (and in-flight entries) whose key contains the given string.
 * Use after mutations to ensure stale data is not served.
 */
export function invalidateCache(pattern: string): void {
  for (const key of store.keys()) {
    if (key.includes(pattern)) store.delete(key);
  }
  for (const key of inflight.keys()) {
    if (key.includes(pattern)) inflight.delete(key);
  }
}
