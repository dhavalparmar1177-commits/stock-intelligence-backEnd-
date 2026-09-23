// FYERS Data WebSocket client — real-time LTP/OHLC/Volume streaming.
// Connects to wss://socket.fyers.in/hsm/v1-5/prod with SymbolUpdate mode.
// Auto-reconnects with exponential backoff; heartbeat via ping every 15s.

import WebSocket from "ws";
import { env } from "../config/env";
import { ApiError } from "../utils/ApiError";
import type { LiveQuote } from "./types";
import { toAppFromFyers } from "./symbols";

const WS_URL = "wss://socket.fyers.in/hsm/v1-5/prod";
const PING_INTERVAL_MS = 15_000;
const MAX_RECONNECT_DELAY_MS = 30_000;
const BASE_RECONNECT_DELAY_MS = 1_000;

export type FyersWsStatus = "disconnected" | "connecting" | "connected" | "reconnecting";

export interface FyersWsEvent {
  type: "quote" | "status" | "error";
  data: LiveQuote | FyersWsStatus | string;
  timestamp: string;
}

type Listener = (event: FyersWsEvent) => void;

class FyersDataSocket {
  private ws: WebSocket | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectDelay = BASE_RECONNECT_DELAY_MS;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private subscribedSymbols: Set<string> = new Set();
  private listeners: Set<Listener> = new Set();
  private _status: FyersWsStatus = "disconnected";
  private destroyed = false;

  get status(): FyersWsStatus {
    return this._status;
  }

  on(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: FyersWsEvent) {
    for (const l of this.listeners) {
      try { l(event); } catch { /* listener errors swallowed */ }
    }
  }

  private setStatus(s: FyersWsStatus) {
    this._status = s;
    this.emit({ type: "status", data: s, timestamp: new Date().toISOString() });
  }

  connect() {
    if (this.destroyed) return;
    if (this.ws?.readyState === WebSocket.OPEN) return;

    if (!env.FYERS_APP_ID || !env.FYERS_ACCESS_TOKEN) {
      this.emit({ type: "error", data: "FYERS credentials not configured", timestamp: new Date().toISOString() });
      return;
    }

    this.setStatus(this.subscribedSymbols.size > 0 ? "reconnecting" : "connecting");

    const token = `${env.FYERS_APP_ID}:${env.FYERS_ACCESS_TOKEN}`;
    this.ws = new WebSocket(WS_URL, { headers: { Authorization: token } });

    this.ws.on("open", () => {
      this.reconnectDelay = BASE_RECONNECT_DELAY_MS;
      this.setStatus("connected");
      this.startPing();
      // Re-subscribe to all previously subscribed symbols.
      if (this.subscribedSymbols.size > 0) {
        this.sendSubscribe([...this.subscribedSymbols]);
      }
    });

    this.ws.on("message", (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString());
        this.handleMessage(msg);
      } catch { /* ignore malformed messages */ }
    });

    this.ws.on("close", () => {
      this.stopPing();
      if (!this.destroyed) this.scheduleReconnect();
      else this.setStatus("disconnected");
    });

    this.ws.on("error", (err: Error) => {
      this.emit({ type: "error", data: err.message, timestamp: new Date().toISOString() });
    });
  }

  private handleMessage(msg: any) {
    // FYERS WS message types: "cn" (connected), "sub" (subscribed), "sf" (stock feed), "if" (index feed)
    if (!msg) return;

    const type = msg.type || msg.t;
    if (type === "sf" || type === "if") {
      // Equity or index feed — extract quote data.
      const symbol = msg.symbol || msg.symp || "";
      const v = msg.v || msg;
      if (symbol && typeof v.lp === "number") {
        const price = v.lp;
        const prevClose = v.prev_close_price ?? 0;
        const change = v.ch ?? (prevClose ? price - prevClose : 0);
        const changePct = v.chp ?? (prevClose ? (change / prevClose) * 100 : 0);
        const quote: LiveQuote = {
          symbol,
          name: toAppFromFyers(symbol),
          exchange: symbol.startsWith("NSE:") ? "NSE" : "BSE",
          currency: "INR",
          price,
          prevClose,
          change,
          changePct,
          open: v.open_price ?? null,
          dayHigh: v.high_price ?? null,
          dayLow: v.low_price ?? null,
          volume: v.volume ?? null,
          week52High: null,
          week52Low: null,
          marketTime: v.tt ? new Date(v.tt * 1000).toISOString() : new Date().toISOString(),
        };
        this.emit({ type: "quote", data: quote, timestamp: new Date().toISOString() });
      }
    }
  }

  subscribe(symbols: string[]) {
    for (const s of symbols) this.subscribedSymbols.add(s);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendSubscribe(symbols);
    }
  }

  unsubscribe(symbols: string[]) {
    for (const s of symbols) this.subscribedSymbols.delete(s);
    if (this.ws?.readyState === WebSocket.OPEN && symbols.length) {
      this.sendUnsubscribe(symbols);
    }
  }

  private sendSubscribe(symbols: string[]) {
    this.ws?.send(JSON.stringify({ s: "SUB", t: "SymbolUpdate", l: false, k: symbols }));
  }

  private sendUnsubscribe(symbols: string[]) {
    this.ws?.send(JSON.stringify({ s: "UNSUB", t: "SymbolUpdate", k: symbols }));
  }

  private startPing() {
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send("ping");
      }
    }, PING_INTERVAL_MS);
  }

  private stopPing() {
    if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null; }
  }

  private scheduleReconnect() {
    this.setStatus("reconnecting");
    this.reconnectTimer = setTimeout(() => {
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
      this.connect();
    }, this.reconnectDelay);
  }

  disconnect() {
    this.destroyed = true;
    this.stopPing();
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    this.subscribedSymbols.clear();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setStatus("disconnected");
  }
}

// Singleton instance.
export const fyersSocket = new FyersDataSocket();
