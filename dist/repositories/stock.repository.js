"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stockRepo = void 0;
const db_1 = require("../config/db");
const include = { company: true, exchange: true, quotes: { take: 1, orderBy: { updatedAt: "desc" } }, fundamental: true, score: true };
exports.stockRepo = {
    search: (q) => db_1.prisma.stock.findMany({
        where: { OR: [{ symbol: { contains: q, mode: "insensitive" } }, { company: { name: { contains: q, mode: "insensitive" } } }, { exchange: { code: { contains: q, mode: "insensitive" } } }] },
        include: { company: true, exchange: true, quotes: { take: 1, orderBy: { updatedAt: "desc" } } }, take: 20,
    }),
    bySymbol: (symbol) => db_1.prisma.stock.findUnique({ where: { symbol: symbol.toUpperCase() }, include: { company: true, exchange: true, quotes: { take: 1, orderBy: { updatedAt: "desc" } }, fundamental: true, score: true } }),
    byIds: (symbols) => db_1.prisma.stock.findMany({ where: { symbol: { in: symbols.map(s => s.toUpperCase()) } }, include }),
    history: (stockId, limit = 180) => db_1.prisma.historicalPrice.findMany({ where: { stockId }, orderBy: { date: "asc" }, take: limit }),
    statements: (stockId) => db_1.prisma.financialStatement.findMany({ where: { stockId }, orderBy: { year: "desc" } }),
    news: (stockId, limit = 10) => db_1.prisma.news.findMany({ where: { stockId }, orderBy: { publishedAt: "desc" }, take: limit }),
    screener: (f) => db_1.prisma.stock.findMany({
        where: {
            ...(f.sector ? { company: { sector: f.sector } } : {}),
            fundamental: {
                ...(f.minMarketCap !== undefined || f.maxMarketCap !== undefined ? {} : {}),
                ...(f.minPE !== undefined ? { pe: { gte: f.minPE } } : {}),
                ...(f.maxPE !== undefined ? { pe: { lte: f.maxPE } } : {}),
                ...(f.minROE !== undefined ? { roe: { gte: f.minROE } } : {}),
                ...(f.minROCE !== undefined ? { roce: { gte: f.minROCE } } : {}),
                ...(f.maxDebtEquity !== undefined ? { debtEquity: { lte: f.maxDebtEquity } } : {}),
                ...(f.minDivYield !== undefined ? { dividendYield: { gte: f.minDivYield } } : {}),
                ...(f.minRevGrowth !== undefined ? { revenueGrowth: { gte: f.minRevGrowth } } : {}),
            },
            ...(f.minMarketCap !== undefined ? { quotes: { some: { marketCap: { gte: f.minMarketCap } } } } : {}),
        },
        include, take: 50,
    }),
    topMovers: () => db_1.prisma.quote.findMany({ orderBy: { changePct: "desc" }, take: 100, include: { stock: { include: { company: true } } } }),
    allQuotes: () => db_1.prisma.quote.findMany({ include: { stock: { include: { company: true, exchange: true } } } }),
    marketNews: (limit = 10) => db_1.prisma.news.findMany({ orderBy: { publishedAt: "desc" }, take: limit, include: { stock: { include: { company: true } } } }),
};
