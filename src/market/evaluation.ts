/**
 * Pure backtest evaluation helpers (no network, no DB).
 * Every function operates on stored forecast rows + known prices,
 * so results are unit-testable and never estimated.
 */

export interface EvalRecord {
  id: string;
  symbol: string;
  asOf: string | Date;
  priceAtTime: number;
  central: number;
  low: number;
  high: number;
  expectedPct: number;
  score: number | null;
  signal: string | null;
  trend: string | null;
  confidence: number | null;
  dataTime?: string | Date | null;
}

export type AgeBucket = "d7" | "d30" | "d90" | "older";
export type SignalBucket = "BUY" | "SELL" | "HOLD" | "OTHER";

const DAY = 24 * 3600 * 1000;

export function ageBucket(asOf: string | Date, now = Date.now()): AgeBucket | null {
  const age = now - new Date(asOf).getTime();
  if (!(age >= 0) || age < DAY) return null; // <24h: not evaluable (matches forecastHistory)
  if (age <= 7 * DAY) return "d7";
  if (age <= 30 * DAY) return "d30";
  if (age <= 90 * DAY) return "d90";
  return "older";
}

export function signalBucket(signal: unknown): SignalBucket {
  const s = String(signal || "").toUpperCase();
  if (s === "BUY" || s === "खरीदें" || s === "ખરીદો") return "BUY";
  if (s === "SELL" || s === "बेचें" || s === "વેચો") return "SELL";
  if (s === "HOLD" || s === "होल्ड" || s === "હોલ્ડ") return "HOLD";
  return "OTHER";
}

export function confBand(confidence: unknown): "high" | "med" | "low" | null {
  if (confidence === null || confidence === undefined) return null;
  const c = Number(confidence);
  if (!Number.isFinite(c)) return null;
  return c >= 70 ? "high" : c >= 50 ? "med" : "low";
}

const dir = (pct: number, band: number) => (pct > band ? "up" : pct < -band ? "down" : "flat");

export interface EvaluatedRow {
  id: string;
  symbol: string;
  asOf: string;
  ageDays: number;
  bucket: AgeBucket;
  signal: SignalBucket;
  expectedPct: number;
  actualPct: number | null;
  directionHit: boolean | null;
  errorPct: number | null;
  confidence: number | null;
  confBand: "high" | "med" | "low" | null;
  niftyPct: number | null;
  beatNifty: boolean | null;
}

export interface NiftyPoint {
  date: string;
  close: number;
}

/** Closest NIFTY close at or before a timestamp (never after — no lookahead). */
export function niftyAt(points: NiftyPoint[], ts: number): number | null {
  let best: NiftyPoint | null = null;
  for (const p of points) {
    const t = new Date(p.date).getTime();
    if (!(t <= ts)) continue;
    if (!best || t > new Date(best.date).getTime()) best = p;
  }
  return best && best.close > 0 ? best.close : null;
}

export function evaluateRecord(
  r: EvalRecord,
  actualPrice: number | null,
  nifty: NiftyPoint[],
  now = Date.now()
): EvaluatedRow | null {
  const bucket = ageBucket(r.asOf, now);
  if (bucket === null || bucket === "older") return null;
  if (actualPrice == null || !(actualPrice > 0) || !(r.priceAtTime > 0)) return null;
  const asOfTs = new Date(r.asOf).getTime();
  const actualPct = ((actualPrice - r.priceAtTime) / r.priceAtTime) * 100;
  const err = (Math.abs(r.central - actualPrice) / actualPrice) * 100;
  const n0 = niftyAt(nifty, asOfTs);
  const n1 = niftyAt(nifty, now);
  const niftyPct = n0 != null && n1 != null ? ((n1 - n0) / n0) * 100 : null;
  return {
    id: r.id,
    symbol: r.symbol,
    asOf: new Date(r.asOf).toISOString(),
    ageDays: Math.floor((now - asOfTs) / DAY),
    bucket,
    signal: signalBucket(r.signal),
    expectedPct: r.expectedPct,
    actualPct: Number(actualPct.toFixed(2)),
    directionHit: dir(r.expectedPct, 1.5) === dir(actualPct, 2),
    errorPct: Number(err.toFixed(1)),
    confidence: r.confidence,
    confBand: confBand(r.confidence),
    niftyPct: niftyPct != null ? Number(niftyPct.toFixed(2)) : null,
    beatNifty: niftyPct != null ? actualPct > niftyPct : null,
  };
}

export interface BucketStats {
  count: number;
  hits: number | null;
  accuracyPct: number | null;
  avgErrorPct: number | null;
  meanExpectedPct: number | null;
  meanActualPct: number | null;
  meanNiftyPct: number | null;
  beatNiftyPct: number | null;
}

function avg(xs: (number | null)[]): number | null {
  const v = xs.filter((x): x is number => typeof x === "number" && Number.isFinite(x));
  if (!v.length) return null;
  return Number((v.reduce((a, b) => a + b, 0) / v.length).toFixed(2));
}

export function summarize(rows: EvaluatedRow[]): BucketStats {
  if (!rows.length) {
    return {
      count: 0, hits: null, accuracyPct: null, avgErrorPct: null,
      meanExpectedPct: null, meanActualPct: null, meanNiftyPct: null, beatNiftyPct: null,
    };
  }
  const hits = rows.filter((r) => r.directionHit === true).length;
  const beats = rows.filter((r) => r.beatNifty === true).length;
  const withNifty = rows.filter((r) => r.beatNifty !== null).length;
  return {
    count: rows.length,
    hits,
    accuracyPct: Number(((hits / rows.length) * 100).toFixed(1)),
    avgErrorPct: avg(rows.map((r) => r.errorPct)),
    meanExpectedPct: avg(rows.map((r) => r.expectedPct)),
    meanActualPct: avg(rows.map((r) => r.actualPct)),
    meanNiftyPct: avg(rows.map((r) => r.niftyPct)),
    beatNiftyPct: withNifty ? Number(((beats / withNifty) * 100).toFixed(1)) : null,
  };
}

export interface LeakageIssue {
  id: string;
  symbol: string;
  type: "data_after_prediction" | "projection_before_prediction";
  detail: string;
}

/**
 * Future-data leakage checks on stored rows + their projections.
 * - dataTime (exchange quote timestamp) must be <= asOf.
 * - projection dates must be > asOf.
 */
export function detectLeakage(
  records: { id: string; symbol: string; asOf: string | Date; dataTime?: string | Date | null }[],
  projections: Record<string, string[]>
): LeakageIssue[] {
  const out: LeakageIssue[] = [];
  for (const r of records) {
    const asOf = new Date(r.asOf).getTime();
    if (r.dataTime) {
      const dt = new Date(r.dataTime).getTime();
      if (Number.isFinite(dt) && Number.isFinite(asOf) && dt > asOf + 60 * 1000) {
        out.push({
          id: r.id, symbol: r.symbol, type: "data_after_prediction",
          detail: `dataTime ${new Date(dt).toISOString()} is after asOf ${new Date(asOf).toISOString()}`,
        });
      }
    }
    for (const d of projections[r.id] || []) {
      const t = new Date(d).getTime();
      if (Number.isFinite(t) && Number.isFinite(asOf) && t <= asOf) {
        out.push({
          id: r.id, symbol: r.symbol, type: "projection_before_prediction",
          detail: `projection date ${d} is not after asOf`,
        });
      }
    }
  }
  return out;
}
