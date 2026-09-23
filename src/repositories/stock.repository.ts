import { prisma } from "../config/db";
const include = { company: true, exchange: true, quotes: { take: 1, orderBy: { updatedAt: "desc" } as any }, fundamental: true, score: true } as any;
export const stockRepo = {
  search: (q: string) => prisma.stock.findMany({
    where: { OR: [{ symbol: { contains: q, mode: "insensitive" } }, { company: { name: { contains: q, mode: "insensitive" } } }, { exchange: { code: { contains: q, mode: "insensitive" } } }] },
    include: { company: true, exchange: true, quotes: { take: 1, orderBy: { updatedAt: "desc" } as any } }, take: 20,
  }),
  bySymbol: (symbol: string) => prisma.stock.findUnique({ where: { symbol: symbol.toUpperCase() }, include: { company: true, exchange: true, quotes: { take: 1, orderBy: { updatedAt: "desc" } as any }, fundamental: true, score: true } }),
  byIds: (symbols: string[]) => prisma.stock.findMany({ where: { symbol: { in: symbols.map(s => s.toUpperCase()) } }, include }),
  history: (stockId: string, limit = 180) => prisma.historicalPrice.findMany({ where: { stockId }, orderBy: { date: "asc" }, take: limit }),
  statements: (stockId: string) => prisma.financialStatement.findMany({ where: { stockId }, orderBy: { year: "desc" } }),
  news: (stockId: string, limit = 10) => prisma.news.findMany({ where: { stockId }, orderBy: { publishedAt: "desc" }, take: limit }),
  screener: (f: any) => prisma.stock.findMany({
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
  topMovers: () => prisma.quote.findMany({ orderBy: { changePct: "desc" }, take: 100, include: { stock: { include: { company: true } } } }),
  allQuotes: () => prisma.quote.findMany({ include: { stock: { include: { company: true, exchange: true } } } }),
  marketNews: (limit = 10) => prisma.news.findMany({ orderBy: { publishedAt: "desc" }, take: limit, include: { stock: { include: { company: true } } } }),
};
