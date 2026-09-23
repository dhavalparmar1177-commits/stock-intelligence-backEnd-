import { stockRepo } from "../repositories/stock.repository";
import { ApiError } from "../utils/ApiError";
export const stockService = {
  search: (q: string) => stockRepo.search(q || ""),
  async detail(symbol: string) {
    const s = await stockRepo.bySymbol(symbol);
    if (!s) throw new ApiError(404, "Stock not found");
    const history = await stockRepo.history((s as any).id);
    const statements = await stockRepo.statements((s as any).id);
    const news = await stockRepo.news((s as any).id);
    return { ...s, history, statements, news, demo: true, dataSource: "demo-seed (not real market data)" };
  },
  async compare(symbols: string[]) {
    if (symbols.length < 2 || symbols.length > 5) throw new ApiError(400, "Compare 2–5 stocks");
    const stocks = await stockRepo.byIds(symbols);
    if (!stocks.length) throw new ApiError(404, "No stocks found");
    return { demo: true, stocks };
  },
  screener: (f: any) => stockRepo.screener(f),
  async dashboard() {
    const quotes = await stockRepo.allQuotes();
    const sorted = [...quotes].sort((a: any, b: any) => b.changePct - a.changePct);
    const gainers = sorted.slice(0, 5);
    const losers = sorted.slice(-5).reverse();
    const active = [...quotes].sort((a: any, b: any) => Number(b.volume) - Number(a.volume)).slice(0, 5);
    const news = await stockRepo.marketNews(6);
    // REAL DATA ONLY: demo DB has no real index feed. Never hardcode index
    // values (that would be fabricated market data). Mark unavailable and
    // point callers at the live endpoint /market/indices for real quotes.
    const indices = [
      { name: "NIFTY 50", unavailable: true as const, note: "Data unavailable in demo mode — see Live page for real index data" },
      { name: "SENSEX", unavailable: true as const, note: "Data unavailable in demo mode — see Live page for real index data" },
    ];
    return { demo: true, dataSource: "demo-seed (not real market data)", indices, gainers, losers, trending: gainers, mostActive: active, news };
  },
};
