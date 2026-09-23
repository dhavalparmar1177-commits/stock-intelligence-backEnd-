// Canonical app symbols <-> real provider tickers.
// Yahoo: NSE -> ".NS" suffix, BSE -> ".BO", US listings trade as-is.
// FYERS: NSE -> "NSE:SYMBOL", BSE -> "BSE:SYMBOL", indices -> "NSE:NIFTY 50"
export interface AppSymbol {
  app: string; // symbol used in our API/UI
  yahoo: string; // ticker on Yahoo Finance
  fyers: string; // ticker on FYERS (NSE:BSE exchange prefix format)
  name: string;
  exchange: string; // NSE | BSE | NASDAQ
  currency: string; // INR | USD
}

export const APP_SYMBOLS: AppSymbol[] = [
  { app: "RELIANCE", yahoo: "RELIANCE.NS", fyers: "NSE:RELIANCE-EQ", name: "Reliance Industries Ltd", exchange: "NSE", currency: "INR" },
  { app: "TCS", yahoo: "TCS.NS", fyers: "NSE:TCS-EQ", name: "Tata Consultancy Services", exchange: "NSE", currency: "INR" },
  { app: "HDFCBANK", yahoo: "HDFCBANK.NS", fyers: "NSE:HDFCBANK-EQ", name: "HDFC Bank Ltd", exchange: "NSE", currency: "INR" },
  { app: "INFY", yahoo: "INFY.NS", fyers: "NSE:INFY-EQ", name: "Infosys Ltd", exchange: "NSE", currency: "INR" },
  { app: "TATAMOTORS", yahoo: "TATAMOTORS.NS", fyers: "NSE:TATAMOTORS-EQ", name: "Tata Motors Ltd", exchange: "NSE", currency: "INR" },
  { app: "SBIN", yahoo: "SBIN.NS", fyers: "NSE:SBIN-EQ", name: "State Bank of India", exchange: "NSE", currency: "INR" },
  { app: "ITC", yahoo: "ITC.NS", fyers: "NSE:ITC-EQ", name: "ITC Ltd", exchange: "NSE", currency: "INR" },
  { app: "AAPL", yahoo: "AAPL", fyers: "NASDAQ:AAPL", name: "Apple Inc", exchange: "NASDAQ", currency: "USD" },
  { app: "MSFT", yahoo: "MSFT", fyers: "NASDAQ:MSFT", name: "Microsoft Corp", exchange: "NASDAQ", currency: "USD" },
  { app: "NVDA", yahoo: "NVDA", fyers: "NASDAQ:NVDA", name: "NVIDIA Corp", exchange: "NASDAQ", currency: "USD" },
];

export const INDICES = [
  { app: "NIFTY50", yahoo: "^NSEI", fyers: "NSE:NIFTY50-INDEX", name: "NIFTY 50" },
  { app: "SENSEX", yahoo: "^BSESN", fyers: "BSE:SENSEX-INDEX", name: "SENSEX" },
];

// Real-quote universe for gainers/losers/most-active (each entry fetched live).
// Kept intentionally small to respect public rate limits.
export const MOVERS_UNIVERSE: AppSymbol[] = [
  ...APP_SYMBOLS,
  { app: "HDFCLIFE", yahoo: "HDFCLIFE.NS", fyers: "NSE:HDFCLIFE-EQ", name: "HDFC Life Insurance", exchange: "NSE", currency: "INR" },
  { app: "ICICIBANK", yahoo: "ICICIBANK.NS", fyers: "NSE:ICICIBANK-EQ", name: "ICICI Bank Ltd", exchange: "NSE", currency: "INR" },
  { app: "SBILIFE", yahoo: "SBILIFE.NS", fyers: "NSE:SBILIFE-EQ", name: "SBI Life Insurance", exchange: "NSE", currency: "INR" },
  { app: "TITAN", yahoo: "TITAN.NS", fyers: "NSE:TITAN-EQ", name: "Titan Company Ltd", exchange: "NSE", currency: "INR" },
  { app: "LT", yahoo: "LT.NS", fyers: "NSE:LT-EQ", name: "Larsen & Toubro Ltd", exchange: "NSE", currency: "INR" },
  { app: "AXISBANK", yahoo: "AXISBANK.NS", fyers: "NSE:AXISBANK-EQ", name: "Axis Bank Ltd", exchange: "NSE", currency: "INR" },
  { app: "KOTAKBANK", yahoo: "KOTAKBANK.NS", fyers: "NSE:KOTAKBANK-EQ", name: "Kotak Mahindra Bank", exchange: "NSE", currency: "INR" },
  { app: "BHARTIARTL", yahoo: "BHARTIARTL.NS", fyers: "NSE:BHARTIARTL-EQ", name: "Bharti Airtel Ltd", exchange: "NSE", currency: "INR" },
];

