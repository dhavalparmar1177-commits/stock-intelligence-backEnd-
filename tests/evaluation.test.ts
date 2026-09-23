import {
  ageBucket, signalBucket, confBand, niftyAt, evaluateRecord,
  summarize, detectLeakage, EvalRecord,
} from "../src/market/evaluation";

const NOW = new Date("2026-09-09T12:00:00Z").getTime();
const daysAgo = (n: number) => new Date(NOW - n * 24 * 3600 * 1000).toISOString();

const rec = (over: Partial<EvalRecord> = {}): EvalRecord => ({
  id: "t1", symbol: "RELIANCE", asOf: daysAgo(10), priceAtTime: 1000,
  central: 1050, low: 950, high: 1150, expectedPct: 5, score: 70,
  signal: "BUY", trend: "Bullish", confidence: 75, ...over,
});

describe("ageBucket", () => {
  it("returns null under 24h", () => {
    expect(ageBucket(new Date(NOW - 3600 * 1000).toISOString(), NOW)).toBeNull();
  });
  it("buckets 7/30/90/older", () => {
    expect(ageBucket(daysAgo(3), NOW)).toBe("d7");
    expect(ageBucket(daysAgo(20), NOW)).toBe("d30");
    expect(ageBucket(daysAgo(60), NOW)).toBe("d90");
    expect(ageBucket(daysAgo(120), NOW)).toBe("older");
  });
  it("rejects future timestamps", () => {
    expect(ageBucket(new Date(NOW + 3600 * 1000).toISOString(), NOW)).toBeNull();
  });
});

describe("signalBucket", () => {
  it("maps en + hi + gu signals", () => {
    expect(signalBucket("BUY")).toBe("BUY");
    expect(signalBucket("बेचें")).toBe("SELL");
    expect(signalBucket("હોલ્ડ")).toBe("HOLD");
    expect(signalBucket("???")).toBe("OTHER");
  });
});

describe("confBand", () => {
  it("bands 70/50 thresholds, null stays null", () => {
    expect(confBand(80)).toBe("high");
    expect(confBand(70)).toBe("high");
    expect(confBand(60)).toBe("med");
    expect(confBand(40)).toBe("low");
    expect(confBand(null)).toBeNull();
    expect(confBand("x")).toBeNull();
  });
});

describe("niftyAt", () => {
  const pts = [
    { date: "2026-08-01T00:00:00Z", close: 100 },
    { date: "2026-08-05T00:00:00Z", close: 110 },
  ];
  it("picks closest close at or before ts, never after", () => {
    expect(niftyAt(pts, new Date("2026-08-03T00:00:00Z").getTime())).toBe(100);
    expect(niftyAt(pts, new Date("2026-08-05T00:00:00Z").getTime())).toBe(110);
    expect(niftyAt(pts, new Date("2026-07-01T00:00:00Z").getTime())).toBeNull();
    expect(niftyAt([], NOW)).toBeNull();
  });
});

describe("evaluateRecord", () => {
  const nifty = [
    { date: daysAgo(11), close: 200 },
    { date: daysAgo(1), close: 210 },
  ];
  it("evaluates a 10-day-old record with benchmark", () => {
    const r = evaluateRecord(rec(), 1060, nifty, NOW);
    expect(r).not.toBeNull();
    expect(r!.bucket).toBe("d30");
    expect(r!.signal).toBe("BUY");
    expect(r!.actualPct).toBeCloseTo(6, 1);
    expect(r!.directionHit).toBe(true); // +5 vs +1.5 band, +6 vs +2 band
    expect(r!.niftyPct).toBeCloseTo(5, 1);
    expect(r!.beatNifty).toBe(true);
    expect(r!.confBand).toBe("high");
  });
  it("returns null for fresh records and bad prices", () => {
    expect(evaluateRecord(rec({ asOf: daysAgo(0.5) }), 1060, nifty, NOW)).toBeNull();
    expect(evaluateRecord(rec(), null, nifty, NOW)).toBeNull();
    expect(evaluateRecord(rec({ priceAtTime: 0 }), 1060, nifty, NOW)).toBeNull();
  });
  it("marks direction miss honestly", () => {
    const r = evaluateRecord(rec({ expectedPct: 5 }), 900, nifty, NOW);
    expect(r!.directionHit).toBe(false);
  });
});

describe("summarize", () => {
  it("returns nulls, never zeros, for empty sets", () => {
    const s = summarize([]);
    expect(s.count).toBe(0);
    expect(s.accuracyPct).toBeNull();
    expect(s.avgErrorPct).toBeNull();
  });
  it("aggregates hits, errors, returns, benchmark", () => {
    const rows = [
      evaluateRecord(rec({ id: "a", expectedPct: 5 }), 1060, [], NOW)!,
      evaluateRecord(rec({ id: "b", expectedPct: -5 }), 1060, [], NOW)!,
    ];
    const s = summarize(rows);
    expect(s.count).toBe(2);
    expect(s.hits).toBe(1);
    expect(s.accuracyPct).toBe(50);
    expect(s.meanExpectedPct).toBe(0);
    expect(s.meanNiftyPct).toBeNull();
    expect(s.beatNiftyPct).toBeNull();
  });
});

describe("detectLeakage", () => {
  it("flags data timestamps after prediction time", () => {
    const out = detectLeakage(
      [{ id: "x", symbol: "TCS", asOf: daysAgo(5), dataTime: daysAgo(4) }],
      {}
    );
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe("data_after_prediction");
  });
  it("flags projection dates at or before prediction time", () => {
    const out = detectLeakage(
      [{ id: "y", symbol: "TCS", asOf: daysAgo(5) }],
      { y: [daysAgo(6), daysAgo(4)] }
    );
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe("projection_before_prediction");
  });
  it("passes clean records", () => {
    expect(
      detectLeakage([{ id: "z", symbol: "TCS", asOf: daysAgo(5), dataTime: daysAgo(5) }], { z: [daysAgo(4)] })
    ).toHaveLength(0);
  });
});
