"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scoreSentiment = scoreSentiment;
// Transparent keyword-based news sentiment over REAL headlines only.
// Method: count positive/negative cue words in title+summary; no ML, no invented
// sentiment. Returns null when there is nothing to score.
const POSITIVE = [
    "gain", "gains", "rises", "rise", "surge", "surges", "jumps", "jump", "record",
    "profit", "growth", "upgrade", "upgrades", "approval", "approves", "deal", "partner",
    "beats", "beat", "strong", "bullish", "rally", "high", "dividend", "bonus",
    "expansion", "launch", "order win", "breakthrough",
];
const NEGATIVE = [
    "falls", "fall", "drops", "drop", "plunge", "slump", "loss", "losses", "downgrade",
    "downgrades", "probe", "fine", "penalty", "cut", "cuts", "warning", "bearish",
    "misses", "miss", "weak", "lawsuit", "fraud", "default", "layoff", "crash",
    "concern", "risk", "probe", "scam",
];
function scoreSentiment(texts) {
    const usable = texts.filter((t) => t && t.trim().length > 0);
    if (!usable.length)
        return null;
    let pos = 0, neg = 0;
    for (const t of usable) {
        const low = ` ${t.toLowerCase()} `;
        for (const w of POSITIVE)
            if (low.includes(w)) {
                pos++;
                break;
            }
        for (const w of NEGATIVE)
            if (low.includes(w)) {
                neg++;
                break;
            }
    }
    const score = Math.max(0, Math.min(100, 50 + (pos - neg) * 12));
    return {
        score,
        label: score >= 60 ? "Positive" : score <= 40 ? "Negative" : "Neutral",
        positive: pos,
        negative: neg,
        counted: usable.length,
    };
}