export function toYahoo(appSymbol: string): string {
  const s = appSymbol.toUpperCase();
  const known = [...APP_SYMBOLS, ...MOVERS_UNIVERSE].find((x) => x.app === s);
  if (known) return known.yahoo;
  // Pass through: allow raw Yahoo tickers (e.g. RELIANCE.NS, ^NSEI) for search results.
  return s;
}

export function toFyers(appSymbol: string): string {
  const s = appSymbol.toUpperCase();
  const known = [...APP_SYMBOLS, ...MOVERS_UNIVERSE].find((x) => x.app === s);
  if (known) return known.fyers;
  // Pass through if already in provider format (e.g. "NSE:TCS-EQ")
  if (appSymbol.includes(":")) return appSymbol;
  // Default: assume NSE equity
  return `NSE:${s}-EQ`;
}

export function toApp(yahooSymbol: string): string {
  const known = [...APP_SYMBOLS, ...MOVERS_UNIVERSE].find((x) => x.yahoo === yahooSymbol.toUpperCase());
  return known ? known.app : yahooSymbol.toUpperCase();
}

export function toAppFromFyers(fyersSymbol: string): string {
  const known = [...APP_SYMBOLS, ...MOVERS_UNIVERSE].find((x) => x.fyers === fyersSymbol.toUpperCase());
  if (known) return known.app;
  // Strip exchange prefix and -EQ suffix: "NSE:SBIN-EQ" -> "SBIN"
  const raw = fyersSymbol.split(":").pop()?.toUpperCase() || fyersSymbol.toUpperCase();
  return raw.replace(/-EQ$/, "").replace(/-INDEX$/, "");
}

// Provider-aware: get the native ticker from an AppSymbol object.
export function providerTicker(sym: AppSymbol, provider?: string): string {
  const p = provider || (typeof process !== "undefined" ? process.env?.MARKET_DATA_PROVIDER : "") || "yahoo";
  return p === "fyers" ? sym.fyers : sym.yahoo;
}

// Convert any Yahoo ticker to the equivalent FYERS ticker.
// "RELIANCE.NS" -> "NSE:RELIANCE-EQ", "^NSEI" -> "NSE:NIFTY50-INDEX", "^BSESN" -> "BSE:SENSEX-INDEX"
// For tickers not in the symbol table, constructs the FYERS format automatically.
export function yahooToFyers(yahooTicker: string): string {
  const known = [...APP_SYMBOLS, ...MOVERS_UNIVERSE].find((x) => x.yahoo === yahooTicker.toUpperCase());
  if (known) return known.fyers;
  // Index tickers
  if (yahooTicker === "^NSEI") return "NSE:NIFTY50-INDEX";
  if (yahooTicker === "^BSESN") return "BSE:SENSEX-INDEX";
  // Sector index tickers (e.g. "^CNXIT" -> "NSE:CNXIT-INDEX")
  if (yahooTicker.startsWith("^CNX")) return `NSE:${yahooTicker.slice(1)}-INDEX`;
  if (yahooTicker === "^NSEBANK") return "NSE:NIFTYBANK-INDEX";
  // .NS -> NSE equity
  if (yahooTicker.endsWith(".NS")) return `NSE:${yahooTicker.replace(/\.NS$/i, "")}-EQ`;
  // .BO -> BSE equity
  if (yahooTicker.endsWith(".BO")) return `BSE:${yahooTicker.replace(/\.BO$/i, "")}-A`;
  // Default: assume NSE equity
  return `NSE:${yahooTicker}-EQ`;
}

// Convert any FYERS ticker back to Yahoo format.
export function fyersToYahoo(fyersTicker: string): string {
  const known = [...APP_SYMBOLS, ...MOVERS_UNIVERSE].find((x) => x.fyers === fyersTicker.toUpperCase());
  if (known) return known.yahoo;
  // Reverse the yahooToFyers conversions
  if (fyersTicker === "NSE:NIFTY50-INDEX") return "^NSEI";
  if (fyersTicker === "BSE:SENSEX-INDEX") return "^BSESN";
  if (fyersTicker === "NSE:NIFTYBANK-INDEX") return "^NSEBANK";
  if (fyersTicker.endsWith("-INDEX")) return `^${fyersTicker.split(":").pop()?.replace(/-INDEX$/, "")}`;
  if (fyersTicker.startsWith("NSE:")) return `${fyersTicker.split(":")[1]?.replace(/-EQ$/, "")}.NS`;
  if (fyersTicker.startsWith("BSE:")) return `${fyersTicker.split(":")[1]?.replace(/-A$/, "")}.BO`;
  return fyersTicker.split(":").pop() || fyersTicker;
}
