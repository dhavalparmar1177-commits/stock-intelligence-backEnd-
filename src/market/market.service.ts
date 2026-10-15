import { env } from "../config/env";
import { ApiError } from "../utils/ApiError";
import { getProvider, withFallback } from "./provider.factory";
import { APP_SYMBOLS, INDICES, MOVERS_UNIVERSE, toApp, toYahoo, toFyers } from "./symbols";
import { indexCache, moversCache, quoteCache } from "./cache";

export type MarketMode = "demo" | "live";

// Map app symbol to provider-native ticker.
function toProviderSymbol(appSymbol: string): string {
  return env.MARKET_DATA_PROVIDER === "fyers" ? toFyers(appSymbol) : toYahoo(appSymbol);
}

// Modes are resolved per request but NEVER mixed inside one response.
// Every live response carries mode: "live"; demo paths are untouched.
export function resolveMode(queryMode?: unknown): MarketMode {
  if (queryMode === "live") return "live";
  if (queryMode === "demo") return "demo";
  return env.MARKET_MODE;
}

export const marketService = {
  status(queryMode?: unknown) {
    const mode = resolveMode(queryMode);
    return {
      mode,
      provider: mode === "live" ? getProvider().name : "demo-db",
      market: "IN" as const,
      universe: APP_SYMBOLS.filter((s) => s.exchange === "NSE" || s.exchange === "BSE").map((s) => ({ symbol: s.app, name: s.name, exchange: s.exchange })),
    };
  },

  async indices() {
    return indexCache.getOrFetch("indices", async () => {
      const provider = getProvider();
      const symbols = INDICES.map((i) => (provider.name === "fyers" ? i.fyers : i.yahoo));
      const quotes = await withFallback((p) => p.getQuotes(symbols));
      return {
        mode: "live" as const,
        asOf: new Date().toISOString(),
        indices: INDICES.map((idx) => {
          const providerSym = provider.name === "fyers" ? idx.fyers : idx.yahoo;
          const q = quotes.find((x) => x.symbol === providerSym);
          if (!q) return { symbol: idx.app, name: idx.name, unavailable: true };
          return {
            symbol: idx.app,
            name: idx.name,
            price: q.price,
            change: q.change,
            changePct: q.changePct,
            marketTime: q.marketTime,
          };
        }),
      };
    });
  },

  async quotes(symbols: string[]) {
    if (!symbols.length) throw new ApiError(400, "Provide at least one symbol");
    if (symbols.length > 25) throw new ApiError(400, "Max 25 symbols per request");

    // Multi-symbol batching with cache lookup
    const results: any[] = [];
    const missingAppSyms: string[] = [];

    for (const s of symbols) {
      const pSym = toProviderSymbol(s);
      const cached = quoteCache.get(`q:${pSym}`);
      if (cached) {
        results.push({ appSymbol: toApp(cached.symbol), ...cached });
      } else {
        missingAppSyms.push(s);
      }
    }

    if (missingAppSyms.length > 0) {
      const providerSyms = missingAppSyms.map(toProviderSymbol);
      const fetched = await withFallback((p) => p.getQuotes(providerSyms));
      for (const q of fetched) {
        quoteCache.set(`q:${q.symbol}`, q);
        results.push({ appSymbol: toApp(q.symbol), ...q });
      }
    }

    return {
      mode: "live" as const,
      asOf: new Date().toISOString(),
      quotes: results,
    };
  },

  async history(symbol: string, interval = "1d", range = "6mo") {
    const allowedIntervals = ["1m", "5m", "15m", "1h", "1d", "1wk"];
    const allowedRanges = ["1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y"];
    if (!allowedIntervals.includes(interval) || !allowedRanges.includes(range)) {
      throw new ApiError(400, "Invalid interval or range");
    }
    const providerSym = toProviderSymbol(symbol);
    const bars = await withFallback((p) => p.getHistory(providerSym, interval, range));
    return { mode: "live" as const, symbol: symbol.toUpperCase(), interval, range, bars };
  },

  async search(q: string) {
    if (!q || q.length < 1) return { mode: "live" as const, results: [] };
    const local = APP_SYMBOLS.filter(
      (s) => s.app.includes(q.toUpperCase()) || s.name.toUpperCase().includes(q.toUpperCase())
    ).map((s) => ({ symbol: s.yahoo, appSymbol: s.app, name: s.name, exchange: s.exchange }));
    const remote = await withFallback((p) => p.search(q));
    const seen = new Set(local.map((l) => l.symbol));
    const merged = [...local];
    for (const r of remote) {
      if (!seen.has(r.symbol)) merged.push({ ...r, appSymbol: toApp(r.symbol) });
      if (merged.length >= 15) break;
    }
    return { mode: "live" as const, results: merged };
  },

  async movers() {
    return moversCache.getOrFetch("movers", async () => {
      const nse = MOVERS_UNIVERSE.filter((s) => s.exchange === "NSE" || s.exchange === "BSE");
      const provider = getProvider();
      const symbols = nse.map((s) => (provider.name === "fyers" ? s.fyers : s.yahoo));
      const quotes = await withFallback((p) => p.getQuotes(symbols));
      const rows = quotes.map((q) => ({ appSymbol: toApp(q.symbol), ...q }));
      const byChange = [...rows].sort((a, b) => b.changePct - a.changePct);
      const byVolume = [...rows].filter((r) => r.volume !== null).sort((a, b) => (b.volume || 0) - (a.volume || 0));
      return {
        mode: "live" as const,
        market: "IN" as const,
        asOf: new Date().toISOString(),
        universe: `${nse.length} tracked NSE symbols`,
        gainers: byChange.slice(0, 5),
        losers: byChange.slice(-5).reverse(),
        mostActive: byVolume.slice(0, 5),
      };
    });
  },
};
