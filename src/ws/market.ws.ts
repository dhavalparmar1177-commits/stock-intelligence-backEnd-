// Backend WebSocket server — bridges FYERS data socket to frontend clients.
// Frontend connects to ws://localhost:4001, sends subscribe/unsubscribe commands.
// Server forwards real-time quotes as JSON: { type: "quote", data: {...}, timestamp: "..." }

import { WebSocketServer, WebSocket } from "ws";
import { env } from "../config/env";
import { getProvider } from "../market/provider.factory";
import { fyersSocket, type FyersWsEvent } from "../market/fyers.ws";
import type { LiveQuote } from "../market/types";

interface ClientState {
  symbols: Set<string>;
  alive: boolean;
}

export function startMarketWs() {
  const wss = new WebSocketServer({ port: env.WS_PORT });
  const clients = new Map<WebSocket, ClientState>();

  console.log(`[WS] Market data server on :${env.WS_PORT}`);

  // Forward FYERS socket events to all subscribed clients.
  fyersSocket.on((event: FyersWsEvent) => {
    if (event.type !== "quote") return;
    const quote = event.data as LiveQuote;
    const msg = JSON.stringify({ type: "quote", data: quote, timestamp: event.timestamp });
    for (const [ws, state] of clients) {
      if (ws.readyState === WebSocket.OPEN && state.symbols.has(quote.symbol)) {
        ws.send(msg);
      }
    }
  });

  wss.on("connection", (ws: WebSocket) => {
    const state: ClientState = { symbols: new Set(), alive: true };
    clients.set(ws, state);

    // Send connection status.
    ws.send(JSON.stringify({
      type: "status",
      data: fyersSocket.status,
      provider: getProvider().name,
      timestamp: new Date().toISOString(),
    }));

    // Heartbeat — detect dead clients.
    ws.on("pong", () => { state.alive = true; });

    ws.on("message", (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString());
        handleClientMessage(ws, state, msg);
      } catch {
        ws.send(JSON.stringify({ type: "error", data: "Invalid JSON" }));
      }
    });

    ws.on("close", () => {
      clients.delete(ws);
      // If no more clients, optionally disconnect from FYERS.
      if (clients.size === 0) {
        fyersSocket.disconnect();
      }
    });

    ws.on("error", () => {
      clients.delete(ws);
    });
  });

  // Heartbeat interval — ping clients and prune dead ones.
  const heartbeat = setInterval(() => {
    for (const [ws, state] of clients) {
      if (!state.alive) {
        ws.terminate();
        clients.delete(ws);
        continue;
      }
      state.alive = false;
      ws.ping();
    }
  }, 30_000);

  wss.on("close", () => clearInterval(heartbeat));

  // Auto-connect FYERS socket when first client subscribes.
  function ensureFyersConnected() {
    if (getProvider().name === "fyers" && fyersSocket.status === "disconnected") {
      fyersSocket.connect();
    }
  }

  function handleClientMessage(ws: WebSocket, state: ClientState, msg: any) {
    switch (msg.action) {
      case "subscribe": {
        const symbols: string[] = Array.isArray(msg.symbols) ? msg.symbols : [];
        if (!symbols.length) return;
        for (const s of symbols) state.symbols.add(s);
        ensureFyersConnected();
        fyersSocket.subscribe(symbols);
        ws.send(JSON.stringify({
          type: "subscribed",
          symbols: [...state.symbols],
          timestamp: new Date().toISOString(),
        }));
        break;
      }
      case "unsubscribe": {
        const symbols: string[] = Array.isArray(msg.symbols) ? msg.symbols : [];
        for (const s of symbols) state.symbols.delete(s);
        fyersSocket.unsubscribe(symbols);
        ws.send(JSON.stringify({
          type: "unsubscribed",
          symbols: [...state.symbols],
          timestamp: new Date().toISOString(),
        }));
        break;
      }
      case "ping": {
        ws.send(JSON.stringify({
          type: "pong",
          provider: getProvider().name,
          providerStatus: fyersSocket.status,
          timestamp: new Date().toISOString(),
        }));
        break;
      }
      default:
        ws.send(JSON.stringify({ type: "error", data: `Unknown action: ${msg.action}` }));
    }
  }

  return wss;
}
