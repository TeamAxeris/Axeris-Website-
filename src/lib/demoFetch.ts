/**
 * demoFetch · instant-load caching layer for the Axeris demo.
 *
 * Problem: every page re-fetches the same seed data from the backend on
 * every mount. Locally that's tens of ms, but on the deployed demo
 * (Vercel frontend → Render backend) a cold backend + network round-trip
 * makes every navigation feel slow.
 *
 * Strategy: stale-while-revalidate.
 *   1. In-memory cache (instant within a session, survives route changes).
 *   2. sessionStorage cache (survives full page reloads within the tab).
 *   3. On a cache hit the cached data is returned IMMEDIATELY and a
 *      background refresh updates the cache for the next visit.
 *   4. On failure with a cached copy available, the cache is served so
 *      the demo never hangs on a skeleton.
 *
 * Only used for idempotent GETs of demo data. POST/actions go through
 * lib/api.ts unchanged.
 */

type CacheEntry = { t: number; data: unknown };

const mem = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();

/** Data younger than this is served without a background refresh. */
const FRESH_MS = 60_000;
/** sessionStorage entries older than this are ignored. */
const SESSION_TTL_MS = 12 * 60 * 60_000;
const SS_PREFIX = "axeris:cache:";

function ssGet(url: string): CacheEntry | null {
  try {
    const raw = sessionStorage.getItem(SS_PREFIX + url);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    // Shape-validate: a poisoned/corrupt entry (wrong type, future timestamp,
    // missing data) must never be promoted into the memory cache.
    if (!entry || typeof entry !== "object" || typeof entry.t !== "number" || !("data" in entry)) return null;
    if (entry.t > Date.now()) return null;
    if (Date.now() - entry.t > SESSION_TTL_MS) return null;
    return entry;
  } catch {
    return null;
  }
}

function store(url: string, data: unknown) {
  const entry: CacheEntry = { t: Date.now(), data };
  mem.set(url, entry);
  try {
    sessionStorage.setItem(SS_PREFIX + url, JSON.stringify(entry));
  } catch {
    /* storage full · memory cache still works */
  }
}

type Fetcher = () => Promise<unknown>;

async function rawFetch(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

/** Deduplicated network fetch that updates the cache. */
function refresh(url: string, fetcher: Fetcher = () => rawFetch(url)): Promise<unknown> {
  const existing = inflight.get(url);
  if (existing) return existing;
  const p = fetcher()
    .then((data) => {
      store(url, data);
      return data;
    })
    .finally(() => inflight.delete(url));
  inflight.set(url, p);
  return p;
}

/**
 * Cached GET. Returns instantly from cache when possible; falls back to
 * network; never throws if any cached copy exists. Pass a custom fetcher
 * to reuse an existing network stack (retries, timeouts) for the miss path.
 */
export async function demoFetch<T = any>(url: string, fetcher?: Fetcher): Promise<T> {
  const cached = mem.get(url) ?? ssGet(url);
  if (cached) {
    if (!mem.has(url)) mem.set(url, cached); // promote to memory
    if (Date.now() - cached.t > FRESH_MS) {
      void refresh(url, fetcher).catch(() => {}); // stale: revalidate in background
    }
    return cached.data as T;
  }
  try {
    return (await refresh(url, fetcher)) as T;
  } catch (err) {
    const fallback = mem.get(url) ?? ssGet(url);
    if (fallback) return fallback.data as T;
    throw err;
  }
}

/** Fire-and-forget warm-up used by the app shell prefetcher. */
export function prefetch(urls: string[], staggerMs = 120): void {
  urls.forEach((url, i) => {
    if (mem.has(url) || ssGet(url)) return; // already warm
    setTimeout(() => {
      void refresh(url).catch(() => {});
    }, i * staggerMs);
  });
}

/** Invalidate after a mutation so the next read refetches. */
export function invalidate(prefix: string): void {
  for (const key of Array.from(mem.keys())) {
    if (key.startsWith(prefix)) mem.delete(key);
  }
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(SS_PREFIX + prefix)) sessionStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}
