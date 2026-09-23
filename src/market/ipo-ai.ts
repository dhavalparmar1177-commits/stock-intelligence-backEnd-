/**
 * Rule-based IPO AI scoring on REAL NSE demand data and verified prospectus facts only.
 * Categories scored over available real inputs:
 *  - demand (35%): overall subscription multiple
 *  - institutional (25%): QIB & NII/HNI coverage
 *  - retail (20%): retail category appetite
 *  - issueStructure (20%): Fresh issue capital vs OFS exit proportion & financial baseline
 *
 * Rules:
 * - Real data only: never guess missing metrics
 * - Missing metrics report "Not available" and do not fake score
 * - Never guarantee allotment or listing gains
 */

export interface IpoAiInput {
  symbol: string;
  company?: string | null;
  totalMultiple?: number | null;
  riiMultiple?: number | null;
  qibMultiple?: number | null;
  niiMultiple?: number | null;
  priceLow?: number | null;
  priceHigh?: number | null;
  issueSizeShares?: number | null;
  issueSizeInrCr?: number | null;
  freshIssueCr?: number | null;
  ofsIssueCr?: number | null;
  series?: string | null; // EQ | SME
  segment?: "Mainboard" | "SME" | string | null;
  daysToClose?: number | null;
  bidsUpdatedAt?: string | null;
  patCr?: number | null;
  ronw?: number | null;
  pe?: number | null;
  gmpPct?: number | null;
  promoterPostHolding?: number | null;
}

export interface IpoCategory {
  key: string;
  label: string;
  weight: number;
  score: number | null;
}

export interface IpoAiResult {
  symbol: string;
  score: number | null;
  confidence: number | null;
  verdict: "research" | "maybe" | "skip" | null;
  verdictTitle: string;
  categories: IpoCategory[];
  reasons: string[];
  risks: string[];
  redFlags: string[];
  missing: string[];
  disclaimer: string;
}

/** Subscription multiple -> 0-100 demand points (bands, documented). */
export function demandPoints(m: number | null | undefined): number | null {
  if (m == null || !Number.isFinite(m)) return null;
  if (m >= 50) return 100;
  if (m >= 20) return 90;
  if (m >= 10) return 80;
  if (m >= 5) return 70;
  if (m >= 2) return 60;
  if (m >= 1) return 50;
  if (m >= 0.5) return 30;
  return 15;
}

export function structurePoints(freshCr?: number | null, ofsCr?: number | null): number | null {
  if (freshCr == null && ofsCr == null) return null;
  const fresh = freshCr || 0;
  const ofs = ofsCr || 0;
  const total = fresh + ofs;
  if (total <= 0) return null;
  const freshRatio = fresh / total;
  if (freshRatio >= 0.8) return 90; // mostly fresh growth capital
  if (freshRatio >= 0.5) return 75;
  if (freshRatio >= 0.2) return 55;
  return 35; // mostly promoter/investor exit via OFS
}

