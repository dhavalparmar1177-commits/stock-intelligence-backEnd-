import { sma, rsi, ema, macd, bollinger, atr, volumeStats } from "../src/utils/indicators";
import { scoreSentiment } from "../src/market/sentiment";
import { resolveLang, STR } from "../src/market/lang";
import { parseScreenQuery } from "../src/market/screenQuery";
import { resolveIndian } from "../src/market/nse";
describe("indicators", () => {
  it("sma computes average", () => { expect(sma([1,2,3,4,5], 3)).toBeCloseTo(4); });
  it("rsi returns null with too few points", () => { expect(rsi([1,2,3])).toBeNull(); });
  it("rsi all gains = 100", () => { expect(rsi(Array.from({length:16},(_,i)=>i+1))).toBe(100); });
  it("ema of constant series equals the constant", () => { expect(ema(new Array(30).fill(10), 12)).toBeCloseTo(10); });
  it("ema returns null with too few points", () => { expect(ema([1,2], 12)).toBeNull(); });
  it("macd positive on steady uptrend", () => {
    const closes = Array.from({ length: 60 }, (_, i) => 100 + i);
    const m = macd(closes);
    expect(m).not.toBeNull();
    expect(m!.dif).toBeGreaterThan(0);
  });
  it("bollinger mid equals sma and bands contain price", () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i) * 2);
    const b = bollinger(closes, 20, 2);
    expect(b).not.toBeNull();
    expect(b!.lower).toBeLessThan(b!.mid);
    expect(b!.upper).toBeGreaterThan(b!.mid);
  });
  it("atr positive on typical bars", () => {
    const bars = Array.from({ length: 20 }, (_, i) => ({ high: 102 + i, low: 99 + i, close: 101 + i }));
    expect(atr(bars, 14)).toBeGreaterThan(0);
  });
});
describe("nse guard", () => {
  it("accepts NSE app symbols and tickers", () => {
    expect(resolveIndian("TCS").yahoo).toBe("TCS.NS");
    expect(resolveIndian("RELIANCE.NS").exchange).toBe("NSE");
    expect(resolveIndian("INFY.BO").exchange).toBe("BSE");
  });
  it("rejects US/international symbols", () => {
    expect(() => resolveIndian("AAPL")).toThrow("Only NSE and BSE");
    expect(() => resolveIndian("NVDA")).toThrow("Only NSE and BSE");
    expect(() => resolveIndian("MSFT")).toThrow("Only NSE and BSE");
  });
});
describe("volume", () => {
  it("detects 2.8x unusual volume", () => {
    const vols = [...new Array(20).fill(1_000_000), 2_800_000];
    const v = volumeStats(vols, 20);
    expect(v).not.toBeNull();
    expect(v!.ratio).toBeCloseTo(2.8);
  });
  it("returns null with too few real volumes", () => {
    expect(volumeStats([null, null, 5], 20)).toBeNull();
  });
});
describe("sentiment", () => {
  it("scores bullish headlines positive", () => {
    const s = scoreSentiment(["Company posts record profit growth, upgrades guidance"]);
    expect(s).not.toBeNull();
    expect(s!.label).toBe("Positive");
  });
  it("scores bearish headlines negative", () => {
    const s = scoreSentiment(["Regulator probe, company warns of loss and downgrade"]);
    expect(s).not.toBeNull();
    expect(s!.label).toBe("Negative");
  });
  it("returns null with no headlines", () => {
    expect(scoreSentiment([])).toBeNull();
  });
});
describe("ai language", () => {
  it("defaults to English", () => {
    expect(resolveLang(undefined)).toBe("en");
    expect(resolveLang("fr")).toBe("en");
  });
  it("resolves hi/gu", () => {
    expect(resolveLang("hi")).toBe("hi");
    expect(resolveLang("gu")).toBe("gu");
  });
  it("Hindi keeps symbols and numbers untranslated", () => {
    const s = STR.hi.insufficient("TCS", 12, 60);
    expect(s).toContain("TCS");
    expect(s).toContain("12");
    expect(s).not.toBe(STR.en.insufficient("TCS", 12, 60));
  });
  it("translates signals and trends", () => {
    expect(STR.gu.signal("BUY")).toBe("ખરીદો");
    expect(STR.hi.trend("Bullish")).toBe("तेजी");
    expect(STR.gu.risk("HIGH")).toBe("ઉચ્ચ");
  });
});
describe("screen parser", () => {
  it("maps momentum/volume/sector queries", () => {
    expect(parseScreenQuery("Find high momentum stocks")).toEqual({ preset: "momentum" });
    expect(parseScreenQuery("stocks with unusual volume")).toEqual({ preset: "volume" });
    expect(parseScreenQuery("Find strong IT stocks")).toEqual({ preset: "sector", sector: "IT" });
    expect(parseScreenQuery("calm defensive stocks")).toEqual({ preset: "calm" });
    expect(parseScreenQuery("oversold bounce candidates")).toEqual({ preset: "oversold" });
  });
  it("rejects fundamentals-based queries without inventing", () => {
    expect(parseScreenQuery("Find undervalued stocks")).toEqual({ error: "fundamentals" });
    expect(parseScreenQuery("Find fundamentally strong Indian stocks")).toEqual({ error: "fundamentals" });
  });
  it("rejects unmappable queries", () => {
    expect(parseScreenQuery("asdfgh")).toEqual({ error: "unknown" });
    expect(parseScreenQuery("")).toEqual({ error: "unknown" });
  });
});
