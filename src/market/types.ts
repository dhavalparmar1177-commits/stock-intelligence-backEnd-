// Shared market data types used across all providers.
// Provider implementations MUST return these exact shapes.

export interface LiveQuote {
  symbol: string; // Provider-native ticker (e.g. "RELIANCE.NS" for Yahoo, "NSE:RELIANCE" for FYERS)
  name: string;
  exchange: string;
  currency: string;
  price: number;
  prevClose: number;
  change: number;
  changePct: number;
  open: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  volume: number | null;
  week52High: number | null;
  week52Low: number | null;
  marketTime: string | null; // ISO timestamp of the quote
}

export interface LiveBar {
  date: string; // ISO
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
}

export interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
}

export type ProviderName = "yahoo" | "fyers";
