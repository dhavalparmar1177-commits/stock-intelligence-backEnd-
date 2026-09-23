// Provider factory — selects the active market data provider based on env.
// Import this instead of directly importing a provider.
// Includes graceful fallback: if FYERS fails, retries with Yahoo.

import { env } from "../config/env";
import type { MarketProvider } from "./provider.interface";
import { yahooProvider } from "./yahoo.provider";
import type { LiveQuote, LiveBar, SearchResult } from "./types";

let activeProvider: MarketProvider | null = null;

export function getProvider(): MarketProvider {
  if (activeProvider) return activeProvider;

  switch (env.MARKET_DATA_PROVIDER) {
    case "fyers": {
      // Lazy-load FYERS so Yahoo remains the default with zero config.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require("./fyers.provider");
      activeProvider = mod.fyersProvider as MarketProvider;
      break;
    }
    default:
      activeProvider = yahooProvider;
  }

  return activeProvider!;
}

// Allow runtime override (e.g. fallback from FYERS to Yahoo on auth failure).
export function setProvider(provider: MarketProvider) {
  activeProvider = provider;
}

export function resetProvider() {
  activeProvider = null;
}

// Fallback-aware wrapper: tries primary provider, falls back to Yahoo on error.
// Used by market.service.ts to prevent FYERS outages from breaking the app.
export async function withFallback<T>(fn: (p: MarketProvider) => Promise<T>): Promise<T> {
  const primary = getProvider();
  try {
    return await fn(primary);
  } catch (err) {
    // If primary is already Yahoo, no fallback possible.
    if (primary.name === "yahoo") throw err;
    console.warn(`[Provider] ${primary.name} failed, falling back to Yahoo:`, (err as Error).message);
    return fn(yahooProvider);
  }
}
