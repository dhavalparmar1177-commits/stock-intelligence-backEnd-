import { demandPoints, structurePoints, scoreIpo } from "../src/market/ipo-ai";

describe("demandPoints", () => {
  it("maps bands, null stays null", () => {
    expect(demandPoints(87)).toBe(100);
    expect(demandPoints(8)).toBe(70);
    expect(demandPoints(3)).toBe(60);
    expect(demandPoints(1.2)).toBe(50);
    expect(demandPoints(0.7)).toBe(30);
    expect(demandPoints(0.1)).toBe(15);
    expect(demandPoints(null)).toBeNull();
    expect(demandPoints(NaN)).toBeNull();
  });
});

describe("structurePoints", () => {
  it("rates high fresh issue capital ratio favorably", () => {
    expect(structurePoints(800, 200)).toBe(90);
    expect(structurePoints(0, 1000)).toBe(35);
    expect(structurePoints(null, null)).toBeNull();
  });
});

describe("scoreIpo", () => {
  it("scores strong demand high with documented bands", () => {
    const r = scoreIpo({ symbol: "X", totalMultiple: 87, riiMultiple: 50, qibMultiple: 30, freshIssueCr: 500, ofsIssueCr: 0 });
    expect(r.score).toBeGreaterThanOrEqual(85);
    expect(r.verdict).toBe("research");
    expect(r.verdictTitle).toBe("Worth Researching");
  });

  it("renormalizes over available categories only", () => {
    const r = scoreIpo({ symbol: "X", totalMultiple: 3 });
    expect(r.score).toBe(60);
  });

  it("returns null score with no demand data (never guesses)", () => {
    const r = scoreIpo({ symbol: "X" });
    expect(r.score).toBeNull();
    expect(r.verdict).toBeNull();
    expect(r.confidence).toBeNull();
  });

  it("flags real risks and red flags", () => {
    const r = scoreIpo({ symbol: "X", totalMultiple: 0.2, riiMultiple: 0.1, series: "SME", priceLow: null, priceHigh: null });
    expect(r.verdict).toBe("skip");
    expect(r.redFlags.length).toBeGreaterThanOrEqual(2);
    expect(r.risks.some((x) => /SME/.test(x))).toBe(true);
  });
});
