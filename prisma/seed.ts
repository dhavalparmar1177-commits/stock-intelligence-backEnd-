import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// Deterministic pseudo-random generator so demo data is stable
function rng(seed: number) { let s = seed; return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }; }

const STOCKS = [
  { symbol: "RELIANCE", name: "Reliance Industries Ltd", sector: "Energy", industry: "Oil & Gas", exchange: "NSE", price: 2985.5, pe: 28.4, pb: 2.1, eps: 105.1, roe: 9.2, roce: 11.5, de: 0.35, div: 0.6, rev: 900000, profit: 69000, revG: 12.4, profG: 8.1, rsi: 58 },
  { symbol: "TCS", name: "Tata Consultancy Services", sector: "Technology", industry: "IT Services", exchange: "NSE", price: 4120.0, pe: 30.2, pb: 12.4, eps: 136.4, roe: 46.0, roce: 55.0, de: 0.05, div: 2.1, rev: 240000, profit: 46000, revG: 9.6, profG: 10.2, rsi: 62 },
  { symbol: "HDFCBANK", name: "HDFC Bank Ltd", sector: "Financials", industry: "Banking", exchange: "NSE", price: 1640.2, pe: 19.8, pb: 2.8, eps: 82.8, roe: 17.5, roce: 12.0, de: 0.9, div: 1.2, rev: 210000, profit: 60000, revG: 15.2, profG: 18.4, rsi: 55 },
  { symbol: "INFY", name: "Infosys Ltd", sector: "Technology", industry: "IT Services", exchange: "NSE", price: 1835.75, pe: 26.5, pb: 7.2, eps: 69.2, roe: 29.0, roce: 35.0, de: 0.02, div: 2.8, rev: 153000, profit: 26000, revG: 7.8, profG: 6.5, rsi: 48 },
  { symbol: "TATAMOTORS", name: "Tata Motors Ltd", sector: "Auto", industry: "Automobiles", exchange: "NSE", price: 965.3, pe: 22.0, pb: 4.1, eps: 43.9, roe: 22.0, roce: 18.0, de: 0.6, div: 0.5, rev: 443000, profit: 31000, revG: 22.0, profG: 45.0, rsi: 74 },
  { symbol: "SBIN", name: "State Bank of India", sector: "Financials", industry: "Banking", exchange: "NSE", price: 812.6, pe: 11.5, pb: 1.6, eps: 70.6, roe: 16.0, roce: 8.0, de: 1.2, div: 1.7, rev: 420000, profit: 68000, revG: 11.0, profG: 25.0, rsi: 44 },
  { symbol: "ITC", name: "ITC Ltd", sector: "FMCG", industry: "Consumer Goods", exchange: "NSE", price: 495.8, pe: 27.0, pb: 6.5, eps: 18.3, roe: 28.0, roce: 34.0, de: 0.0, div: 2.9, rev: 70000, profit: 24000, revG: 6.2, profG: 9.0, rsi: 52 },
];

function scoreOf(s: any) {
  const valuation = Math.max(0, Math.min(100, 100 - (s.pe / 60) * 100 * 0.7 - s.de * 10));
  const growth = Math.max(0, Math.min(100, 50 + s.revG * 1.5 + s.profG * 0.5));
  const profitability = Math.max(0, Math.min(100, s.roe * 1.8));
  const strength = Math.max(0, Math.min(100, 100 - s.de * 40 + (s.div || 0) * 5));
  const technical = s.rsi > 70 ? 45 : s.rsi < 30 ? 75 : 65;
  const total = (valuation + growth + profitability + strength + technical) / 5;
  return { valuation, growth, profitability, strength, technical, total };
}

