"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sma = sma;
exports.rsi = rsi;
exports.ema = ema;
exports.emaSeries = emaSeries;
exports.macd = macd;
exports.bollinger = bollinger;
exports.atr = atr;
exports.volumeStats = volumeStats;
// Simple technical indicator helpers (demo-safe, deterministic)
function sma(values, period) {
    if (values.length < period)
        return null;
    const s = values.slice(-period).reduce((a, b) => a + b, 0);
    return s / period;
}
function rsi(closes, period = 14) {
    if (closes.length < period + 1)
        return null;
    let gains = 0, losses = 0;
    for (let i = closes.length - period; i < closes.length; i++) {
        const d = closes[i] - closes[i - 1];
        if (d >= 0)
            gains += d;
        else
            losses -= d;
    }
    if (losses === 0)
        return 100;
    const rs = gains / losses;
    return 100 - 100 / (1 + rs);
}
function ema(values, period) {
    if (values.length < period)
        return null;
    const k = 2 / (period + 1);
    let e = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < values.length; i++)
        e = values[i] * k + e * (1 - k);
    return e;
}
function emaSeries(values, period) {
    const out = new Array(values.length).fill(null);
    if (values.length < period)
        return out;
    const k = 2 / (period + 1);
    let e = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
    out[period - 1] = e;
    for (let i = period; i < values.length; i++) {
        e = values[i] * k + e * (1 - k);
        out[i] = e;
    }
    return out;
}
function macd(closes, fast = 12, slow = 26, signal = 9) {
    if (closes.length < slow + signal)
        return null;
    const ef = emaSeries(closes, fast), es = emaSeries(closes, slow);
    const difs = closes.map((_, i) => (ef[i] !== null && es[i] !== null ? ef[i] - es[i] : null));
    const valid = difs.filter((d) => d !== null);
    const sig = ema(valid, signal);
    if (sig === null)
        return null;
    const dif = valid[valid.length - 1];
    return { dif, signal: sig, hist: dif - sig };
}
function bollinger(closes, period = 20, mult = 2) {
    if (closes.length < period)
        return null;
    const slice = closes.slice(-period);
    const mid = slice.reduce((a, b) => a + b, 0) / period;
    const sd = Math.sqrt(slice.reduce((a, c) => a + (c - mid) * (c - mid), 0) / period);
    const upper = mid + mult * sd, lower = mid - mult * sd;
    const last = closes[closes.length - 1];
    return { upper, mid, lower, pctB: upper === lower ? 0.5 : (last - lower) / (upper - lower) };
}
function atr(bars, period = 14) {
    if (bars.length < period + 1)
        return null;
    const trs = [];
    for (let i = 1; i < bars.length; i++) {
        trs.push(Math.max(bars[i].high - bars[i].low, Math.abs(bars[i].high - bars[i - 1].close), Math.abs(bars[i].low - bars[i - 1].close)));
    }
    const recent = trs.slice(-period);
    return recent.reduce((a, b) => a + b, 0) / recent.length;
}
// Unusual-volume detector over REAL volumes only. Compares the latest volume
// against the mean of the previous N sessions. Returns null when fewer than
// `minSamples` real (non-null) volumes exist — never estimates.
function volumeStats(volumes, period = 20, minSamples = 10) {
    const hist = volumes.slice(0, -1).filter((v) => typeof v === "number" && v > 0).slice(-period);
    const latest = volumes[volumes.length - 1];
    if (typeof latest !== "number" || latest <= 0 || hist.length < minSamples)
        return null;
    const avg = hist.reduce((a, b) => a + b, 0) / hist.length;
    if (!(avg > 0))
        return null;
    return { latest, avg, ratio: latest / avg };
}
