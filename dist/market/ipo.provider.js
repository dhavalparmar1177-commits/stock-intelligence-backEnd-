"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ipoProvider = void 0;
const ApiError_1 = require("../utils/ApiError");
const cache_1 = require("./cache");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) StockIntel/1.0";
const BASE = "https://www.nseindia.com";
const ipoCache = new cache_1.TtlCache(300000); // 5min — NSE rate-limits aggressively
let cookie = "";
let cookieAt = 0;
async function sessionCookie() {
    if (cookie && Date.now() - cookieAt < 10 * 60 * 1000)
        return cookie;
    const res = await fetch(`${BASE}/market-data/ipo-current-issue`, { headers: { "User-Agent": UA } });
    const raw = res.headers.get("set-cookie") || "";
    const pairs = raw
        .split(/,(?=[^;]+=[^;]+)/)
        .map((c) => c.split(";")[0].trim())
        .filter((c) => c.includes("=") && !/^expires=/i.test(c));
    if (!pairs.length)
        throw new ApiError_1.ApiError(502, "IPO provider session unavailable");
    cookie = pairs.join("; ");
    cookieAt = Date.now();
    return cookie;
}
async function fetchNse(path, attempt = 1) {
    let res;
    try {
        res = await fetch(`${BASE}${path}`, {
            headers: { "User-Agent": UA, Accept: "application/json", Cookie: await sessionCookie() },
        });
    }
    catch {
        throw new ApiError_1.ApiError(502, "IPO provider unreachable (network error)");
    }
    if ((res.status === 401 || res.status === 403) && attempt === 1) {
        cookie = ""; // session expired — refresh once and retry
        return fetchNse(path, 2);
    }
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
        return fetchNse(path, attempt + 1);
    }
    if (!res.ok)
        throw new ApiError_1.ApiError(502, `IPO provider request failed (HTTP ${res.status})`);
    return res.json();
}
exports.ipoProvider = {
    async currentIssues() {
        const key = "ipo:current";
        const hit = ipoCache.get(key);
        if (hit)
            return hit;
        const data = await fetchNse("/api/ipo-current-issue");
        const rows = Array.isArray(data) ? data : [];
        ipoCache.set(key, rows);
        return rows;
    },
    async upcomingIssues() {
        const key = "ipo:upcoming";
        const hit = ipoCache.get(key);
        if (hit)
            return hit;
        const data = await fetchNse("/api/all-upcoming-issues?category=ipo");
        const rows = Array.isArray(data) ? data : [];
        ipoCache.set(key, rows);
        return rows;
    },
    async bidDetails(symbol, series = "EQ") {
        const key = `ipo:bids:${symbol.toUpperCase()}:${series.toUpperCase()}`;
        const hit = ipoCache.get(key);
        if (hit)
            return hit;
        const data = await fetchNse(`/api/ipo-bid-details?symbol=${encodeURIComponent(symbol.toUpperCase())}&series=${encodeURIComponent(series.toUpperCase())}`);
        const out = { rows: Array.isArray(data?.data) ? data.data : [], updateTime: data?.updateTime ?? null };
        ipoCache.set(key, out);
        return out;
    },
};
