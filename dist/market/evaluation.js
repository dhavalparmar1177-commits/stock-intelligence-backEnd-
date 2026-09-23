"use strict";
/**
 * Pure backtest evaluation helpers (no network, no DB).
 * Every function operates on stored forecast rows + known prices,
 * so results are unit-testable and never estimated.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ageBucket = ageBucket;
exports.signalBucket = signalBucket;
exports.confBand = confBand;
exports.niftyAt = niftyAt;
exports.evaluateRecord = evaluateRecord;
exports.summarize = summarize;
exports.detectLeakage = detectLeakage;
const DAY = 24 * 3600 * 1000;
function ageBucket(asOf, now = Date.now()) {
    const age = now - new Date(asOf).getTime();
    if (!(age >= 0) || age < DAY)
        return null; // <24h: not evaluable (matches forecastHistory)
    if (age <= 7 * DAY)
        return "d7";
    if (age <= 30 * DAY)
        return "d30";
    if (age <= 90 * DAY)
        return "d90";
    return "older";
}
function signalBucket(signal) {
    const s = String(signal || "").toUpperCase();
    if (s === "BUY" || s === "खरीदें" || s === "ખરીદો")
        return "BUY";
    if (s === "SELL" || s === "बेचें" || s === "વેચો")
        return "SELL";
    if (s === "HOLD" || s === "होल्ड" || s === "હોલ્ડ")
        return "HOLD";
    return "OTHER";
}
function confBand(confidence) {
    if (confidence === null || confidence === undefined)
        return null;
    const c = Number(confidence);
    if (!Number.isFinite(c))
        return null;
    return c >= 70 ? "high" : c >= 50 ? "med" : "low";
}
const dir = (pct, band) => (pct > band ? "up" : pct < -band ? "down" : "flat");
/** Closest NIFTY close at or before a timestamp (never after — no lookahead). */
function niftyAt(points, ts) {
    let best = null;
    for (const p of points) {
        const t = new Date(p.date).getTime();
        if (!(t <= ts))
            continue;
        if (!best || t > new Date(best.date).getTime())
            best = p;
    }
    return best && best.close > 0 ? best.close : null;
}
function evaluateRecord(r, actualPrice, nifty, now = Date.now()) {
    const bucket = ageBucket(r.asOf, now);
    if (bucket === null || bucket === "older")
        return null;
    if (actualPrice == null || !(actualPrice > 0) || !(r.priceAtTime > 0))
        return null;
    const asOfTs = new Date(r.asOf).getTime();
    const actualPct = ((actualPrice - r.priceAtTime) / r.priceAtTime) * 100;
    const err = (Math.abs(r.central - actualPrice) / actualPrice) * 100;
    const n0 = niftyAt(nifty, asOfTs);
    const n1 = niftyAt(nifty, now);
    const niftyPct = n0 != null && n1 != null ? ((n1 - n0) / n0) * 100 : null;
    return {
        id: r.id,
        symbol: r.symbol,
        asOf: new Date(r.asOf).toISOString(),
        ageDays: Math.floor((now - asOfTs) / DAY),
        bucket,
        signal: signalBucket(r.signal),
        expectedPct: r.expectedPct,
        actualPct: Number(actualPct.toFixed(2)),
        directionHit: dir(r.expectedPct, 1.5) === dir(actualPct, 2),
        errorPct: Number(err.toFixed(1)),
        confidence: r.confidence,
        confBand: confBand(r.confidence),
        niftyPct: niftyPct != null ? Number(niftyPct.toFixed(2)) : null,
        beatNifty: niftyPct != null ? actualPct > niftyPct : null,
    };
}
function avg(xs) {
    const v = xs.filter((x) => typeof x === "number" && Number.isFinite(x));
    if (!v.length)
        return null;
    return Number((v.reduce((a, b) => a + b, 0) / v.length).toFixed(2));
}
function summarize(rows) {
    if (!rows.length) {
        return {
            count: 0, hits: null, accuracyPct: null, avgErrorPct: null,
            meanExpectedPct: null, meanActualPct: null, meanNiftyPct: null, beatNiftyPct: null,
        };
    }
    const hits = rows.filter((r) => r.directionHit === true).length;
    const beats = rows.filter((r) => r.beatNifty === true).length;
    const withNifty = rows.filter((r) => r.beatNifty !== null).length;
    return {
        count: rows.length,
        hits,
        accuracyPct: Number(((hits / rows.length) * 100).toFixed(1)),
        avgErrorPct: avg(rows.map((r) => r.errorPct)),
        meanExpectedPct: avg(rows.map((r) => r.expectedPct)),
        meanActualPct: avg(rows.map((r) => r.actualPct)),
        meanNiftyPct: avg(rows.map((r) => r.niftyPct)),
        beatNiftyPct: withNifty ? Number(((beats / withNifty) * 100).toFixed(1)) : null,
    };
}
/**
 * Future-data leakage checks on stored rows + their projections.
 * - dataTime (exchange quote timestamp) must be <= asOf.
 * - projection dates must be > asOf.
 */
function detectLeakage(records, projections) {
    const out = [];
    for (const r of records) {
        const asOf = new Date(r.asOf).getTime();
        if (r.dataTime) {
            const dt = new Date(r.dataTime).getTime();
            if (Number.isFinite(dt) && Number.isFinite(asOf) && dt > asOf + 60 * 1000) {
                out.push({
                    id: r.id, symbol: r.symbol, type: "data_after_prediction",
                    detail: `dataTime ${new Date(dt).toISOString()} is after asOf ${new Date(asOf).toISOString()}`,
                });
            }
        }
        for (const d of projections[r.id] || []) {
            const t = new Date(d).getTime();
            if (Number.isFinite(t) && Number.isFinite(asOf) && t <= asOf) {
                out.push({
                    id: r.id, symbol: r.symbol, type: "projection_before_prediction",
                    detail: `projection date ${d} is not after asOf`,
                });
            }
        }
    }
    return out;
}
