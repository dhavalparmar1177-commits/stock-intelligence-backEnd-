"use strict";
/**
 * Rule-based IPO AI scoring on REAL NSE demand data only.
 * Scored categories (weights renormalized over available, like the
 * equity engine): demand 40, retail 25, institutional 20.
 * The information category (financials, RHP, promoters, GMP — weight
 * 15) is ALWAYS null: no feed publishes them, so they are excluded,
 * never estimated. Confidence is capped at 65 for the same reason.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.demandPoints = demandPoints;
exports.scoreIpo = scoreIpo;
/** Subscription multiple -> 0-100 demand points (bands, documented). */
function demandPoints(m) {
    if (m == null || !Number.isFinite(m))
        return null;
    if (m >= 20)
        return 100;
    if (m >= 5)
        return 80;
    if (m >= 2)
        return 65;
    if (m >= 1)
        return 50;
    if (m >= 0.5)
        return 30;
    return 15;
}
const MISSING = [
    "financials (revenue, profit, margins)",
    "debt and balance-sheet ratios",
    "valuation multiples (no listed price yet)",
    "fresh-issue vs OFS split",
    "promoter holding and background",
    "RHP/DRHP documents",
    "GMP (no licensed feed)",
];
function scoreIpo(input) {
    const d = demandPoints(input.totalMultiple);
    const r = demandPoints(input.riiMultiple);
    const q = demandPoints(input.qibMultiple);
    const cats = [
        { key: "demand", weight: 40, score: d },
        { key: "retail", weight: 25, score: r },
        { key: "institutional", weight: 20, score: q },
        { key: "information", weight: 15, score: null },
    ];
    const avail = cats.filter((c) => c.score != null);
    const score = avail.length > 0
        ? Math.round(avail.reduce((a, c) => a + c.score * c.weight, 0) / avail.reduce((a, c) => a + c.weight, 0))
        : null;
    const reasons = [];
    const risks = [];
    const redFlags = [];
    if (input.totalMultiple != null) {
        reasons.push(input.totalMultiple >= 1
            ? `Subscribed ${input.totalMultiple.toFixed(2)}× overall — demand covers the issue.`
            : `Subscribed only ${input.totalMultiple.toFixed(2)}× overall — demand is short of the issue size.`);
        if (input.totalMultiple < 1)
            risks.push("Undersubscription at last update — the issue may struggle to fill.");
    }
    if (input.riiMultiple != null) {
        (input.riiMultiple >= 1 ? reasons : risks).push(`Retail participation ${input.riiMultiple.toFixed(2)}×${input.riiMultiple >= 1 ? " shows" : " lacks"} broad investor interest.`);
    }
    if (input.qibMultiple != null && input.qibMultiple >= 1) {
        reasons.push(`Institutional bids ${input.qibMultiple.toFixed(2)}× indicate professional demand.`);
    }
    if (input.niiMultiple != null && input.niiMultiple >= 5) {
        reasons.push(`Strong HNI appetite at ${input.niiMultiple.toFixed(2)}×.`);
    }
    const isSME = String(input.series || "").toUpperCase() === "SME";
    if (isSME)
        risks.push("SME issue — typically lower liquidity and higher volatility after listing.");
    if (input.totalMultiple != null && input.totalMultiple < 0.5) {
        redFlags.push(`Critically low subscription (${input.totalMultiple.toFixed(2)}×) — withdrawal risk.`);
    }
    if (input.riiMultiple != null && input.riiMultiple < 0.3) {
        redFlags.push(`Retail interest near-absent (${input.riiMultiple.toFixed(2)}×).`);
    }
    if (input.priceLow == null || input.priceHigh == null) {
        redFlags.push("No price band published — valuation entry point unknown.");
    }
    if (input.daysToClose != null && input.daysToClose <= 1 && (input.totalMultiple ?? 0) < 1) {
        redFlags.push("Closes within a day while still undersubscribed.");
    }
    // Confidence: capped low — most analytical inputs are missing by construction.
    let confidence = null;
    if (score != null) {
        confidence = 45;
        if (input.bidsUpdatedAt)
            confidence += 5;
        if (isSME)
            confidence -= 5;
        if (avail.length < 3)
            confidence -= 10;
        confidence = Math.max(20, Math.min(65, confidence));
    }
    const verdict = score == null ? null : score >= 65 ? "research" : score >= 40 ? "maybe" : "skip";
    return { symbol: input.symbol.toUpperCase(), score, confidence, verdict, categories: cats, reasons, risks, redFlags, missing: [...MISSING] };
}
