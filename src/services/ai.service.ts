import { aiRepo } from "../repositories/ai.repository";
import { stockRepo } from "../repositories/stock.repository";
import { ApiError } from "../utils/ApiError";

// Deterministic, explainable, rule-based "AI" over demo data — never invents external facts,
// labels output as analysis of available demo data, not investment advice.
export const aiService = {
  async analyze(symbol: string) {
    const s: any = await stockRepo.bySymbol(symbol);
    if (!s) throw new ApiError(404, "Stock not found");
    const f = s.fundamental || {};
    const q = s.quotes?.[0];
    const parts: string[] = [];
    parts.push(`${s.company?.name || symbol} (${s.symbol}) operates in ${s.company?.sector || "N/A"}${s.company?.industry ? " / " + s.company.industry : ""}.`);
    const strengths: string[] = [], risks: string[] = [];
    if ((f.roe ?? 0) > 15) strengths.push(`High ROE of ${f.roe}% indicates efficient use of equity.`);
    else risks.push(`ROE of ${f.roe ?? "N/A"}% suggests modest equity efficiency.`);
    if ((f.debtEquity ?? 1) < 0.5) strengths.push(`Low debt/equity (${f.debtEquity}) implies financial strength.`);
    else risks.push(`Debt/equity of ${f.debtEquity ?? "N/A"} warrants leverage monitoring.`);
    if ((f.revenueGrowth ?? 0) > 10) strengths.push(`Revenue growth of ${f.revenueGrowth}% shows momentum.`);
    else risks.push(`Revenue growth of ${f.revenueGrowth ?? "N/A"}% is subdued.`);
    if ((f.pe ?? 0) > 40) risks.push(`P/E of ${f.pe} implies rich valuation vs earnings.`);
    if ((f.rsi ?? 50) > 70) risks.push(`RSI ${f.rsi} suggests overbought short-term conditions.`);
    if ((f.rsi ?? 50) < 30) strengths.push(`RSI ${f.rsi} suggests possible oversold bounce setup (not a guarantee).`);
    const summary = parts.join(" ") + ` Last demo price ${q?.price ?? "N/A"} (${q?.changePct ?? "N/A"}%).`;
    const fundamental = `P/E ${f.pe ?? "N/A"}, P/B ${f.pb ?? "N/A"}, EPS ${f.eps ?? "N/A"}, ROE ${f.roe ?? "N/A"}%, ROCE ${f.roce ?? "N/A"}%, D/E ${f.debtEquity ?? "N/A"}. Revenue ${f.revenue ?? "N/A"}, profit ${f.profit ?? "N/A"}.`;
    const score = s.score;
    const scoreExplanation = score?.explanation || "Score blends valuation, growth, profitability, strength and technicals (see stock_scores.explanation).";
    const record = await aiRepo.create({ stockId: s.id, summary, fundamental, newsSummary: "Demo news sample summarized: mixed sentiment; see News tab.", risks: risks.join(" ") || "No major demo-data risks flagged.", strengths: strengths.join(" ") || "No standout demo-data strengths.", scoreExplanation });
    return { ...record, disclaimer: "Informational analysis of DEMO DATA only. Not investment advice; no returns guaranteed." };
  },
  latest: async (symbol: string) => {
    const s: any = await stockRepo.bySymbol(symbol);
    if (!s) throw new ApiError(404, "Stock not found");
    return aiRepo.latest(s.id);
  },
};