async function main() {
  console.log("Seeding DEMO DATA (NSE only)...");
  await prisma.aiAnalysis.deleteMany();
  await prisma.stockScore.deleteMany(); await prisma.news.deleteMany();
  await prisma.financialStatement.deleteMany(); await prisma.historicalPrice.deleteMany();
  await prisma.quote.deleteMany(); await prisma.fundamental.deleteMany();
  await prisma.stock.deleteMany(); await prisma.company.deleteMany(); await prisma.exchange.deleteMany();

  const exNSE = await prisma.exchange.create({ data: { code: "NSE", name: "National Stock Exchange of India" } });
  const exMap: any = { NSE: exNSE.id };

  for (let i = 0; i < STOCKS.length; i++) {
    const s = STOCKS[i];
    const company = await prisma.company.create({ data: { name: s.name, sector: s.sector, industry: s.industry, description: `${s.name} — DEMO DATA company profile for local development.`, website: "https://example.com" } });
    const stock = await prisma.stock.create({ data: { symbol: s.symbol, companyId: company.id, exchangeId: exMap[s.exchange] } });
    const rand = rng(i * 999 + 7);
    const chg = (rand() - 0.45) * 4;
    const changePct = (chg / 100) * 100;
    const price = s.price, change = (price * changePct) / 100;
    const mc = price * (100 + i * 37) * 1e7;
    await prisma.quote.create({ data: { stockId: stock.id, price, change, changePct, volume: BigInt(Math.floor(1e6 + rand() * 9e6)), marketCap: mc, dayHigh: price * 1.015, dayLow: price * 0.985, week52High: price * 1.25, week52Low: price * 0.72 } });
    await prisma.fundamental.create({ data: { stockId: stock.id, pe: s.pe, pb: s.pb, eps: s.eps, roe: s.roe, roce: s.roce, debtEquity: s.de, dividendYield: s.div, revenue: s.rev, profit: s.profit, revenueGrowth: s.revG, profitGrowth: s.profG, rsi: s.rsi, sma50: price * 0.98, sma200: price * 0.92 } });
    // 180 days history
    let p = price * 0.8;
    const rows = [];
    for (let d = 180; d >= 0; d--) {
      const drift = (rand() - 0.47) * price * 0.02;
      const close = Math.max(1, p + drift + (price - p) * 0.01);
      const open = p, high = Math.max(open, close) * 1.005, low = Math.min(open, close) * 0.995;
      rows.push({ stockId: stock.id, date: new Date(Date.now() - d * 864e5), open, high, low, close, volume: BigInt(Math.floor(5e5 + rand() * 3e6)) });
      p = close;
    }
    // chunk insert
    for (let k = 0; k < rows.length; k += 30) await prisma.historicalPrice.createMany({ data: rows.slice(k, k + 30), skipDuplicates: true });
    for (let y = 0; y < 3; y++) {
      const yr = 2022 + y;
      await prisma.financialStatement.create({ data: { stockId: stock.id, year: yr, revenue: s.rev * (0.8 + y * 0.1), profit: s.profit * (0.75 + y * 0.12), eps: s.eps * (0.8 + y * 0.1), assets: s.rev * 1.5, debt: s.rev * s.de * 0.5, equity: s.rev * 0.8 } });
    }
    const sc = scoreOf(s);
    await prisma.stockScore.create({ data: { stockId: stock.id, total: sc.total, valuation: sc.valuation, growth: Math.min(100, sc.growth), profitability: Math.min(100, sc.profitability), strength: sc.strength, technical: sc.technical, explanation: `Valuation ${sc.valuation.toFixed(0)} (P/E ${s.pe}, D/E ${s.de}); Growth ${Math.min(100, sc.growth).toFixed(0)} (rev ${s.revG}%, profit ${s.profG}%); Profitability ${Math.min(100, sc.profitability).toFixed(0)} (ROE ${s.roe}%); Strength ${sc.strength.toFixed(0)}; Technical ${sc.technical.toFixed(0)} (RSI ${s.rsi}). Rule-based DEMO score, not advice.` } });
    await prisma.news.createMany({ data: [
      { stockId: stock.id, title: `${s.name} Q3 results beat demo estimates`, summary: "DEMO DATA: revenue and profit ahead of placeholder estimates.", source: "DemoWire", publishedAt: new Date(Date.now() - 2 * 864e5) },
      { stockId: stock.id, title: `Analysts split on ${s.symbol} valuation (demo)`, summary: "DEMO DATA: placeholder commentary, not real research.", source: "DemoWire", publishedAt: new Date(Date.now() - 5 * 864e5) },
    ]});
  }
  await prisma.news.create({ data: { title: "Markets edge higher in demo session", summary: "DEMO DATA market-wide placeholder news.", source: "DemoWire" } });
  await prisma.apiSyncLog.create({ data: { provider: "demo", resource: "seed", status: "OK", message: "Seeded 7 NSE demo stocks" } });
  console.log("Seed done: 7 NSE demo stocks (no users — open app, no login required)");
}
main().finally(() => prisma.$disconnect());
