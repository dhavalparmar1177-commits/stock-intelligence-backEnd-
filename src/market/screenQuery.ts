// Natural-language screen parser: maps plain-English queries to data-backed
// presets. Anything requiring fundamentals/valuation is rejected with a
// "fundamentals" error (never estimated); unmappable queries get "unknown".
export type ScreenPreset = "top" | "momentum" | "volume" | "sector" | "bullish" | "calm" | "oversold";
export interface ScreenIntent {
  preset: ScreenPreset;
  sector?: string;
}
export type ScreenParseError = "fundamentals" | "unknown";

const SECTORS: [RegExp, string][] = [
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

export function parseScreenQuery(query: string): ScreenIntent | { error: ScreenParseError } {
  const s = (query || "").toLowerCase();
  if (!s.trim()) return { error: "unknown" };
  if (/(undervalu|fundamental|dividend|cheap|p\/e|\beps\b|profitab|\bdebt\b|\broe\b|value\b|valuation|earnings|margin)/.test(s)) {
    return { error: "fundamentals" };
  }
  if (/volume|unusual|active|heavy/.test(s)) return { preset: "volume" };
  if (/momentum/.test(s)) return { preset: "momentum" };
  if (/oversold|bounce|\bdip\b/.test(s)) return { preset: "oversold" };
  if (/calm|stable|safe|low (volatility|risk)|defensive/.test(s)) return { preset: "calm" };
  for (const [re, sector] of SECTORS) {
    if (re.test(s)) return { preset: "sector", sector };
  }
  if (/bullish|strong|\btop\b|best|uptrend|outperform/.test(s)) return { preset: "bullish" };
  if (/find|show|suggest|screen|opportunit|idea|list|give/.test(s)) return { preset: "top" };
  return { error: "unknown" };
}
