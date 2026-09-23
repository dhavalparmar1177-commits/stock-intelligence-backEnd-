"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.indiaAnalysisService = void 0;
const db_1 = require("../config/db");
const ApiError_1 = require("../utils/ApiError");
const indicators_1 = require("../utils/indicators");
const yahoo_provider_1 = require("./yahoo.provider");
const nse_1 = require("./nse");
const symbols_1 = require("./symbols");
const sentiment_1 = require("./sentiment");
const screenQuery_1 = require("./screenQuery");
const lang_1 = require("./lang");
const evaluation_1 = require("./evaluation");
const calendar_1 = require("./calendar");
const MIN_BARS = 60; // ~3 months of daily data required (covers SMA50/MACD/RSI/Bollinger); below this: "Insufficient data"
const FULL_BARS = 120; // below this, confidence is reduced and the gap is disclosed
const SENSEX = "^BSESN";
const NAME_KEYWORDS = {
    RELIANCE: ["RELIANCE"], TCS: ["TCS"], INFY: ["INFOSYS", "INFY"], HDFCBANK: ["HDFC BANK", "HDFC"],
    ICICIBANK: ["ICICI"], AXISBANK: ["AXIS"], KOTAKBANK: ["KOTAK"], SBIN: ["SBI", "STATE BANK"],
    TATAMOTORS: ["TATA MOTORS", "TATA"], ITC: ["ITC"], TITAN: ["TITAN"], LT: ["LARSEN", "L&T"],
    BHARTIARTL: ["BHARTI", "AIRTEL"], HDFCLIFE: ["HDFC LIFE"], SBILIFE: ["SBI LIFE"],
};
function median(xs) {
    const s = [...xs].sort((a, b) => a - b);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
// Main reason line for a screened row, in the response language.
function screenReason(preset, r, L) {
    if (preset === "momentum" && r.mom !== null)
        return L.momPos(r.mom.toFixed(1));
    if (preset === "volume" && r.volRatio !== null)
        return L.whyVol(r.volRatio.toFixed(1));
    if (preset === "oversold" && r.rsi14 !== null)
        return `RSI ${r.rsi14}`;
    if (preset === "calm")
        return `${r.volatility.toFixed(0)}% annualized volatility`;
    return r.reasons[0] ?? "";
}
// Most frequent meaningful word across headlines (for the news theme line).
// Purely extractive over real titles — never invents topics.
function topTheme(titles) {
    const stop = new Set(["the", "and", "for", "with", "from", "shares", "share", "stock", "stocks", "market", "india", "indian", "after", "over", "under", "hits", "slips", "jumps", "rises", "falls", "quarter", "profit", "loss", "says", "amid", "ahead", "more", "than", "into", "among"]);
    const counts = new Map();
    for (const t of titles) {
        for (const w of t.toLowerCase().replace(/[^a-z ]/g, " ").split(/\s+/)) {
            if (w.length > 4 && !stop.has(w))
                counts.set(w, (counts.get(w) || 0) + 1);
        }
    }
    let best = "", bestN = 1;
    for (const [w, n] of counts)
        if (n > bestN) {
            best = w;
            bestN = n;
        }
    return best;
}
async function sectorContext(appSymbol) {
    const map = nse_1.SECTOR_INDEX[appSymbol];
    if (!map || map.index === nse_1.NIFTY)
        return map ? { ...map, available: false } : null;
    try {
        const [q, bars] = await Promise.all([
            yahoo_provider_1.yahooProvider.getQuote(map.index),
            yahoo_provider_1.yahooProvider.getHistory(map.index, "1d", "6mo"),
        ]);
        const closes = bars.map((b) => b.close);
        const s50 = (0, indicators_1.sma)(closes, 50);
        const mom = closes.length > 63 ? ((closes[closes.length - 1] - closes[closes.length - 63]) / closes[closes.length - 63]) * 100 : null;
        return {
            ...map, available: true, price: q.price, changePct: q.changePct,
            aboveSMA50: s50 !== null ? q.price > s50 : null,
            momentum3mPct: mom !== null ? Number(mom.toFixed(1)) : null,
        };
    }
    catch {
        return { ...map, available: false };
    }
}
async function indexContext(ticker, label) {
    const [q, bars] = await Promise.all([
        yahoo_provider_1.yahooProvider.getQuote(ticker),
        yahoo_provider_1.yahooProvider.getHistory(ticker, "1d", "6mo"),
    ]);
    const closes = bars.map((b) => b.close);
    const s50 = (0, indicators_1.sma)(closes, 50);
    const r = (0, indicators_1.rsi)(closes, 14);
    const mom = closes.length > 63 ? ((closes[closes.length - 1] - closes[closes.length - 63]) / closes[closes.length - 63]) * 100 : null;
    const mean = closes.length > 1 ? closes.slice(1).reduce((a, c, i) => a + Math.log(c / closes[i]), 0) / (closes.length - 1) : 0;
    const sd = closes.length > 2 ? Math.sqrt(closes.slice(1).reduce((a, c, i) => a + Math.pow(Math.log(c / closes[i]) - mean, 2), 0) / (closes.length - 2)) : 0;
    return {
        symbol: label, price: q.price, changePct: q.changePct, marketTime: q.marketTime,
        rsi14: r !== null ? Number(r.toFixed(1)) : null,
        aboveSMA50: s50 !== null ? q.price > s50 : null,
        momentum3mPct: mom !== null ? Number(mom.toFixed(1)) : null,
        volatilityAnnPct: Number((sd * Math.sqrt(252) * 100).toFixed(1)),
    };
}
async function breadth() {
    const nse = symbols_1.MOVERS_UNIVERSE.filter((s) => s.exchange === "NSE");
    const quotes = await yahoo_provider_1.yahooProvider.getQuotes(nse.map((s) => s.yahoo));
    let adv = 0, dec = 0;
    for (const q of quotes) {
        if (q.changePct > 0)
            adv++;
        else if (q.changePct < 0)
            dec++;
    }
    return { tracked: quotes.length, advancers: adv, decliners: dec };
}
async function companyNews(appSymbol, name) {
    const keys = NAME_KEYWORDS[appSymbol] || [name.split(" ")[0].toUpperCase()].filter((w) => w.length > 2);
    // Raw search endpoint (the typed helper strips news); filter to company-specific items only.
    const res = await fetch(`https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(appSymbol + ".NS")}`, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) StockIntel/1.0" },
    });
    if (!res.ok)
        return [];
    const j = await res.json().catch(() => ({}));
    const items = Array.isArray(j?.news) ? j.news : [];
    return items
        .filter((n) => n?.title && keys.some((k) => `${n.title} ${n.summary || ""}`.toUpperCase().includes(k)))
        .slice(0, 5)
        .map((n) => ({ title: n.title, publisher: n.publisher || null, url: n.link || null, publishedAt: n.providerPublishTime ? new Date(n.providerPublishTime * 1000).toISOString() : null }));
}
// Transparent category weights (sum 100). A category with no real data is
// EXCLUDED and the overall score is renormalized over available weights —
// the excluded weight is always disclosed, never silently filled.
const WEIGHTS = { technical: 30, momentum: 15, volume: 10, sentiment: 10, sector: 10, market: 15, fundamentals: 10 };
exports.indiaAnalysisService = {
    async analyze(input, lang = "en") {
        const L = lang_1.STR[lang] ?? lang_1.STR.en;
        const ref = (0, nse_1.resolveIndian)(input); // throws 400 for non-NSE/BSE
        const [quote, bars, nifty, sector, adv] = await Promise.all([
            yahoo_provider_1.yahooProvider.getQuote(ref.yahoo),
            yahoo_provider_1.yahooProvider.getHistory(ref.yahoo, "1d", "1y"),
            indexContext(nse_1.NIFTY, "NIFTY50").catch(() => null),
            sectorContext(ref.appSymbol).catch(() => null),
            breadth().catch(() => null),
        ]);
        const news = await companyNews(ref.appSymbol, ref.name).catch(() => []);
        const closes = bars.map((b) => b.close);
        if (closes.length < MIN_BARS) {
            throw new ApiError_1.ApiError(503, L.insufficient(ref.appSymbol, closes.length, MIN_BARS));
        }
        const limitedHistory = closes.length < FULL_BARS;
        const price = quote.price;
        const rsi14 = (0, indicators_1.rsi)(closes, 14);
        const m = (0, indicators_1.macd)(closes);
        const sma20 = (0, indicators_1.sma)(closes, 20), sma50 = (0, indicators_1.sma)(closes, 50), sma200 = (0, indicators_1.sma)(closes, Math.min(200, closes.length));
        const ema20 = (0, indicators_1.ema)(closes, 20);
        const bb = (0, indicators_1.bollinger)(closes, 20, 2);
        const atr14 = (0, indicators_1.atr)(bars, 14);
        const mom3m = closes.length > 63 ? ((price - closes[closes.length - 63]) / closes[closes.length - 63]) * 100 : null;
        const vol = (0, indicators_1.volumeStats)(bars.map((b) => b.volume), 20);
        const senti = (0, sentiment_1.scoreSentiment)(news.map((n) => n.title));
        const logRets = [];
        for (let i = 1; i < closes.length; i++)
            logRets.push(Math.log(closes[i] / closes[i - 1]));
        const mu = Math.max(-0.004, Math.min(0.004, median(logRets)));
        const mean = logRets.reduce((a, b) => a + b, 0) / logRets.length;
        const sigma = Math.sqrt(logRets.reduce((a, r) => a + (r - mean) * (r - mean), 0) / logRets.length);
        if (!(sigma > 0))
            throw new ApiError_1.ApiError(503, L.noVolatility(ref.appSymbol));
        const volAnn = sigma * Math.sqrt(252) * 100;
        // ---------- transparent category scoring ----------
        const reasons = [], risks = [];
        const cats = [];
        // Technical (30): SMA structure 12 + RSI 8 + MACD 7 + Bollinger 3
        let tech = 0;
        const smaUp = sma50 !== null && price > sma50;
        const golden = sma50 !== null && sma200 !== null && sma50 > sma200;
        if (sma50 !== null && sma200 !== null) {
            const z = L.smaZone(smaUp, golden);
            if (z === "up") {
                tech += 12;
                reasons.push(L.priceAboveSMA(f2(price), f2(sma50)));
            }
            else if (z === "mixed") {
                tech += 6;
                reasons.push(L.smaMixed());
                if (!smaUp)
                    risks.push(L.priceBelowSMA(f2(price), f2(sma50)));
                else
                    risks.push(L.smaWeak());
            }
            else {
                risks.push(L.priceBelowSMA(f2(price), f2(sma50)));
                risks.push(L.smaWeak());
            }
        }
        if (rsi14 !== null) {
            const z = L.rsiZone(rsi14), v = rsi14.toFixed(1);
            if (z === "healthy") {
                tech += 8;
                reasons.push(L.rsiHealthy(v));
            }
            else if (z === "overbought") {
                tech += 3;
                risks.push(L.rsiOverbought(v));
            }
            else if (z === "neutral") {
                tech += 5;
                reasons.push(L.rsiNeutral(v));
            }
            else {
                tech += 2;
                risks.push(L.rsiWeak(v));
            }
        }
        if (m) {
            if (m.hist > 0) {
                tech += 7;
                reasons.push(L.macdPos(f2(m.dif), f2(m.signal)));
            }
            else
                risks.push(L.macdNeg(f2(m.dif), f2(m.signal)));
        }
        if (bb) {
            if (bb.pctB >= 0.2 && bb.pctB <= 0.8) {
                tech += 3;
                reasons.push(L.bbInside(bb.pctB.toFixed(2)));
            }
            else if (bb.pctB > 0.8)
                risks.push(L.bbAbove(f2(bb.upper)));
            else
                risks.push(L.bbBelow(f2(bb.lower)));
        }
        cats.push({ key: "technical", weight: WEIGHTS.technical, earned: tech, available: true });
        // Momentum (15): 3-month return
        let momPts = 0;
        if (mom3m !== null) {
            if (mom3m > 10) {
                momPts = 15;
                reasons.push(L.momPos(mom3m.toFixed(1)));
            }
            else if (mom3m > 0) {
                momPts = 10;
                reasons.push(L.momPos(mom3m.toFixed(1)));
            }
            else if (mom3m > -5)
                momPts = 5;
            else
                risks.push(L.momNeg(mom3m.toFixed(1)));
        }
        cats.push({ key: "momentum", weight: WEIGHTS.momentum, earned: momPts, available: mom3m !== null });
        // Volume (10): unusual-volume gauge (conviction/liquidity, not direction)
        let volPts = 0, volAvailable = false, volVerdict = "Volume data unavailable.";
        if (vol) {
            volAvailable = true;
            const r = vol.ratio.toFixed(1);
            if (vol.ratio >= 0.8 && vol.ratio <= 2) {
                volPts = 10;
                volVerdict = L.volNormal(r);
            }
            else if ((vol.ratio >= 0.5 && vol.ratio < 0.8) || (vol.ratio > 2 && vol.ratio <= 3)) {
                volPts = 7;
                volVerdict = L.volMid(r, vol.ratio > 1);
            }
            else {
                volPts = 4;
                volVerdict = vol.ratio < 0.5 ? L.volThin(r) : L.volFrenzy(r);
            }
            if (vol.ratio >= 2)
                reasons.push(volVerdict);
            else if (vol.ratio < 0.5)
                risks.push(volVerdict);
        }
        cats.push({ key: "volume", weight: WEIGHTS.volume, earned: volPts, available: volAvailable });
        // News sentiment (10): keyword heuristic over real headlines only
        let senPts = 0;
        if (senti) {
            senPts = Math.round(senti.score / 10);
            if (senti.label === "Positive")
                reasons.push(L.sentiPos(senti.positive, senti.negative, senti.counted));
            else if (senti.label === "Negative")
                risks.push(L.sentiNeg(senti.positive, senti.negative, senti.counted));
        }
        cats.push({ key: "sentiment", weight: WEIGHTS.sentiment, earned: senPts, available: senti !== null });
        // Sector (10)
        let secPts = 0;
        if (sector?.available) {
            secPts = Math.max(0, Math.min(10, Math.round(5 + (sector.aboveSMA50 ? 3 : -3) + Math.max(-2, Math.min(2, sector.changePct)))));
            if (sector.aboveSMA50)
                reasons.push(L.sectorTail(sector.indexName));
            else
                risks.push(L.sectorHead(sector.indexName));
        }
        cats.push({ key: "sector", weight: WEIGHTS.sector, earned: secPts, available: sector?.available === true });
        // Market trend (15): NIFTY regime
        let mktPts = 0;
        if (nifty) {
            mktPts = (nifty.aboveSMA50 ? 8 : 0) + ((nifty.rsi14 ?? 50) >= 50 ? 7 : 0);
            if (mktPts >= 12)
                reasons.push(L.niftySupportive(nifty.price.toLocaleString("en-IN"), `${nifty.changePct >= 0 ? "+" : ""}${nifty.changePct.toFixed(2)}`));
            else
                risks.push(L.niftySoft());
        }
        cats.push({ key: "market", weight: WEIGHTS.market, earned: mktPts, available: nifty !== null });
        // Fundamentals (10): excluded — feed publishes no P/E, EPS, revenue or margins
        cats.push({ key: "fundamentals", weight: WEIGHTS.fundamentals, earned: 0, available: false });
        const availW = cats.filter((c) => c.available).reduce((a, c) => a + c.weight, 0);
        const earned = cats.filter((c) => c.available).reduce((a, c) => a + c.earned, 0);
        const score = availW > 0 ? Math.max(0, Math.min(100, Math.round((earned / availW) * 100))) : 0;
        const trend = score >= 60 ? "Bullish" : score >= 40 ? "Neutral" : "Bearish";
        const signal = score >= 65 ? "BUY" : score >= 45 ? "HOLD" : "SELL";
        // ---------- 30-day statistical projection (clearly labeled estimate) ----------
        const H = 30, z = 1.28; // ~80% band under lognormal assumption
        const central = price * Math.exp(mu * H);
        const high = price * Math.exp(mu * H + z * sigma * Math.sqrt(H));
        const low = price * Math.exp(mu * H - z * sigma * Math.sqrt(H));
        const upsidePct = ((high - price) / price) * 100;
        const downsidePct = ((price - low) / price) * 100;
        const expectedPct = ((central - price) / price) * 100;
        const asOf = new Date();
        const projection = Array.from({ length: H }, (_, i) => {
            const d = new Date(asOf.getTime() + (i + 1) * 864e5);
            return {
                day: i + 1,
                date: d.toISOString().slice(0, 10),
                central: r2(price * Math.exp(mu * (i + 1))),
                high: r2(price * Math.exp(mu * (i + 1) + z * sigma * Math.sqrt(i + 1))),
                low: r2(price * Math.exp(mu * (i + 1) - z * sigma * Math.sqrt(i + 1))),
            };
        });
        // ---------- support / resistance from real levels ----------
        const window3m = closes.slice(-63);
        const hi3m = Math.max(...window3m), lo3m = Math.min(...window3m);
        const supports = [lo3m, bb?.lower, sma50 !== null && sma50 < price ? sma50 : null].filter((v) => v !== null && v !== undefined && v < price);
        const resistances = [hi3m, bb?.upper, sma50 !== null && sma50 > price ? sma50 : null].filter((v) => v !== null && v !== undefined && v > price);
        const uniq = (arr) => Array.from(new Set(arr.map((v) => r2(v)))).sort((a, b) => a - b);
        const support = uniq(supports).slice(-2);
        const resistance = uniq(resistances).slice(0, 2);
        // ---------- relative performance (real 3-month returns) ----------
        const relNifty = mom3m !== null && nifty?.momentum3mPct !== undefined && nifty?.momentum3mPct !== null
            ? Number((mom3m - nifty.momentum3mPct).toFixed(1)) : null;
        const relSector = mom3m !== null && sector?.available && sector.momentum3mPct !== null && sector.momentum3mPct !== undefined
            ? Number((mom3m - sector.momentum3mPct).toFixed(1)) : null;
        if (relNifty !== null) {
            if (relNifty > 0)
                reasons.push(L.outperform(relNifty.toFixed(1)));
            else
                risks.push(L.underperform(Math.abs(relNifty).toFixed(1)));
        }
        const sName = sector?.available ? sector.indexName : null;
        let relVerdict = null;
        if (relNifty !== null && relSector !== null && sName) {
            if (relNifty > 0 && relSector > 0)
                relVerdict = L.relOutperformBoth(`+${relSector.toFixed(1)} pts`, `+${relNifty.toFixed(1)} pts`);
            else if (relNifty <= 0 && relSector <= 0)
                relVerdict = L.relUnderperformBoth(`${Math.abs(relSector).toFixed(1)} pts`, `${Math.abs(relNifty).toFixed(1)} pts`);
            else
                relVerdict = L.relMixed(`vs ${sName}: ${relSector >= 0 ? "+" : ""}${relSector.toFixed(1)} pts; vs NIFTY 50: ${relNifty >= 0 ? "+" : ""}${relNifty.toFixed(1)} pts`);
        }
        else if (relNifty !== null) {
            relVerdict = L.relMixed(`vs NIFTY 50: ${relNifty >= 0 ? "+" : ""}${relNifty.toFixed(1)} pts over 3 months`);
        }
        // ---------- anomaly detection (real deviations only, never predictions) ----------
        const session = await yahoo_provider_1.yahooProvider.getHistory(ref.yahoo, "5m", "1d").catch(() => []);
        const dayOpen = session.length ? session[0].open : null;
        const anomalies = [];
        if (vol && vol.ratio >= 2)
            anomalies.push({ type: "unusual_volume", severity: vol.ratio >= 3 ? "warning" : "info", message: L.anomVolume(vol.ratio.toFixed(1)) });
        const daySigmaPct = sigma * 100;
        if (Math.abs(quote.changePct) >= Math.max(4, 2 * daySigmaPct)) {
            anomalies.push(quote.changePct > 0
                ? { type: "price_spike_up", severity: "warning", message: L.anomSpikeUp(quote.changePct.toFixed(1)) }
                : { type: "price_spike_down", severity: "warning", message: L.anomSpikeDown(Math.abs(quote.changePct).toFixed(1)) });
        }
        if (price >= hi3m && hi3m > 0 && quote.changePct > 0.5)
            anomalies.push({ type: "breakout", severity: "info", message: L.anomBreakout(f2(hi3m)) });
        else if (price <= lo3m && lo3m > 0 && quote.changePct < -0.5)
            anomalies.push({ type: "breakdown", severity: "warning", message: L.anomBreakdown(f2(lo3m)) });
        if (volAnn >= 40)
            anomalies.push({ type: "volatility_spike", severity: "warning", message: L.anomVolSpike(volAnn.toFixed(0)) });
        if (dayOpen !== null && quote.prevClose > 0) {
            const gap = ((dayOpen - quote.prevClose) / quote.prevClose) * 100;
            if (gap >= 1.5)
                anomalies.push({ type: "gap_up", severity: "info", message: L.anomGapUp(gap.toFixed(1)) });
            else if (gap <= -1.5)
                anomalies.push({ type: "gap_down", severity: "warning", message: L.anomGapDown(Math.abs(gap).toFixed(1)) });
        }
        // ---------- bull / base / bear scenarios anchored on real levels ----------
        const r0 = resistance[0], s0 = support[support.length - 1];
        const ctxLine = sector?.available
            ? (sector.aboveSMA50 ? L.sectorTail(sector.indexName) : L.sectorHead(sector.indexName))
            : nifty ? L.niftySupportive(nifty.price.toLocaleString("en-IN"), `${nifty.changePct >= 0 ? "+" : ""}${nifty.changePct.toFixed(2)}`) : L.gapSector();
        const scenarios = [
            { key: "bull", label: L.bullLabel(), price: r2(high), conditions: L.scBull(r0 !== undefined ? f2(r0) : f2(high), ctxLine) },
            { key: "base", label: L.baseLabel(), price: r2(central), conditions: L.scBase(f2(low), f2(high), volAnn.toFixed(0), s0 !== undefined ? f2(s0) : f2(low)) },
            { key: "bear", label: L.bearLabel(), price: r2(low), conditions: L.scBear(s0 !== undefined ? f2(s0) : f2(low), ctxLine) },
        ];
        // ---------- news intelligence (extractive summary + templated impact) ----------
        const theme = topTheme(news.map((n) => n.title));
        const newsIntel = {
            count: news.length,
            sentiment: senti ? { label: L.sentimentLabel(senti.label), score: senti.score } : null,
            summary: news.length ? L.newsSummary(news.length, senti ? L.sentimentLabel(senti.label) : "—", theme) : L.newsNone(),
            impact: !senti ? L.newsNone() : senti.label === "Positive" ? L.newsImpactPos() : senti.label === "Negative" ? L.newsImpactNeg() : L.newsImpactNeu(),
            items: news,
        };
        // ---------- fundamental health (honest unavailable state — never estimated) ----------
        const fundamentalHealth = {
            available: false,
            factors: ["growth", "profitability", "debt", "valuation", "cashflow"],
            scores: null,
            note: L.fundHealthNote(),
        };
        // ---------- risk & confidence ----------
        const drawdown = quote.week52High ? ((quote.week52High - price) / quote.week52High) * 100 : null;
        let riskLevel = "MEDIUM";
        if (volAnn >= 45 || (rsi14 !== null && (rsi14 > 75 || rsi14 < 25)) || (drawdown !== null && drawdown > 30))
            riskLevel = "HIGH";
        else if (volAnn < 28 && score >= 55)
            riskLevel = "LOW";
        if (riskLevel !== "LOW") {
            if (volAnn >= 45)
                risks.push(L.volHigh(volAnn.toFixed(0)));
            if (drawdown !== null && drawdown > 30)
                risks.push(L.drawdown(drawdown.toFixed(0)));
        }
        let confidence = 55 + (closes.length >= 200 ? 10 : 0) + (m && ((m.hist > 0 && trend === "Bullish") || (m.hist <= 0 && trend !== "Bullish")) ? 8 : 0) - (volAnn >= 45 ? 15 : 0);
        const dataGaps = [L.gapFund()];
        if (!sector?.available) {
            confidence -= 5;
            dataGaps.push(L.gapSector());
        }
        if (limitedHistory) {
            confidence -= 5;
            dataGaps.push(L.gapHistory(closes.length, Math.min(200, closes.length)));
        }
        if (!news.length) {
            confidence -= 3;
            dataGaps.push(L.gapNews());
        }
        if (!volAvailable)
            dataGaps.push(L.gapVolume());
        confidence = Math.max(30, Math.min(85, Math.round(confidence)));
        // ---------- explainable reasoning: verifiable factors only, no hidden chain-of-thought ----------
        const rsiZ = rsi14 !== null ? L.rsiZone(rsi14) : null;
        const volLevel = volAnn >= 45 ? "high" : volAnn >= 28 ? "mid" : "low";
        const smaZReason = L.smaZone(smaUp, golden);
        const reasoningTechnical = [
            rsi14 !== null && rsiZ ? L.tRSI(rsi14.toFixed(1), L.zoneWord(rsiZ)) : L.tRSI(null, ""),
            m ? L.tMACD(m.hist > 0 ? L.macdPos(f2(m.dif), f2(m.signal)) : L.macdNeg(f2(m.dif), f2(m.signal))) : L.tMACD("—"),
            sma50 !== null && sma200 !== null
                ? L.tSMA(smaZReason === "up" ? L.priceAboveSMA(f2(price), f2(sma50)) : smaZReason === "mixed" ? L.smaMixed() : `${L.priceBelowSMA(f2(price), f2(sma50))} ${L.smaWeak()}`)
                : L.tSMA("—"),
            bb ? L.tBB(bb.pctB >= 0.2 && bb.pctB <= 0.8 ? L.bbInside(bb.pctB.toFixed(2)) : bb.pctB > 0.8 ? L.bbAbove(f2(bb.upper)) : L.bbBelow(f2(bb.lower))) : L.tBB("—"),
            L.tATR(atr14 !== null ? f2(atr14) : "n/a", volAnn.toFixed(1), L.zoneWord(volLevel)),
            L.tMom(mom3m !== null ? (mom3m >= 0 ? L.momPos(mom3m.toFixed(1)) : L.momNeg(mom3m.toFixed(1))) : L.gapHistory(closes.length, 63)),
            L.tVol(volVerdict),
        ];
        const reasoningMarket = [
            nifty ? L.mNifty(L.niftySupportive(nifty.price.toLocaleString("en-IN"), `${nifty.changePct >= 0 ? "+" : ""}${nifty.changePct.toFixed(2)}`)) : L.mNifty(L.niftySoft()),
            sector?.available ? L.mSector(sector.aboveSMA50 ? L.sectorTail(sector.indexName) : L.sectorHead(sector.indexName)) : L.mSector(L.gapSector()),
            adv ? L.mBreadth(L.breadthLine(adv.advancers, adv.tracked, adv.decliners)) : L.mBreadth(L.gapSector()),
            L.mBreadth(volVerdict),
        ];
        const reasoningFundamental = [L.fExcluded()];
        const reasoningNews = news.length
            ? [
                L.newsSome(news.length, news.length > 1),
                ...(senti ? [`${L.sentimentLabel(senti.label)} (${senti.positive}/${senti.negative})`] : []),
                ...news.map((n) => `\u201C${n.title}\u201D${n.publisher ? ` (${n.publisher})` : ""}`),
            ]
            : [L.newsNone()];
        const reasoningFinal = L.finalVerdict(score, availW, L.trend(trend), L.signal(signal), confidence, L.risk(riskLevel), f2(low), f2(high), upsidePct.toFixed(1), downsidePct.toFixed(1));
        // ---------- persist forecast for later accuracy tracking (never blocks analysis) ----------
        let forecastId = null;
        try {
            const rec = await db_1.prisma.forecastRecord.create({
                data: {
                    symbol: ref.appSymbol, exchange: ref.exchange, asOf,
                    priceAtTime: price, central: r2(central), low: r2(low), high: r2(high),
                    expectedPct: Number(expectedPct.toFixed(1)), score, signal, trend,
                    confidence, dataTime: quote.marketTime ? new Date(quote.marketTime) : null,
                },
            });
            forecastId = rec.id;
        }
        catch { /* storage must never break analysis */ }
        return {
            mode: "live",
            market: "IN",
            symbol: ref.appSymbol,
            name: ref.name,
            exchange: ref.exchange,
            currency: quote.currency || "INR",
            asOf: asOf.toISOString(),
            forecastId,
            quoteTime: quote.marketTime,
            currentPrice: price,
            changePct: Number(quote.changePct.toFixed(2)),
            volume: quote.volume,
            signal: L.signal(signal),
            trend: L.trend(trend),
            score,
            lang,
            categories: cats.map((c) => ({ key: c.key, weight: c.weight, score: c.available ? Math.round((c.earned / c.weight) * 100) : null })),
            confidence,
            riskLevel: L.risk(riskLevel),
            forecast: {
                horizonDays: H,
                label: L.forecastLabel(),
                low: r2(low), central: r2(central), high: r2(high),
                upsidePct: Number(upsidePct.toFixed(1)),
                downsidePct: Number(downsidePct.toFixed(1)),
                expectedPct: Number(expectedPct.toFixed(1)),
                projection,
            },
            support,
            resistance,
            indicators: {
                rsi14: rsi14 !== null ? Number(rsi14.toFixed(1)) : null,
                macd: m ? { dif: r2(m.dif), signal: r2(m.signal), hist: r2(m.hist) } : null,
                sma20: sma20 !== null ? r2(sma20) : null,
                sma50: sma50 !== null ? r2(sma50) : null,
                sma200: sma200 !== null ? r2(sma200) : null,
                ema20: ema20 !== null ? r2(ema20) : null,
                bollinger: bb ? { upper: r2(bb.upper), mid: r2(bb.mid), lower: r2(bb.lower), pctB: Number(bb.pctB.toFixed(2)) } : null,
                atr14: atr14 !== null ? r2(atr14) : null,
                momentum3mPct: mom3m !== null ? Number(mom3m.toFixed(1)) : null,
                volatilityAnnPct: Number(volAnn.toFixed(1)),
                week52High: quote.week52High, week52Low: quote.week52Low,
                dayHigh: quote.dayHigh, dayLow: quote.dayLow,
            },
            volumeAnalysis: vol ? { today: vol.latest, avg20: Math.round(vol.avg), ratio: Number(vol.ratio.toFixed(2)), verdict: volVerdict } : null,
            sentiment: senti ? { ...senti, label: L.sentimentLabel(senti.label), method: lang === "hi" ? "वास्तविक सुर्खियों में कीवर्ड संकेत (कोई ML मॉडल नहीं)" : lang === "gu" ? "વાસ્તવિક હેડલાઇન્સમાં કીવર્ડ સંકેતો (કોઈ ML મોડેલ નહીં)" : "Keyword cues in real headlines (no ML model)" } : null,
            relativePerformance: {
                vsNifty3mPct: relNifty,
                vsSector3mPct: relSector,
                sectorName: sector?.available ? sector.indexName : null,
                verdict: relVerdict,
            },
            marketContext: {
                nifty,
                sector: sector?.available ? sector : sector ? { ...sector, note: lang === "hi" ? "सेक्टर इंडेक्स उपलब्ध नहीं" : lang === "gu" ? "સેક્ટર ઇન્ડેક્સ ઉપલબ્ધ નથી" : "Sector index unavailable" } : { note: lang === "hi" ? "इस सिंबल के लिए सेक्टर अज्ञात — NIFTY 50 का उपयोग" : lang === "gu" ? "આ સિમ્બોલ માટે સેક્ટર અજ્ઞાત — NIFTY 50 વપરાયો" : "Sector unknown for this symbol — NIFTY 50 used as proxy" },
                breadth: adv,
            },
            fundamentals: null,
            fundamentalHealth,
            news,
            newsIntel,
            anomalies,
            scenarios,
            reasons,
            strengths: reasons,
            weaknesses: risks.length ? risks : [L.noRisks()],
            keyRisks: risks.length ? risks : [L.noRisks()],
            reasoning: {
                technical: reasoningTechnical,
                market: reasoningMarket,
                fundamental: reasoningFundamental,
                news: reasoningNews,
                final: reasoningFinal,
            },
            dataGaps,
            methodology: L.methodology(),
            disclaimer: L.disclaimer(),
        };
    },
    // ---------- shared NSE universe scan (full rows for scanner + NL screener) ----------
    async scanAll(lang = "en") {
        const L = lang_1.STR[lang] ?? lang_1.STR.en;
        const seen = new Map();
        for (const s of [...symbols_1.APP_SYMBOLS, ...symbols_1.MOVERS_UNIVERSE]) {
            if ((s.exchange === "NSE" || s.exchange === "BSE") && !seen.has(s.yahoo))
                seen.set(s.yahoo, { app: s.app, yahoo: s.yahoo, name: s.name });
        }
        const universe = [...seen.values()];
        const nifty = await indexContext(nse_1.NIFTY, "NIFTY50").catch(() => null);
        const mktPts = nifty ? (nifty.aboveSMA50 ? 8 : 0) + ((nifty.rsi14 ?? 50) >= 50 ? 7 : 0) : 0;
        const rows = [];
        for (let i = 0; i < universe.length; i += 5) {
            const chunk = universe.slice(i, i + 5);
            const out = await Promise.all(chunk.map(async (u) => {
                try {
                    const [q, bars] = await Promise.all([
                        yahoo_provider_1.yahooProvider.getQuote(u.yahoo),
                        yahoo_provider_1.yahooProvider.getHistory(u.yahoo, "1d", "6mo"),
                    ]);
                    const closes = bars.map((b) => b.close);
                    if (closes.length < 60)
                        return null;
                    const s50 = (0, indicators_1.sma)(closes, 50), s200 = (0, indicators_1.sma)(closes, Math.min(200, closes.length));
                    const r = (0, indicators_1.rsi)(closes, 14), m = (0, indicators_1.macd)(closes);
                    const mom = closes.length > 63 ? ((closes[closes.length - 1] - closes[closes.length - 63]) / closes[closes.length - 63]) * 100 : null;
                    const v = (0, indicators_1.volumeStats)(bars.map((b) => b.volume), 20);
                    const lrets = [];
                    for (let k = 1; k < closes.length; k++)
                        lrets.push(Math.log(closes[k] / closes[k - 1]));
                    const mn = lrets.reduce((a, b) => a + b, 0) / lrets.length;
                    const vola = Math.sqrt(lrets.reduce((a, x) => a + (x - mn) * (x - mn), 0) / lrets.length) * Math.sqrt(252) * 100;
                    let earned = 0, avail = 0, t = 0;
                    if (s50 !== null && s200 !== null) {
                        t += q.price > s50 && s50 > s200 ? 12 : q.price > s50 || s50 > s200 ? 6 : 0;
                    }
                    if (r !== null)
                        t += r >= 50 && r <= 70 ? 8 : r > 70 ? 3 : r >= 40 ? 5 : 2;
                    if (m)
                        t += m.hist > 0 ? 7 : 0;
                    earned += t;
                    avail += 27;
                    if (mom !== null) {
                        earned += mom > 10 ? 15 : mom > 0 ? 10 : mom > -5 ? 5 : 0;
                        avail += 15;
                    }
                    if (v) {
                        earned += v.ratio >= 0.8 && v.ratio <= 2 ? 10 : v.ratio >= 0.5 || v.ratio <= 3 ? 7 : 4;
                        avail += 10;
                    }
                    if (nifty) {
                        earned += mktPts;
                        avail += 15;
                    }
                    const score = avail > 0 ? Math.round((earned / avail) * 100) : 0;
                    const rawSignal = score >= 65 ? "BUY" : score >= 45 ? "HOLD" : "SELL";
                    const why = [];
                    if (s50 !== null && q.price > s50)
                        why.push(L.whySMA(s50.toFixed(1)));
                    if (r !== null && r >= 50 && r <= 70)
                        why.push(L.whyRSI(r.toFixed(1)));
                    if (m && m.hist > 0)
                        why.push(L.whyMACD());
                    if (mom !== null && mom > 10)
                        why.push(L.whyMom(mom.toFixed(1)));
                    if (v && v.ratio >= 2)
                        why.push(L.whyVol(v.ratio.toFixed(1)));
                    return {
                        symbol: u.app, name: u.name, price: q.price, changePct: Number(q.changePct.toFixed(2)),
                        score, signal: L.signal(rawSignal), signalEn: rawSignal,
                        rsi14: r !== null ? Number(r.toFixed(1)) : null,
                        mom: mom !== null ? Number(mom.toFixed(1)) : null,
                        volRatio: v ? Number(v.ratio.toFixed(2)) : null,
                        volatility: Number(vola.toFixed(1)),
                        sector: nse_1.SECTOR_INDEX[u.app]?.sector ?? "Unknown",
                        trendEn: score >= 60 ? "Bullish" : score >= 40 ? "Neutral" : "Bearish",
                        riskEn: vola >= 45 || (r !== null && (r > 75 || r < 25)) ? "HIGH" : vola < 28 && score >= 55 ? "LOW" : "MEDIUM",
                        reasons: why.slice(0, 3),
                    };
                }
                catch {
                    return null;
                } // unscannable symbols are skipped, never fabricated
            }));
            for (const o of out)
                if (o)
                    rows.push(o);
        }
        return { asOf: new Date().toISOString(), universe: universe.length, rows };
    },
    // ---------- natural-language AI screener over real scanned data ----------
    async screenNatural(query, lang = "en") {
        const L = lang_1.STR[lang] ?? lang_1.STR.en;
        const intent = (0, screenQuery_1.parseScreenQuery)(query);
        if ("error" in intent)
            throw new ApiError_1.ApiError(400, intent.error === "fundamentals" ? L.screenUnsupported() : L.screenUnknown());
        const { rows, universe, asOf } = await this.scanAll(lang);
        let pool = [...rows];
        if (intent.preset === "momentum")
            pool = pool.filter((r) => r.mom !== null).sort((a, b) => b.mom - a.mom);
        else if (intent.preset === "volume")
            pool = pool.filter((r) => r.volRatio !== null && r.volRatio >= 1.5).sort((a, b) => b.volRatio - a.volRatio);
        else if (intent.preset === "sector")
            pool = pool.filter((r) => r.sector === intent.sector).sort((a, b) => b.score - a.score);
        else if (intent.preset === "bullish")
            pool = pool.filter((r) => r.signalEn === "BUY").sort((a, b) => b.score - a.score);
        else if (intent.preset === "calm")
            pool = pool.sort((a, b) => a.volatility - b.volatility);
        else if (intent.preset === "oversold")
            pool = pool.filter((r) => r.rsi14 !== null && r.rsi14 < 35).sort((a, b) => a.rsi14 - b.rsi14);
        else
            pool = pool.sort((a, b) => b.score - a.score);
        const top = pool.slice(0, 10).map((r) => ({
            symbol: r.symbol, name: r.name, price: r.price, changePct: r.changePct,
            score: r.score, trend: L.trend(r.trendEn),
            mainReason: screenReason(intent.preset, r, L),
            riskLevel: L.risk(r.riskEn),
        }));
        return {
            mode: "live", market: "IN", asOf, query,
            preset: intent.preset, ...("sector" in intent && intent.sector ? { sector: intent.sector } : {}),
            scanned: universe, matched: pool.length, results: top,
        };
    },
    // ---------- AI opportunity scanner: light scoring over the NSE universe ----------
    async scanOpportunities(limit = 8, lang = "en") {
        const L = lang_1.STR[lang] ?? lang_1.STR.en;
        const seen = new Map();
        for (const s of [...symbols_1.APP_SYMBOLS, ...symbols_1.MOVERS_UNIVERSE]) {
            if ((s.exchange === "NSE" || s.exchange === "BSE") && !seen.has(s.yahoo))
                seen.set(s.yahoo, { app: s.app, yahoo: s.yahoo, name: s.name });
        }
        const universe = [...seen.values()];
        const nifty = await indexContext(nse_1.NIFTY, "NIFTY50").catch(() => null);
        const mktPts = nifty ? (nifty.aboveSMA50 ? 8 : 0) + ((nifty.rsi14 ?? 50) >= 50 ? 7 : 0) : 0;
        const results = [];
        for (let i = 0; i < universe.length; i += 5) {
            const chunk = universe.slice(i, i + 5);
            const out = await Promise.all(chunk.map(async (u) => {
                try {
                    const [q, bars] = await Promise.all([
                        yahoo_provider_1.yahooProvider.getQuote(u.yahoo),
                        yahoo_provider_1.yahooProvider.getHistory(u.yahoo, "1d", "6mo"),
                    ]);
                    const closes = bars.map((b) => b.close);
                    if (closes.length < 60)
                        return null;
                    const s50 = (0, indicators_1.sma)(closes, 50), s200 = (0, indicators_1.sma)(closes, Math.min(200, closes.length));
                    const r = (0, indicators_1.rsi)(closes, 14), m = (0, indicators_1.macd)(closes);
                    const mom = closes.length > 63 ? ((closes[closes.length - 1] - closes[closes.length - 63]) / closes[closes.length - 63]) * 100 : null;
                    const v = (0, indicators_1.volumeStats)(bars.map((b) => b.volume), 20);
                    // Light score mirrors the full weights (technical 30 + momentum 15 + volume 10 + market 15), renormalized to 100.
                    let earned = 0, avail = 0;
                    let t = 0;
                    if (s50 !== null && s200 !== null) {
                        t += q.price > s50 && s50 > s200 ? 12 : q.price > s50 || s50 > s200 ? 6 : 0;
                    }
                    if (r !== null)
                        t += r >= 50 && r <= 70 ? 8 : r > 70 ? 3 : r >= 40 ? 5 : 2;
                    if (m)
                        t += m.hist > 0 ? 7 : 0;
                    earned += t;
                    avail += 27; // SMA structure needs both SMAs; bb skipped in scan
                    if (mom !== null) {
                        earned += mom > 10 ? 15 : mom > 0 ? 10 : mom > -5 ? 5 : 0;
                        avail += 15;
                    }
                    if (v) {
                        earned += v.ratio >= 0.8 && v.ratio <= 2 ? 10 : v.ratio >= 0.5 || v.ratio <= 3 ? 7 : 4;
                        avail += 10;
                    }
                    if (nifty) {
                        earned += mktPts;
                        avail += 15;
                    }
                    const score = avail > 0 ? Math.round((earned / avail) * 100) : 0;
                    const why = [];
                    if (s50 !== null && q.price > s50)
                        why.push(L.whySMA(s50.toFixed(1)));
                    if (r !== null && r >= 50 && r <= 70)
                        why.push(L.whyRSI(r.toFixed(1)));
                    if (m && m.hist > 0)
                        why.push(L.whyMACD());
                    if (mom !== null && mom > 10)
                        why.push(L.whyMom(mom.toFixed(1)));
                    if (v && v.ratio >= 2)
                        why.push(L.whyVol(v.ratio.toFixed(1)));
                    const rawSignal = score >= 65 ? "BUY" : score >= 45 ? "HOLD" : "SELL";
                    return {
                        symbol: u.app, name: u.name, price: q.price, changePct: Number(q.changePct.toFixed(2)),
                        score, signal: L.signal(rawSignal),
                        rsi14: r !== null ? Number(r.toFixed(1)) : null,
                        momentum3mPct: mom !== null ? Number(mom.toFixed(1)) : null,
                        volumeRatio: v ? Number(v.ratio.toFixed(2)) : null,
                        reasons: why.slice(0, 3),
                    };
                }
                catch {
                    return null;
                } // unscannable symbols are skipped, never fabricated
            }));
            for (const o of out)
                if (o)
                    results.push(o);
        }
        results.sort((a, b) => b.score - a.score);
        return { mode: "live", market: "IN", asOf: new Date().toISOString(), scanned: universe.length, ranked: results.length, opportunities: results.slice(0, Math.max(1, Math.min(10, limit))) };
    },
    // ---------- AI comparison of 2-5 Indian stocks ----------
    async compare(symbols, lang = "en") {
        const clean = Array.from(new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean)));
        if (clean.length < 2 || clean.length > 5)
            throw new ApiError_1.ApiError(400, "Compare 2–5 stocks");
        const full = await Promise.all(clean.map((s) => this.analyze(s, lang))); // resolveIndian rejects non-NSE/BSE
        const rows = full.map((a) => ({
            symbol: a.symbol, name: a.name, price: a.currentPrice, changePct: a.changePct,
            score: a.score, categories: a.categories, signal: a.signal, trend: a.trend,
            confidence: a.confidence, riskLevel: a.riskLevel,
            forecast: { low: a.forecast.low, central: a.forecast.central, high: a.forecast.high, upsidePct: a.forecast.upsidePct, downsidePct: a.forecast.downsidePct, expectedPct: a.forecast.expectedPct },
            rsi14: a.indicators.rsi14, macdHist: a.indicators.macd?.hist ?? null,
            volatilityAnnPct: a.indicators.volatilityAnnPct,
            volumeRatio: a.volumeAnalysis?.ratio ?? null,
            sentiment: a.sentiment ? { label: a.sentiment.label, score: a.sentiment.score } : null,
            relativePerformance: a.relativePerformance,
            topReasons: a.reasons.slice(0, 2), topRisks: a.keyRisks.slice(0, 2),
            asOf: a.asOf,
        }));
        rows.sort((a, b) => b.score - a.score);
        return { mode: "live", market: "IN", asOf: new Date().toISOString(), ranked: rows };
    },
    // ---------- Indian market & sector overview ----------
    async marketOverview(lang = "en") {
        const L = lang_1.STR[lang] ?? lang_1.STR.en;
        const [nifty, sensex, adv] = await Promise.all([
            indexContext(nse_1.NIFTY, "NIFTY50").catch(() => null),
            indexContext(SENSEX, "SENSEX").catch(() => null),
            breadth().catch(() => null),
        ]);
        const sectorIdx = new Map();
        for (const k of Object.keys(nse_1.SECTOR_INDEX)) {
            const s = nse_1.SECTOR_INDEX[k];
            if (s.index !== nse_1.NIFTY && !sectorIdx.has(s.index))
                sectorIdx.set(s.index, s);
        }
        const sectors = await Promise.all([...sectorIdx.values()].map(async (s) => {
            try {
                const [q, bars] = await Promise.all([yahoo_provider_1.yahooProvider.getQuote(s.index), yahoo_provider_1.yahooProvider.getHistory(s.index, "1d", "6mo")]);
                const closes = bars.map((b) => b.close);
                const s50 = (0, indicators_1.sma)(closes, 50);
                const mom = closes.length > 63 ? ((closes[closes.length - 1] - closes[closes.length - 63]) / closes[closes.length - 63]) * 100 : null;
                return { sector: s.sector, index: s.indexName, price: q.price, changePct: Number(q.changePct.toFixed(2)), aboveSMA50: s50 !== null ? q.price > s50 : null, momentum3mPct: mom !== null ? Number(mom.toFixed(1)) : null };
            }
            catch {
                return { sector: s.sector, index: s.indexName, unavailable: true };
            }
        }));
        const rawRegime = !nifty ? "Unknown" : nifty.aboveSMA50 && (nifty.rsi14 ?? 50) >= 50 ? "Bullish" : !nifty.aboveSMA50 && (nifty.rsi14 ?? 50) < 45 ? "Bearish" : "Neutral";
        return {
            mode: "live", market: "IN", asOf: new Date().toISOString(),
            regime: L.regime(rawRegime), nifty, sensex, breadth: adv, sectors,
        };
    },
    // ---------- forecast track record: real stored forecasts vs real prices ----------
    async forecastHistory(input, lang = "en") {
        const L = lang_1.STR[lang] ?? lang_1.STR.en;
        const ref = (0, nse_1.resolveIndian)(input);
        const records = await db_1.prisma.forecastRecord.findMany({ where: { symbol: ref.appSymbol }, orderBy: { createdAt: "asc" }, take: 100 });
        const quote = await yahoo_provider_1.yahooProvider.getQuote(ref.yahoo).catch(() => null);
        const now = Date.now();
        let hits = 0, errSum = 0, evaluated = 0;
        const dir = (pct, band) => (pct > band ? "up" : pct < -band ? "down" : "flat");
        const forecasts = records.map((r) => {
            if (!quote || now - new Date(r.asOf).getTime() < 24 * 3600 * 1000) {
                return { id: r.id, asOf: r.asOf, priceAtTime: r.priceAtTime, central: r.central, low: r.low, high: r.high, expectedPct: r.expectedPct, score: r.score, signal: r.signal, trend: r.trend, confidence: r.confidence ?? null, dataTime: r.dataTime ?? null, evaluated: false };
            }
            const actual = quote.price;
            const hit = dir(r.expectedPct, 1.5) === dir(((actual - r.priceAtTime) / r.priceAtTime) * 100, 2);
            const err = (Math.abs(r.central - actual) / actual) * 100;
            hits += hit ? 1 : 0;
            errSum += err;
            evaluated++;
            return { id: r.id, asOf: r.asOf, priceAtTime: r.priceAtTime, central: r.central, low: r.low, high: r.high, expectedPct: r.expectedPct, score: r.score, signal: r.signal, trend: r.trend, confidence: r.confidence ?? null, dataTime: r.dataTime ?? null, evaluated: true, actualPrice: actual, directionHit: hit, errorPct: Number(err.toFixed(1)) };
        });
        return {
            mode: "live", market: "IN", symbol: ref.appSymbol,
            evaluatedAsOf: quote ? new Date().toISOString() : null,
            currentPrice: quote?.price ?? null,
            metrics: {
                totalForecasts: records.length,
                evaluated,
                directionHits: hits,
                directionAccuracyPct: evaluated ? Number(((hits / evaluated) * 100).toFixed(1)) : null,
                avgErrorPct: evaluated ? Number((errSum / evaluated).toFixed(1)) : null,
                method: L.trackMethod(),
            },
            forecasts,
        };
    },
    // ---------- cross-symbol backtest evaluation: stored forecasts vs real outcomes ----------
    async evaluation(symbols, lang = "en") {
        void lang;
        const clean = Array.from(new Set((symbols || []).map((s) => String(s).trim().toUpperCase()).filter(Boolean))).slice(0, 12);
        if (!clean.length)
            throw new ApiError_1.ApiError(400, "Provide 1-12 symbols");
        const now = Date.now();
        // One NIFTY history for all benchmark windows (never per-record calls).
        let nifty = [];
        try {
            const bars = await yahoo_provider_1.yahooProvider.getHistory(nse_1.NIFTY, "1d", "1y");
            nifty = bars.filter((b) => b?.close != null && b?.date).map((b) => ({ date: b.date, close: Number(b.close) }));
        }
        catch { /* benchmark degrades to nulls, rest still works */ }
        const perSymbol = [];
        const leakageTargets = [];
        await Promise.all(clean.map(async (sym) => {
            let ref;
            try {
                ref = (0, nse_1.resolveIndian)(sym);
            }
            catch {
                perSymbol.push({ symbol: sym, rows: [], skipped: "Not an NSE/BSE symbol" });
                return;
            }
            const records = await db_1.prisma.forecastRecord.findMany({ where: { symbol: ref.appSymbol }, orderBy: { createdAt: "asc" }, take: 200 });
            const quote = await yahoo_provider_1.yahooProvider.getQuote(ref.yahoo).catch(() => null);
            const actual = quote?.price ?? null;
            const rows = [];
            for (const r of records) {
                const row = (0, evaluation_1.evaluateRecord)({
                    id: r.id, symbol: r.symbol, asOf: r.asOf, priceAtTime: r.priceAtTime,
                    central: r.central, low: r.low, high: r.high, expectedPct: r.expectedPct,
                    score: r.score, signal: r.signal, trend: r.trend,
                    confidence: r.confidence ?? null,
                    dataTime: r.dataTime ?? null,
                }, actual, nifty, now);
                if (row)
                    rows.push(row);
                leakageTargets.push({ id: r.id, symbol: r.symbol, asOf: r.asOf, dataTime: r.dataTime ?? null });
            }
            perSymbol.push({ symbol: ref.appSymbol, rows, skipped: null });
        }));
        const all = perSymbol.flatMap((p) => p.rows);
        const buckets = {};
        const signals = {};
        for (const r of all) {
            (buckets[r.bucket] = buckets[r.bucket] || []).push(r);
            (signals[r.signal] = signals[r.signal] || []).push(r);
        }
        const leakage = (0, evaluation_1.detectLeakage)(leakageTargets, {});
        const checked = leakageTargets.filter((t) => t.dataTime).length;
        return {
            mode: "live",
            market: "IN",
            asOf: new Date(now).toISOString(),
            symbols: clean,
            evaluated: all.length,
            stored: leakageTargets.length,
            overall: (0, evaluation_1.summarize)(all),
            buckets: {
                d7: (0, evaluation_1.summarize)(buckets.d7 || []),
                d30: (0, evaluation_1.summarize)(buckets.d30 || []),
                d90: (0, evaluation_1.summarize)(buckets.d90 || []),
            },
            signals: {
                BUY: (0, evaluation_1.summarize)(signals.BUY || []),
                SELL: (0, evaluation_1.summarize)(signals.SELL || []),
                HOLD: (0, evaluation_1.summarize)(signals.HOLD || []),
            },
            confidence: {
                high: (0, evaluation_1.summarize)(all.filter((r) => r.confBand === "high")),
                med: (0, evaluation_1.summarize)(all.filter((r) => r.confBand === "med")),
                low: (0, evaluation_1.summarize)(all.filter((r) => r.confBand === "low")),
                unrecorded: all.filter((r) => r.confBand === null).length,
            },
            benchmarkNote: nifty.length
                ? "Mean NIFTY return over each forecast's own window (closest close ≤ prediction time → latest)."
                : "NIFTY history unavailable — benchmark not verified.",
            leakage: {
                issues: leakage,
                checkedRecords: checked,
                uncheckedRecords: leakageTargets.length - checked,
            },
            perSymbol: perSymbol.map((p) => ({ symbol: p.symbol, evaluated: p.rows.length, accuracy: (0, evaluation_1.summarize)(p.rows).accuracyPct, skipped: p.skipped })),
            history: all
                .slice()
                .sort((a, b) => (a.asOf < b.asOf ? 1 : -1))
                .slice(0, 50)
                .map((r) => ({
                symbol: r.symbol, asOf: r.asOf, ageDays: r.ageDays, bucket: r.bucket,
                signal: r.signal, expectedPct: r.expectedPct, actualPct: r.actualPct,
                directionHit: r.directionHit, errorPct: r.errorPct,
                confidence: r.confidence, niftyPct: r.niftyPct, beatNifty: r.beatNifty,
            })),
        };
    },
    // ---------- market calendar: real derivable items + honest gaps ----------
    async calendar() {
        const now = Date.now();
        const nse = symbols_1.MOVERS_UNIVERSE.filter((s) => s.exchange === "NSE").map((s) => s.app);
        const [quotes, records] = await Promise.all([
            yahoo_provider_1.yahooProvider.getQuotes(nse.map(symbols_1.toYahoo)).catch(() => []),
            db_1.prisma.forecastRecord.findMany({ orderBy: { createdAt: "desc" }, take: 200 }).catch(() => []),
        ]);
        const events = [
            ...(0, calendar_1.milestoneEvents)(quotes.map((q) => ({
                symbol: (0, symbols_1.toApp)(q.symbol),
                name: q.name ?? null,
                price: q.price ?? null,
                week52High: q.week52High ?? null,
                week52Low: q.week52Low ?? null,
                marketTime: q.marketTime ?? null,
            })), now),
            ...(0, calendar_1.projectionEvents)(records.map((r) => ({
                id: r.id, symbol: r.symbol, asOf: r.asOf,
                central: r.central, low: r.low, high: r.high,
            })), 14, now),
        ].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
        return {
            mode: "live",
            market: "IN",
            asOf: new Date(now).toISOString(),
            events,
            unavailable: [...calendar_1.UNAVAILABLE_TYPES],
            contract: calendar_1.CALENDAR_CONTRACT,
        };
    }
};
function f2(n) {
    return n >= 100 ? n.toLocaleString("en-IN", { maximumFractionDigits: 1 }) : n.toFixed(2);
}
function r2(n) {
    return Number(n.toFixed(2));
}
