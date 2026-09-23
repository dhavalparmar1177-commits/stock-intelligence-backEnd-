// FYERS v3 REST provider — real-time NSE/BSE data via FYERS API.
// Requires FYERS_APP_ID + FYERS_ACCESS_TOKEN env vars.
// REST methods for initial load, history, search; WebSocket for streaming.

import { env } from "../config/env";
import { ApiError } from "../utils/ApiError";
import { quoteCache, historyCache } from "./cache";
import type { MarketProvider } from "./provider.interface";
import type { LiveQuote, LiveBar, SearchResult } from "./types";
import { fyersSocket } from "./fyers.ws";

const BASE_URL = "https://api-t1.fyers.in/data";
const SYM_MASTER_URL = "https://public.fyers.in/sym_details";

function authHeader(): string {
  if (!env.FYERS_APP_ID || !env.FYERS_ACCESS_TOKEN) {
    throw new ApiError(503, "FYERS credentials not configured (FYERS_APP_ID, FYERS_ACCESS_TOKEN)");
  }
  return `${env.FYERS_APP_ID}:${env.FYERS_ACCESS_TOKEN}`;
}

async function fetchJson(url: string, attempt = 1): Promise<any> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
      },
    });
  } catch {
    throw new ApiError(502, "FYERS API unreachable (network error)");
  }
  if ((res.status === 429 || res.status >= 500) && attempt < 3) {
    await new Promise((r) => setTimeout(r, 800 * attempt));
    return fetchJson(url, attempt + 1);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApiError(502, `FYERS API request failed (HTTP ${res.status}): ${body}`);
  }
  return res.json();
}

// Convert FYERS quote response to our LiveQuote shape.
function parseQuote(raw: any, symbol: string): LiveQuote {
  const v = raw?.v;
  if (!v || typeof v.lp !== "number") {
    throw new ApiError(502, `No live quote available for ${symbol}`);
  }
  const price = v.lp;
  const prevClose = v.prev_close_price ?? 0;
  const change = v.ch ?? (prevClose ? price - prevClose : 0);
  const changePct = v.chp ?? (prevClose ? (change / prevClose) * 100 : 0);
  return {
    symbol,
    name: symbol, // Name resolved later via symbol table if needed
    exchange: symbol.startsWith("NSE:") ? "NSE" : symbol.startsWith("BSE:") ? "BSE" : "",
    currency: "INR",
    price,
    prevClose,
    change,
    changePct,
    open: v.open_price ?? null,
    dayHigh: v.high_price ?? null,
    dayLow: v.low_price ?? null,
    volume: v.volume ?? null,
    week52High: null, // Not available in quote endpoint
    week52Low: null,
    marketTime: v.tt ? new Date(v.tt * 1000).toISOString() : null,
  };
}

// Cache for symbol master (refreshed daily).
let symMasterCache: Map<string, { symTicker: string; symDetails: string }> | null = null;
let symMasterExpiry = 0;

async function getSymMaster(): Promise<Map<string, { symTicker: string; symDetails: string }>> {
  if (symMasterCache && Date.now() < symMasterExpiry) return symMasterCache;
  try {
    const res = await fetch(`${SYM_MASTER_URL}/NSE_CM_sym_master.json`);
    const data = await res.json();
    symMasterCache = new Map(Object.entries(data).map(([k, v]: [string, any]) => [k, { symTicker: v.symTicker || k, symDetails: v.symDetails || k }]));
    symMasterExpiry = Date.now() + 24 * 60 * 60 * 1000; // 24h
  } catch {
    symMasterCache = new Map();
    symMasterExpiry = Date.now() + 60 * 60 * 1000; // retry in 1h
  }
  return symMasterCache;
}

// Map app interval/range to FYERS resolution and date range.
function toFyersResolution(interval: string): string {
  const map: Record<string, string> = {
    "1m": "1", "5m": "5", "15m": "15", "30m": "30", "1h": "60",
    "1d": "D", "1wk": "1W", "1M": "1M",
    "5s": "5S", "15s": "15S", "30s": "30S",
  };
  return map[interval] || "D";
}

function rangeToDate(range: string): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString().split("T")[0];
  const ms: Record<string, number> = {
    "1d": 1, "5d": 5, "1mo": 30, "3mo": 90, "6mo": 180,
    "1y": 365, "2y": 730, "5y": 1825,
  };
  const days = ms[range] || 180;
  const from = new Date(now.getTime() - days * 86400000).toISOString().split("T")[0];
  return { from, to };
}

