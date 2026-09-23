"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.indexCache = exports.historyCache = exports.quoteCache = exports.TtlCache = void 0;
// Minimal in-memory TTL cache for live provider responses.
// Live data is fetched on demand and cached briefly to respect rate limits.
// Nothing is fabricated: cache misses trigger a real fetch; fetch failures throw.
class TtlCache {
    constructor(ttlMs) {
        this.ttlMs = ttlMs;
        this.store = new Map();
    }
    get(key) {
        const hit = this.store.get(key);
        if (!hit || hit.expires < Date.now()) {
            if (hit)
                this.store.delete(key);
            return null;
        }
        return hit.value;
    }
    set(key, value) {
        this.store.set(key, { value, expires: Date.now() + this.ttlMs });
    }
}
exports.TtlCache = TtlCache;
exports.quoteCache = new TtlCache(15000); // 15s
exports.historyCache = new TtlCache(120000); // 2min
exports.indexCache = new TtlCache(30000); // 30s
