import {
  projectionEvents, milestoneEvents, UNAVAILABLE_TYPES, CALENDAR_CONTRACT,
} from "../src/market/calendar";

const NOW = new Date("2026-09-09T12:00:00Z").getTime();
const DAY = 24 * 3600 * 1000;
const iso = (ts: number) => new Date(ts).toISOString();

describe("projectionEvents", () => {
  it("includes windows ending within the horizon", () => {
    const out = projectionEvents(
      [{ id: "a", symbol: "TCS", asOf: iso(NOW - 20 * DAY), central: 100, low: 90, high: 110 }],
      14, NOW
    );
    expect(out).toHaveLength(1);
    expect(out[0].date).toBe("2026-09-19");
    expect(out[0].source).toBe("forecast-store");
  });
  it("excludes ended windows and far-future windows", () => {
    const out = projectionEvents(
      [
        { id: "old", symbol: "TCS", asOf: iso(NOW - 40 * DAY), central: 1, low: 1, high: 1 },
        { id: "new", symbol: "TCS", asOf: iso(NOW - 1 * DAY), central: 1, low: 1, high: 1 },
      ],
      14, NOW
    );
    expect(out).toHaveLength(0);
  });
  it("skips records missing band values (never partial)", () => {
    const out = projectionEvents(
      [{ id: "b", symbol: "TCS", asOf: iso(NOW - 20 * DAY), central: null, low: 90, high: 110 }],
      14, NOW
    );
    expect(out).toHaveLength(0);
  });
});

describe("milestoneEvents", () => {
  it("flags within-1% band edges only", () => {
    const out = milestoneEvents(
      [
        { symbol: "A", price: 995, week52High: 1000, week52Low: 500 },
        { symbol: "B", price: 505, week52High: 1000, week52Low: 500 },
        { symbol: "C", price: 700, week52High: 1000, week52Low: 500 },
        { symbol: "D", price: null, week52High: 1000, week52Low: 500 },
      ],
      NOW
    );
    expect(out.map((e) => e.kind).sort()).toEqual(["milestone-high", "milestone-low"]);
    expect(out[0].date).toBe("2026-09-09");
    expect(out[0].source).toBe("live-quotes");
  });
});

describe("contract", () => {
  it("declares unfed types without inventing feeds", () => {
    expect([...UNAVAILABLE_TYPES]).toEqual(["results", "dividends", "ipos", "bonus-split", "economic"]);
    expect(CALENDAR_CONTRACT).toMatch(/licensed feed/);
  });
});
