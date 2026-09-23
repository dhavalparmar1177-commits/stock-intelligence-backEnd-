import { ApiError } from "../utils/ApiError";
import { TtlCache } from "./cache";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) StockIntel/1.0";
const BASE = "https://www.nseindia.com";

export interface NseIpoRow {
  symbol?: string;
  companyName?: string;
  issueStartDate?: string; // "09-Sep-2026"
  issueEndDate?: string;
  issuePrice?: string; // "Rs.139 to Rs.146" (SME rows may omit)
  issueSize?: string; // shares offered (string, may be sci-notation)
  status?: string;
  series?: string; // EQ | SME
  isBse?: string;
  category?: string;
  noOfSharesOffered?: string;
  noOfsharesBid?: string;
  noOfTime?: string; // subscription multiple
  [k: string]: unknown;
}

export interface NseBidRow {
  category?: string;
  noOfSharesOffered?: string;
  noOfTime?: string;
  noOfsharesBid?: string;
  srNo?: string | null;
}

const ipoCache = new TtlCache<any>(300_000); // 5min — NSE rate-limits aggressively

let cookie = "";
let cookieAt = 0;

async function sessionCookie(): Promise<string> {
  if (cookie && Date.now() - cookieAt < 10 * 60 * 1000) return cookie;
  const res = await fetch(`${BASE}/market-data/ipo-current-issue`, { headers: { "User-Agent": UA } });
  const raw = res.headers.get("set-cookie") || "";
  const pairs = raw
    .split(/,(?=[^;]+=[^;]+)/)
    .map((c) => c.split(";")[0].trim())
    .filter((c) => c.includes("=") && !/^expires=/i.test(c));
  if (!pairs.length) throw new ApiError(502, "IPO provider session unavailable");
  cookie = pairs.join("; ");
  cookieAt = Date.now();
  return cookie;
}

async function fetchNse<T>(path: string, attempt = 1): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { "User-Agent": UA, Accept: "application/json", Cookie: await sessionCookie() },
    });
  } catch {
    throw new ApiError(502, "IPO provider unreachable (network error)");
  }
  if ((res.status === 401 || res.status === 403) && attempt === 1) {
    cookie = ""; // session expired — refresh once and retry
    return fetchNse<T>(path, 2);
  }
  if ((res.status === 429 || res.status >= 500) && attempt < 3) {
    await new Promise((r) => setTimeout(r, 1000 * attempt));
    return fetchNse<T>(path, attempt + 1);
  }
  if (!res.ok) throw new ApiError(502, `IPO provider request failed (HTTP ${res.status})`);
  return res.json() as Promise<T>;
}

export const ipoProvider = {
  async currentIssues(): Promise<NseIpoRow[]> {
    const key = "ipo:current";
    const hit = ipoCache.get(key);
    if (hit) return hit;
    const data = await fetchNse<NseIpoRow[]>("/api/ipo-current-issue");
    const rows = Array.isArray(data) ? data : [];
    ipoCache.set(key, rows);
    return rows;
  },

  async upcomingIssues(): Promise<NseIpoRow[]> {
    const key = "ipo:upcoming";
    const hit = ipoCache.get(key);
    if (hit) return hit;
    const data = await fetchNse<NseIpoRow[]>("/api/all-upcoming-issues?category=ipo");
    const rows = Array.isArray(data) ? data : [];
    ipoCache.set(key, rows);
    return rows;
  },

  async bidDetails(symbol: string, series = "EQ"): Promise<{ rows: NseBidRow[]; updateTime: string | null }> {
    const key = `ipo:bids:${symbol.toUpperCase()}:${series.toUpperCase()}`;
    const hit = ipoCache.get(key);
    if (hit) return hit;
    const data = await fetchNse<{ data?: NseBidRow[]; updateTime?: string }>(
      `/api/ipo-bid-details?symbol=${encodeURIComponent(symbol.toUpperCase())}&series=${encodeURIComponent(series.toUpperCase())}`
    );
    const out = { rows: Array.isArray(data?.data) ? data.data : [], updateTime: data?.updateTime ?? null };
    ipoCache.set(key, out);
    return out;
  },

  /**
   * Optional IPO Guru integration (used only when an explicit licensed API key is configured).
   * Respects rate limits (15 req/min, 300/day) with 5min cache. Never scrapes.
   */
  async ipoGuruData(): Promise<any[] | null> {
    const apiKey = process.env.IPOGURU_API_KEY;
    if (!apiKey) return null;
    const key = "ipo:guru:all";
    const hit = ipoCache.get(key);
    if (hit) return hit;

    try {
      const res = await fetch("https://www.ipoguru.in/api/v1/ipos", {
        headers: {
          "X-API-KEY": apiKey,
          Accept: "application/json",
          "User-Agent": UA,
        },
      });
      if (!res.ok) return null;
      const json = await res.json();
      const list = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
      ipoCache.set(key, list);
      return list;
    } catch {
      return null;
    }
  },
};
