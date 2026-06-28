/**
 * dataCache.ts — localStorage-backed cache for Supabase data.
 *
 * Strategy:
 *   - On first load: fetch from Supabase, store in localStorage with timestamp.
 *   - On repeat loads within TTL: return cached data instantly (no network).
 *   - After TTL: fetch fresh data in background, show stale data immediately.
 *   - Admin writes (save product, update settings) → bust relevant cache keys.
 *
 * This makes repeat page loads feel instant for visitors.
 */

const CACHE_VERSION = "v2"; // bump this to force-bust all caches on deploy
const TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  data: T;
  ts: number;
  version: string;
}

function cacheKey(key: string): string {
  return `fabcoverz_cache_${key}`;
}

export function cacheGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(cacheKey(key));
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (entry.version !== CACHE_VERSION) return null;
    if (Date.now() - entry.ts > TTL_MS) return null; // expired
    return entry.data;
  } catch {
    return null;
  }
}

export function cacheSet<T>(key: string, data: T): void {
  try {
    const entry: CacheEntry<T> = { data, ts: Date.now(), version: CACHE_VERSION };
    localStorage.setItem(cacheKey(key), JSON.stringify(entry));
  } catch {
    // localStorage full or private mode — silently ignore
  }
}

export function cacheBust(...keys: string[]): void {
  keys.forEach(k => {
    try { localStorage.removeItem(cacheKey(k)); } catch {}
  });
}

export function cacheBustAll(): void {
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith("fabcoverz_cache_"))
      .forEach(k => localStorage.removeItem(k));
  } catch {}
}

/**
 * Stale-while-revalidate helper.
 * Returns cached data immediately (if available), then fetches fresh in background.
 * onFresh is called when background fetch completes.
 */
export async function cacheFirst<T>(
  key: string,
  fetcher: () => Promise<T>,
  onFresh?: (data: T) => void
): Promise<T> {
  const cached = cacheGet<T>(key);

  if (cached !== null) {
    // Return stale data immediately, revalidate in background
    fetcher().then(fresh => {
      cacheSet(key, fresh);
      onFresh?.(fresh);
    }).catch(() => {}); // background fetch fail = no problem, stale is fine
    return cached;
  }

  // No cache → must wait for fresh data
  const fresh = await fetcher();
  cacheSet(key, fresh);
  return fresh;
}
