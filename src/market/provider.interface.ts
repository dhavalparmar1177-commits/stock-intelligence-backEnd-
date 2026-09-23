// MarketProvider — contract every data provider must implement.
// The rest of the app consumes ONLY this interface; providers are swappable.

import type { LiveQuote, LiveBar, SearchResult, ProviderName } from "./types";

export interface MarketProvider {
  readonly name: ProviderName;

  // REST methods — used for initial load, history, search.
  getQuote(symbol: string): Promise<LiveQuote>;
  getQuotes(symbols: string[]): Promise<LiveQuote[]>;
  getHistory(symbol: string, interval: string, range: string): Promise<LiveBar[]>;
  search(query: string): Promise<SearchResult[]>;

  // Lifecycle — optional providers can implement connect/disconnect for WebSocket.
  connect?(symbols: string[]): Promise<void>;
  disconnect?(): Promise<void>;

  // Subscription — for WebSocket providers; returns an async iterable of updates.
  subscribe?(symbols: string[]): AsyncIterable<LiveQuote>;
}
