import { ApiError } from "../utils/ApiError";
import { historyCache, quoteCache } from "./cache";
import type { MarketProvider } from "./provider.interface";
import type { LiveQuote, LiveBar, SearchResult } from "./types";

const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) StockIntel/1.0" };

async function fetchJson(url: string, attempt = 1): Promise<any> {
  let res: Response;
  try {
    res = await fetch(url, { headers: UA });
  } catch {
    throw new ApiError(502, "Market provider unreachable (network error)");
  }
  if ((res.status === 429 || res.status >= 500) && attempt < 3) {
    // Public feed rate-limits bursty callers: back off and retry, never fake.
    await new Promise((r) => setTimeout(r, 800 * attempt));
    return fetchJson(url, attempt + 1);
  }
  if (!res.ok) throw new ApiError(502, `Market provider request failed (HTTP ${res.status})`);
  return res.json();
}

function toQuote(symbol: string, meta: any): LiveQuote {
  const price = meta.regularMarketPrice;
  const prevClose = meta.chartPreviousClose ?? meta.previousClose;
  if (typeof price !== "number" || typeof prevClose !== "number" || prevClose === 0) {
    throw new ApiError(502, `No live quote available for ${symbol}`);
  }
  const change = price - prevClose;
  return {
    symbol: meta.symbol || symbol,
    name: meta.longName || meta.shortName || symbol,
    exchange: meta.exchangeName || meta.fullExchangeName || "",
    currency: meta.currency || "",
    price,
    prevClose,
    change,
    changePct: (change / prevClose) * 100,
    open: null, // v8 meta has no reliable open; use intraday history for OHLC
    dayHigh: meta.regularMarketDayHigh ?? null,
    dayLow: meta.regularMarketDayLow ?? null,
    volume: meta.regularMarketVolume ?? null,
    week52High: meta.fiftyTwoWeekHigh ?? null,
    week52Low: meta.fiftyTwoWeekLow ?? null,
    marketTime: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : null,
  };
}

// Free, keyless, REAL market data (Yahoo Finance public chart API).
// No authentication, no fabrication: if Yahoo has no data, we throw.
export const yahooProvider: MarketProvider = {
  name: "yahoo",

  async getQuote(symbol: string): Promise<LiveQuote> {
    const key = `q:${symbol}`;
    const cached = quoteCache.get(key);
    if (cached) return cached;
    const data = await fetchJson(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`
    );
    const result = data?.chart?.result?.[0];
    if (!result?.meta) throw new ApiError(502, `No live quote available for ${symbol}`);
    const q = toQuote(symbol, result.meta);
    quoteCache.set(key, q);
    return q;
  },

  async getQuotes(symbols: string[]): Promise<LiveQuote[]> {
    const settled = await Promise.allSettled(symbols.map((s) => this.getQuote(s)));
    return settled.filter((r) => r.status === "fulfilled").map((r: any) => r.value);
  },

  async getHistory(symbol: string, interval = "1d", range = "6mo"): Promise<LiveBar[]> {
    const key = `h:${symbol}:${interval}:${range}`;
    const cached = historyCache.get(key);
    if (cached) return cached;
    const data = await fetchJson(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${encodeURIComponent(interval)}&range=${encodeURIComponent(range)}`
    );
    const result = data?.chart?.result?.[0];
    const ts: number[] = result?.timestamp || [];
    const quote = result?.indicators?.quote?.[0] || {};
    const bars: LiveBar[] = [];
    for (let i = 0; i < ts.length; i++) {
      const close = quote.close?.[i];
      if (typeof close !== "number") continue; // skip gaps — never invent candles
      bars.push({
        date: new Date(ts[i] * 1000).toISOString(),
        open: quote.open?.[i] ?? close,
        high: quote.high?.[i] ?? close,
        low: quote.low?.[i] ?? close,
        close,
        volume: quote.volume?.[i] ?? null,
      });
    }
    if (!bars.length) throw new ApiError(502, `No live history available for ${symbol}`);
    historyCache.set(key, bars);
    return bars;
  },

  async search(query: string): Promise<SearchResult[]> {
    const data = await fetchJson(
      `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}`
    );
    return ((data?.quotes || []) as any[])
      .filter((q) => q.symbol && q.quoteType !== "INDEX" && q.quoteType !== "FUTURE")
      .slice(0, 15)
      .map((q) => ({ symbol: q.symbol, name: q.longname || q.shortname || q.symbol, exchange: q.exchDisp || q.exchange || "" }));
  },
};
