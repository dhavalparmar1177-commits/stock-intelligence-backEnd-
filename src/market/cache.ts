// Minimal in-memory TTL cache for live provider responses.
// Live data is fetched on demand and cached briefly to respect rate limits.
// Nothing is fabricated: cache misses trigger a real fetch; fetch failures throw.
export class TtlCache<T> {
  private store = new Map<string, { value: T; expires: number }>();
  constructor(private ttlMs: number) {}
  get(key: string): T | null {
    const hit = this.store.get(key);
    if (!hit || hit.expires < Date.now()) {
      if (hit) this.store.delete(key);
      return null;
    }
    return hit.value;
  }
  set(key: string, value: T) {
    this.store.set(key, { value, expires: Date.now() + this.ttlMs });
  }
}

export const quoteCache = new TtlCache<any>(15_000); // 15s
export const historyCache = new TtlCache<any>(120_000); // 2min
export const indexCache = new TtlCache<any>(30_000); // 30s
