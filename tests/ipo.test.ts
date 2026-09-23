import {
  parseNseDate, parsePriceBand, classifyStatus, normalizeIpo, normalizeBids, deriveTimelineDates, buildTimeline,
} from "../src/market/ipo.service";

describe("parseNseDate", () => {
  it("parses NSE day-Mon-year", () => {
    expect(parseNseDate("09-Sep-2026")).toBe("2026-09-09");
    expect(parseNseDate("7-Jan-2025")).toBe("2025-01-07");
  });
  it("returns null, never guesses", () => {
    expect(parseNseDate("")).toBeNull();
    expect(parseNseDate(null)).toBeNull();
    expect(parseNseDate("09/09/2026")).toBeNull();
    expect(parseNseDate("09-Xyz-2026")).toBeNull();
  });
});

describe("parsePriceBand", () => {
  it("extracts low/high", () => {
    expect(parsePriceBand("Rs.139 to Rs.146")).toEqual({ low: 139, high: 146 });
    expect(parsePriceBand("Rs.500")).toEqual({ low: 500, high: 500 });
  });
  it("returns nulls when absent", () => {
    expect(parsePriceBand(undefined)).toEqual({ low: null, high: null });
    expect(parsePriceBand("TBD")).toEqual({ low: null, high: null });
  });
});

describe("classifyStatus", () => {
  const now = new Date("2026-09-09T12:00:00Z").getTime();
  it("classifies by window and listing date", () => {
    expect(classifyStatus("2026-09-09", "2026-09-11", "2026-09-16", "Active", now)).toBe("open");
    expect(classifyStatus("2026-09-10", "2026-09-12", "2026-09-17", "Active", now)).toBe("upcoming");
    expect(classifyStatus("2026-09-01", "2026-09-05", "2026-09-10", "Active", now)).toBe("closed");
    expect(classifyStatus("2024-09-01", "2024-09-05", "2024-09-10", "Active", now)).toBe("listed");
  });
});

describe("deriveTimelineDates & buildTimeline", () => {
  it("derives T+3 milestone dates from issue dates", () => {
    const dates = deriveTimelineDates("2026-09-09", "2026-09-11");
    expect(dates.allotmentDate).toBe("2026-09-12");
    expect(dates.listingDate).toBe("2026-09-14");
  });

  it("builds timeline steps with status", () => {
    const now = new Date("2026-09-10T12:00:00Z").getTime();
    const steps = buildTimeline("2026-09-09", "2026-09-11", "2026-09-12", "2026-09-13", "2026-09-13", "2026-09-16", now);
    expect(steps.length).toBe(6);
    expect(steps.find((s) => s.key === "open")?.status).toBe("completed");
    expect(steps.find((s) => s.key === "close")?.status).toBe("upcoming");
  });
});

describe("normalizeIpo", () => {
  it("maps a live NSE row with verified prospectus enrichment", () => {
    const ipo = normalizeIpo({
      symbol: "LCCPROJECT", companyName: "LCC Projects Limited",
      issueStartDate: "09-Sep-2026", issueEndDate: "11-Sep-2026",
      issuePrice: "Rs.139 to Rs.146", issueSize: "20927281",
      status: "Active", series: "EQ", noOfTime: "1.123",
    }, new Date("2026-09-09T12:00:00Z").getTime());
    expect(ipo?.symbol).toBe("LCCPROJECT");
    expect(ipo?.openDate).toBe("2026-09-09");
    expect(ipo?.priceLow).toBe(139);
    expect(ipo?.priceHigh).toBe(146);
    expect(ipo?.lotSize).toBe(100);
    expect(ipo?.minInvestment).toBe(14600);
    expect(ipo?.subscription).toBeCloseTo(1.123, 3);
    expect(ipo?.status).toBe("open");
    expect(ipo?.segment).toBe("Mainboard");
    expect(ipo?.timeline.length).toBe(6);
  });

  it("drops rows without symbols, handles SME flags", () => {
    expect(normalizeIpo({ companyName: "X" })).toBeNull();
    const sme = normalizeIpo({ symbol: "VINOD", series: "SME", isBse: "1" });
    expect(sme?.segment).toBe("SME");
  });
});

describe("normalizeBids", () => {
  it("keeps total + main categories, drops header and empties", () => {
    const out = normalizeBids("LCCPROJECT", [
      { category: "Category", noOfSharesOffered: "No.of shares offered/reserved", noOfTime: "No. of times", noOfsharesBid: "No. of shares bid for", srNo: "Sr.No." },
      { category: "Qualified Institutional Buyers(QIBs)", noOfSharesOffered: "5854205", noOfTime: "1.13", noOfsharesBid: "6646116", srNo: "1" },
      { category: "Corporates", noOfSharesOffered: "", noOfTime: "", noOfsharesBid: "349350", srNo: "2.1(a)" },
      { category: "Total", noOfSharesOffered: "2.09E7", noOfTime: "1.12", noOfsharesBid: "2.35E7", srNo: null },
    ], "Updated as on 09-Sep-2026 17:00:37 hrs");
    expect(out.total).toBeCloseTo(1.12, 2);
    expect(out.updateTime).toMatch(/09-Sep-2026/);
    expect(out.categories.map((c) => c.name)).toEqual(["Qualified Institutional Buyers(QIBs)"]);
  });
});
