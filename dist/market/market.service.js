"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.marketService = void 0;
exports.resolveMode = resolveMode;
const env_1 = require("../config/env");
const ApiError_1 = require("../utils/ApiError");
const yahoo_provider_1 = require("./yahoo.provider");
const symbols_1 = require("./symbols");
const cache_1 = require("./cache");
// Modes are resolved per request but NEVER mixed inside one response.
// Every live response carries mode: "live"; demo paths are untouched.
function resolveMode(queryMode) {
    if (queryMode === "live")
        return "live";
    if (queryMode === "demo")
        return "demo";
    return env_1.env.MARKET_MODE;
}
exports.marketService = {
    status(queryMode) {
        const mode = resolveMode(queryMode);
        return {
            mode,
            provider: mode === "live" ? yahoo_provider_1.yahooProvider.name : "demo-db",
            market: "IN",
            universe: symbols_1.APP_SYMBOLS.filter((s) => s.exchange === "NSE" || s.exchange === "BSE").map((s) => ({ symbol: s.app, name: s.name, exchange: s.exchange })),
        };
    },
    async indices() {
        const cached = cache_1.indexCache.get("indices");
        if (cached)
            return cached;
        const quotes = await yahoo_provider_1.yahooProvider.getQuotes(symbols_1.INDICES.map((i) => i.yahoo));
        const out = {
            mode: "live",
            asOf: new Date().toISOString(),
            indices: symbols_1.INDICES.map((idx) => {
                const q = quotes.find((x) => x.symbol === idx.yahoo);
                if (!q)
                    return { symbol: idx.app, name: idx.name, unavailable: true };
                return { symbol: idx.app, name: idx.name, price: q.price, change: q.change, changePct: q.changePct, marketTime: q.marketTime };
            }),
        };
        cache_1.indexCache.set("indices", out);
        return out;
    },
    async quotes(symbols) {
        if (!symbols.length)
            throw new ApiError_1.ApiError(400, "Provide at least one symbol");
        if (symbols.length > 25)
            throw new ApiError_1.ApiError(400, "Max 25 symbols per request");
        const yahooSyms = symbols.map(symbols_1.toYahoo);
        const quotes = await yahoo_provider_1.yahooProvider.getQuotes(yahooSyms);
        return {
            mode: "live",
            asOf: new Date().toISOString(),
            quotes: quotes.map((q) => ({ appSymbol: (0, symbols_1.toApp)(q.symbol), ...q })),
        };
    },
    async history(symbol, interval = "1d", range = "6mo") {
        const allowedIntervals = ["1m", "5m", "15m", "1h", "1d", "1wk"];
        const allowedRanges = ["1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y"];
        if (!allowedIntervals.includes(interval) || !allowedRanges.includes(range)) {
            throw new ApiError_1.ApiError(400, "Invalid interval or range");
        }
        const bars = await yahoo_provider_1.yahooProvider.getHistory((0, symbols_1.toYahoo)(symbol), interval, range);
        return { mode: "live", symbol: symbol.toUpperCase(), interval, range, bars };
    },
    async search(q) {
        if (!q || q.length < 1)
            return { mode: "live", results: [] };
        const local = symbols_1.APP_SYMBOLS.filter((s) => s.app.includes(q.toUpperCase()) || s.name.toUpperCase().includes(q.toUpperCase())).map((s) => ({ symbol: s.yahoo, appSymbol: s.app, name: s.name, exchange: s.exchange }));
        const remote = await yahoo_provider_1.yahooProvider.search(q);
        const seen = new Set(local.map((l) => l.symbol));
        const merged = [...local];
        for (const r of remote) {
            if (!seen.has(r.symbol))
                merged.push({ ...r, appSymbol: (0, symbols_1.toApp)(r.symbol) });
            if (merged.length >= 15)
                break;
        }
        return { mode: "live", results: merged };
    },
    async movers() {
        const nse = symbols_1.MOVERS_UNIVERSE.filter((s) => s.exchange === "NSE" || s.exchange === "BSE");
        const quotes = await yahoo_provider_1.yahooProvider.getQuotes(nse.map((s) => s.yahoo));
        const rows = quotes.map((q) => ({ appSymbol: (0, symbols_1.toApp)(q.symbol), ...q }));
        const byChange = [...rows].sort((a, b) => b.changePct - a.changePct);
        const byVolume = [...rows].filter((r) => r.volume !== null).sort((a, b) => (b.volume || 0) - (a.volume || 0));
        return {
            mode: "live",
            market: "IN",
            asOf: new Date().toISOString(),
            universe: `${nse.length} tracked NSE symbols`,
            gainers: byChange.slice(0, 5),
            losers: byChange.slice(-5).reverse(),
            mostActive: byVolume.slice(0, 5),
        };
    },
};
