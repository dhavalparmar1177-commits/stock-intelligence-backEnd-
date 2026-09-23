"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseScreenQuery = parseScreenQuery;
const SECTORS = [
    [/\bit\b|\btech(nology)?\b/, "IT"],
    [/bank|financ/, "Banking"],
    [/auto/, "Auto"],
    [/fmcg/, "FMCG"],
    [/energy|oil|power/, "Energy"],
    [/insur/, "Insurance"],
    [/telecom|airtel/, "Telecom"],
    [/infra|larsen/, "Infrastructure"],
    [/consumer|titan|fmcg/, "Consumer"],
];
function parseScreenQuery(query) {
    const s = (query || "").toLowerCase();
    if (!s.trim())
        return { error: "unknown" };
    if (/(undervalu|fundamental|dividend|cheap|p\/e|\beps\b|profitab|\bdebt\b|\broe\b|value\b|valuation|earnings|margin)/.test(s)) {
        return { error: "fundamentals" };
    }
    if (/volume|unusual|active|heavy/.test(s))
        return { preset: "volume" };
    if (/momentum/.test(s))
        return { preset: "momentum" };
    if (/oversold|bounce|\bdip\b/.test(s))
        return { preset: "oversold" };
    if (/calm|stable|safe|low (volatility|risk)|defensive/.test(s))
        return { preset: "calm" };
    for (const [re, sector] of SECTORS) {
        if (re.test(s))
            return { preset: "sector", sector };
    }
    if (/bullish|strong|\btop\b|best|uptrend|outperform/.test(s))
        return { preset: "bullish" };
    if (/find|show|suggest|screen|opportunit|idea|list|give/.test(s))
        return { preset: "top" };
    return { error: "unknown" };
}