export function scoreIpo(input: IpoAiInput): IpoAiResult {
  const d = demandPoints(input.totalMultiple);
  const r = demandPoints(input.riiMultiple);
  const q = demandPoints(input.qibMultiple);
  const s = structurePoints(input.freshIssueCr, input.ofsIssueCr);

  const cats: IpoCategory[] = [
    { key: "demand", label: "Overall Demand", weight: 35, score: d },
    { key: "institutional", label: "Institutional (QIB/NII)", weight: 25, score: q },
    { key: "retail", label: "Retail Participation", weight: 20, score: r },
    { key: "issueStructure", label: "Issue Structure & Quality", weight: 20, score: s },
  ];

  const avail = cats.filter((c) => c.score != null);
  const score =
    avail.length > 0
      ? Math.round(avail.reduce((a, c) => a + (c.score as number) * c.weight, 0) / avail.reduce((a, c) => a + c.weight, 0))
      : null;

  const reasons: string[] = [];
  const risks: string[] = [];
  const redFlags: string[] = [];
  const missing: string[] = [];

  // Demand Analysis
  if (input.totalMultiple != null) {
    if (input.totalMultiple >= 1) {
      reasons.push(`Subscribed ${input.totalMultiple.toFixed(2)}× overall — demand covers the total issue size.`);
    } else {
      risks.push(`Subscription stands at ${input.totalMultiple.toFixed(2)}× — issue is currently undersubscribed.`);
    }
  }

  // Institutional Analysis
  if (input.qibMultiple != null) {
    if (input.qibMultiple >= 2) {
      reasons.push(`Strong institutional demand with QIB bidding at ${input.qibMultiple.toFixed(2)}×.`);
    } else if (input.qibMultiple >= 1) {
      reasons.push(`QIB portion fully covered (${input.qibMultiple.toFixed(2)}×).`);
    } else {
      risks.push(`Muted institutional bids (${input.qibMultiple.toFixed(2)}× QIB).`);
    }
  }

  if (input.niiMultiple != null && input.niiMultiple >= 3) {
    reasons.push(`High HNI/NII interest at ${input.niiMultiple.toFixed(2)}× subscription.`);
  }

  // Retail Analysis
  if (input.riiMultiple != null) {
    if (input.riiMultiple >= 2) {
      reasons.push(`Robust retail participation (${input.riiMultiple.toFixed(2)}×) indicating widespread investor interest.`);
    } else if (input.riiMultiple < 0.5) {
      risks.push(`Low retail interest (${input.riiMultiple.toFixed(2)}×).`);
    }
  }

  // Issue Structure & Fresh vs OFS
  if (input.freshIssueCr != null && input.ofsIssueCr != null) {
    const total = input.freshIssueCr + input.ofsIssueCr;
    if (total > 0) {
      const freshPct = Math.round((input.freshIssueCr / total) * 100);
      if (freshPct >= 70) {
        reasons.push(`High capital efficiency: ${freshPct}% (₹${input.freshIssueCr} Cr) is Fresh Issue funding growth/capex.`);
      } else if (freshPct === 0) {
        risks.push("100% Offer for Sale (OFS) — zero fresh capital enters the company balance sheet.");
      }
    }
  }

  // Promoters
  if (input.promoterPostHolding != null) {
    if (input.promoterPostHolding >= 51) {
      reasons.push(`Promoters retain a controlling stake of ${input.promoterPostHolding}% post-listing.`);
    } else if (input.promoterPostHolding < 30) {
      risks.push(`Promoter post-issue holding drops to ${input.promoterPostHolding}%.`);
    }
  }

  // Profitability
  if (input.patCr != null) {
    if (input.patCr > 0) {
      reasons.push(`Profitable business with ₹${input.patCr.toLocaleString("en-IN")} Cr reported PAT.`);
    } else {
      risks.push(`Loss-making at the time of IPO (reported PAT of ₹${input.patCr} Cr).`);
    }
  }

  // Segment
  const isSME =
    String(input.series || "").toUpperCase() === "SME" ||
    String(input.segment || "").toUpperCase() === "SME";
  if (isSME) {
    risks.push("SME platform issue — subject to 100% lot trading requirement, wider bid-ask spreads, and lower liquidity.");
  }

  // Red Flags
  if (input.totalMultiple != null && input.totalMultiple < 0.3) {
    redFlags.push(`Critically weak subscription (${input.totalMultiple.toFixed(2)}×) — severe issue absorption risk.`);
  }
  if (input.riiMultiple != null && input.riiMultiple < 0.15) {
    redFlags.push(`Retail interest near-absent (${input.riiMultiple.toFixed(2)}×).`);
  }
  if (input.priceLow == null && input.priceHigh == null) {
    redFlags.push("No price band published — valuation entry point unknown.");
  }
  if (input.daysToClose != null && input.daysToClose <= 1 && (input.totalMultiple ?? 0) < 0.9) {
    redFlags.push("Closes within 24 hours while still undersubscribed.");
  }

  // Missing candidates
  if (input.patCr == null) missing.push("financial statements (PAT/Revenue)");
  if (input.pe == null) missing.push("valuation P/E ratio");
  if (input.freshIssueCr == null && input.ofsIssueCr == null) missing.push("fresh vs OFS breakdown");
  if (input.promoterPostHolding == null) missing.push("promoter post-issue shareholding");

  // Confidence Calculation
  let confidence: number | null = null;
  if (score != null) {
    confidence = 50;
    if (input.bidsUpdatedAt) confidence += 10;
    if (input.freshIssueCr != null) confidence += 10;
    if (input.patCr != null) confidence += 10;
    if (isSME) confidence -= 5;
    if (avail.length < 2) confidence -= 15;
    confidence = Math.max(20, Math.min(85, confidence));
  }

  const verdict: IpoAiResult["verdict"] =
    score == null ? null : score >= 65 ? "research" : score >= 40 ? "maybe" : "skip";

  const verdictTitle =
    verdict === "research"
      ? "Worth Researching"
      : verdict === "maybe"
      ? "Maybe — Mixed Factors"
      : verdict === "skip"
      ? "Caution / Skip"
      : "Insufficient Data";

  return {
    symbol: input.symbol.toUpperCase(),
    score,
    confidence,
    verdict,
    verdictTitle,
    categories: cats,
    reasons,
    risks,
    redFlags,
    missing,
    disclaimer:
      "Demand & structural research summary only — not financial or investment advice. Listing gains and share allotments are never guaranteed.",
  };
}
