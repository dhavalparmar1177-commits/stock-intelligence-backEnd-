// In-memory cache with Stale-While-Revalidate (SWR) and inflight deduplication.
// Respects provider rate limits and guarantees no fake data: cache misses
// trigger real fetches, and fetch failures are propagated or served stale.

interface CacheEntry<T> {
  value: T;
  expires: number;       // Fresh TTL
  staleExpires: number;  // Grace TTL (can be served while revalidating)
  fetchedAt: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  staleHits: number;
  size: number;
  keys: string[];
}

export class TtlCache<T> {
  private store = new Map<string, CacheEntry<T>>();
  private inflight = new Map<string, Promise<T>>();
  private hits = 0;
  private misses = 0;
  private staleHits = 0;

  constructor(
    private ttlMs: number,
    private staleGraceMs: number = ttlMs * 3
  ) {}

  get(key: string): T | null {
    const hit = this.store.get(key);
    if (!hit) {
      this.misses++;
      return null;
    }
    const now = Date.now();
    if (hit.expires >= now) {
      this.hits++;
      return hit.value;
    }
    // Expired past stale threshold?
    if (hit.staleExpires < now) {
      this.store.delete(key);
      this.misses++;
      return null;
    }
    // In stale grace period
    this.staleHits++;
    return hit.value;
  }

  set(key: string, value: T, ttlOverride?: number) {
    const ttl = ttlOverride ?? this.ttlMs;
    const now = Date.now();
    this.store.set(key, {
      value,
      expires: now + ttl,
      staleExpires: now + ttl + this.staleGraceMs,
      fetchedAt: now,
    });
  }

  delete(key: string) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
    this.inflight.clear();
  }

  async getOrFetch(
    key: string,
    fetcher: () => Promise<T>,
    ttlOverride?: number
  ): Promise<T> {
    const now = Date.now();
    const hit = this.store.get(key);

    // 1. Fresh hit: return immediately
    if (hit && hit.expires >= now) {
      this.hits++;
      return hit.value;
    }

    // 2. Stale hit (within staleGrace): return stale data immediately,
    // and revalidate asynchronously in background (SWR)
    if (hit && hit.staleExpires >= now) {
      this.staleHits++;
      if (!this.inflight.has(key)) {
        const bgPromise = fetcher()
          .then((val) => {
            this.set(key, val, ttlOverride);
            return val;
          })
          .catch((err) => {
            console.warn(`[TtlCache] SWR revalidation failed for ${key}:`, err?.message || err);
            return hit.value;
          })
          .finally(() => {
            this.inflight.delete(key);
          });
        this.inflight.set(key, bgPromise);
      }
      return hit.value;
    }

    // 3. Cache miss: coalesce concurrent inflight requests
    if (this.inflight.has(key)) {
      return this.inflight.get(key)!;
    }

    this.misses++;
    const promise = fetcher()
      .then((val) => {
        this.set(key, val, ttlOverride);
        return val;
      })
      .finally(() => {
        this.inflight.delete(key);
      });

    this.inflight.set(key, promise);
    return promise;
  }

  stats(): CacheStats {
    const now = Date.now();
    for (const [k, v] of this.store.entries()) {
      if (v.staleExpires < now) {
        this.store.delete(k);
      }
    }
    return {
      hits: this.hits,
      misses: this.misses,
      staleHits: this.staleHits,
      size: this.store.size,
      keys: Array.from(this.store.keys()),
    };
  }
}

export const quoteCache = new TtlCache<any>(15_000, 60_000);   // 15s fresh, 60s stale
export const historyCache = new TtlCache<any>(120_000, 600_000); // 2m fresh, 10m stale
export const indexCache = new TtlCache<any>(15_000, 60_000);    // 15s fresh, 60s stale
export const moversCache = new TtlCache<any>(20_000, 90_000);   // 20s fresh, 90s stale
export const overviewCache = new TtlCache<any>(30_000, 120_000); // 30s fresh, 2m stale
export const scanCache = new TtlCache<any>(60_000, 300_000);    // 60s fresh, 5m stale

export function getCacheStats(): Record<string, CacheStats> {
  return {
    quote: quoteCache.stats(),
    history: historyCache.stats(),
    index: indexCache.stats(),
    movers: moversCache.stats(),
    overview: overviewCache.stats(),
    scan: scanCache.stats(),
  };
}