export const fyersProvider: MarketProvider = {
  name: "fyers",

  async getQuote(symbol: string): Promise<LiveQuote> {
    const key = `q:${symbol}`;
    const cached = quoteCache.get(key);
    if (cached) return cached;

    const data = await fetchJson(`${BASE_URL}/quotes?symbols=${encodeURIComponent(symbol)}`);
    if (data.s !== "ok" || !data.d?.length) {
      throw new ApiError(502, `No live quote available for ${symbol}`);
    }
    const q = parseQuote(data.d[0], symbol);
    quoteCache.set(key, q);
    return q;
  },

  async getQuotes(symbols: string[]): Promise<LiveQuote[]> {
    if (!symbols.length) return [];
    const key = `qs:${symbols.sort().join(",")}`;
    const cached = quoteCache.get(key);
    if (cached) return cached;

    const data = await fetchJson(`${BASE_URL}/quotes?symbols=${encodeURIComponent(symbols.join(","))}`);
    if (data.s !== "ok" || !data.d?.length) {
      throw new ApiError(502, "No live quotes available");
    }
    const quotes = data.d
      .filter((raw: any) => raw?.v && typeof raw.v.lp === "number")
      .map((raw: any, i: number) => parseQuote(raw, symbols[i] || `UNKNOWN${i}`));
    quoteCache.set(key, quotes);
    return quotes;
  },

  async getHistory(symbol: string, interval = "1d", range = "6mo"): Promise<LiveBar[]> {
    const key = `h:${symbol}:${interval}:${range}`;
    const cached = historyCache.get(key);
    if (cached) return cached;

    const resolution = toFyersResolution(interval);
    const { from, to } = rangeToDate(range);
    const url = `${BASE_URL}/history?symbol=${encodeURIComponent(symbol)}&resolution=${resolution}&date_format=1&range_from=${from}&range_to=${to}&cont_flag=0`;

    const data = await fetchJson(url);
    if (data.s !== "ok" || !data.candles?.length) {
      throw new ApiError(502, `No history available for ${symbol}`);
    }
    const bars: LiveBar[] = data.candles.map((c: number[]) => ({
      date: new Date(typeof c[0] === "number" && c[0] > 1e10 ? c[0] * 1000 : c[0]).toISOString(),
      open: c[1],
      high: c[2],
      low: c[3],
      close: c[4],
      volume: c[5] ?? null,
    }));
    historyCache.set(key, bars);
    return bars;
  },

  async search(query: string): Promise<SearchResult[]> {
    const master = await getSymMaster();
    const q = query.toUpperCase();
    const results: SearchResult[] = [];
    for (const [ticker, info] of master) {
      if (results.length >= 15) break;
      if (ticker.includes(q) || info.symDetails.toUpperCase().includes(q)) {
        results.push({
          symbol: ticker,
          name: info.symDetails,
          exchange: ticker.startsWith("NSE:") ? "NSE" : ticker.startsWith("BSE:") ? "BSE" : "",
        });
      }
    }
    return results;
  },

  async connect(symbols: string[]): Promise<void> {
    fyersSocket.connect();
    fyersSocket.subscribe(symbols);
  },

  async disconnect(): Promise<void> {
    fyersSocket.disconnect();
  },

  subscribe(symbols: string[]): AsyncIterable<LiveQuote> {
    fyersSocket.subscribe(symbols);
    // Return an async iterable that yields quotes from the socket.
    return {
      [Symbol.asyncIterator]() {
        const queue: LiveQuote[] = [];
        let resolve: ((value: IteratorResult<LiveQuote>) => void) | null = null;
        const unsub = fyersSocket.on((event) => {
          if (event.type === "quote") {
            const q = event.data as LiveQuote;
            if (symbols.includes(q.symbol)) {
              if (resolve) { resolve({ value: q, done: false }); resolve = null; }
              else queue.push(q);
            }
          }
        });
        return {
          next(): Promise<IteratorResult<LiveQuote>> {
            if (queue.length) return Promise.resolve({ value: queue.shift()!, done: false });
            return new Promise((r) => { resolve = r; });
          },
          return() { unsub(); return Promise.resolve({ value: undefined, done: true }); },
        };
      },
    };
  },
};
