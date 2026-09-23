"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stockService = void 0;
const stock_repository_1 = require("../repositories/stock.repository");
const ApiError_1 = require("../utils/ApiError");
exports.stockService = {
    search: (q) => stock_repository_1.stockRepo.search(q || ""),
    async detail(symbol) {
        const s = await stock_repository_1.stockRepo.bySymbol(symbol);
        if (!s)
            throw new ApiError_1.ApiError(404, "Stock not found");
        const history = await stock_repository_1.stockRepo.history(s.id);
        const statements = await stock_repository_1.stockRepo.statements(s.id);
        const news = await stock_repository_1.stockRepo.news(s.id);
        return { ...s, history, statements, news, demo: true, dataSource: "demo-seed (not real market data)" };
    },
    async compare(symbols) {
        if (symbols.length < 2 || symbols.length > 5)
            throw new ApiError_1.ApiError(400, "Compare 2–5 stocks");
        const stocks = await stock_repository_1.stockRepo.byIds(symbols);
        if (!stocks.length)
            throw new ApiError_1.ApiError(404, "No stocks found");
        return { demo: true, stocks };
    },
    screener: (f) => stock_repository_1.stockRepo.screener(f),
    async dashboard() {
        const quotes = await stock_repository_1.stockRepo.allQuotes();
        const sorted = [...quotes].sort((a, b) => b.changePct - a.changePct);
        const gainers = sorted.slice(0, 5);
        const losers = sorted.slice(-5).reverse();
        const active = [...quotes].sort((a, b) => Number(b.volume) - Number(a.volume)).slice(0, 5);
        const news = await stock_repository_1.stockRepo.marketNews(6);
        // REAL DATA ONLY: demo DB has no real index feed. Never hardcode index
        // values (that would be fabricated market data). Mark unavailable and
        // point callers at the live endpoint /market/indices for real quotes.
        const indices = [
            { name: "NIFTY 50", unavailable: true, note: "Data unavailable in demo mode — see Live page for real index data" },
            { name: "SENSEX", unavailable: true, note: "Data unavailable in demo mode — see Live page for real index data" },
        ];
        return { demo: true, dataSource: "demo-seed (not real market data)", indices, gainers, losers, trending: gainers, mostActive: active, news };
    },
};
