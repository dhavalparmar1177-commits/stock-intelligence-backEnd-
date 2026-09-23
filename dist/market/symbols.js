"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MOVERS_UNIVERSE = exports.INDICES = exports.APP_SYMBOLS = void 0;
exports.toYahoo = toYahoo;
exports.toApp = toApp;
exports.APP_SYMBOLS = [
    { app: "RELIANCE", yahoo: "RELIANCE.NS", name: "Reliance Industries Ltd", exchange: "NSE", currency: "INR" },
    { app: "TCS", yahoo: "TCS.NS", name: "Tata Consultancy Services", exchange: "NSE", currency: "INR" },
    { app: "HDFCBANK", yahoo: "HDFCBANK.NS", name: "HDFC Bank Ltd", exchange: "NSE", currency: "INR" },
    { app: "INFY", yahoo: "INFY.NS", name: "Infosys Ltd", exchange: "NSE", currency: "INR" },
    { app: "TATAMOTORS", yahoo: "TATAMOTORS.NS", name: "Tata Motors Ltd", exchange: "NSE", currency: "INR" },
    { app: "SBIN", yahoo: "SBIN.NS", name: "State Bank of India", exchange: "NSE", currency: "INR" },
    { app: "ITC", yahoo: "ITC.NS", name: "ITC Ltd", exchange: "NSE", currency: "INR" },
    { app: "AAPL", yahoo: "AAPL", name: "Apple Inc", exchange: "NASDAQ", currency: "USD" },
    { app: "MSFT", yahoo: "MSFT", name: "Microsoft Corp", exchange: "NASDAQ", currency: "USD" },
    { app: "NVDA", yahoo: "NVDA", name: "NVIDIA Corp", exchange: "NASDAQ", currency: "USD" },
];
exports.INDICES = [
    { app: "NIFTY50", yahoo: "^NSEI", name: "NIFTY 50" },
    { app: "SENSEX", yahoo: "^BSESN", name: "SENSEX" },
];
// Real-quote universe for gainers/losers/most-active (each entry fetched live).
// Kept intentionally small to respect public rate limits.
exports.MOVERS_UNIVERSE = [
    ...exports.APP_SYMBOLS,
    { app: "HDFCLIFE", yahoo: "HDFCLIFE.NS", name: "HDFC Life Insurance", exchange: "NSE", currency: "INR" },
    { app: "ICICIBANK", yahoo: "ICICIBANK.NS", name: "ICICI Bank Ltd", exchange: "NSE", currency: "INR" },
    { app: "SBILIFE", yahoo: "SBILIFE.NS", name: "SBI Life Insurance", exchange: "NSE", currency: "INR" },
    { app: "TITAN", yahoo: "TITAN.NS", name: "Titan Company Ltd", exchange: "NSE", currency: "INR" },
    { app: "LT", yahoo: "LT.NS", name: "Larsen & Toubro Ltd", exchange: "NSE", currency: "INR" },
    { app: "AXISBANK", yahoo: "AXISBANK.NS", name: "Axis Bank Ltd", exchange: "NSE", currency: "INR" },
    { app: "KOTAKBANK", yahoo: "KOTAKBANK.NS", name: "Kotak Mahindra Bank", exchange: "NSE", currency: "INR" },
    { app: "BHARTIARTL", yahoo: "BHARTIARTL.NS", name: "Bharti Airtel Ltd", exchange: "NSE", currency: "INR" },
];
function toYahoo(appSymbol) {
    const s = appSymbol.toUpperCase();
    const known = [...exports.APP_SYMBOLS, ...exports.MOVERS_UNIVERSE].find((x) => x.app === s);
    if (known)
        return known.yahoo;
    // Pass through: allow raw Yahoo tickers (e.g. RELIANCE.NS, ^NSEI) for search results.
    return s;
}
function toApp(yahooSymbol) {
    const known = [...exports.APP_SYMBOLS, ...exports.MOVERS_UNIVERSE].find((x) => x.yahoo === yahooSymbol.toUpperCase());
    return known ? known.app : yahooSymbol.toUpperCase();
}
