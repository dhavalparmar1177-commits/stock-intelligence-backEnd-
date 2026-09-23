/**
 * Market calendar derivation (pure — no network, no DB).
 * Only two item kinds are derivable from real system data:
 *  - AI projection windows from stored ForecastRecords (asOf + 30d).
 *  - 52-week milestones from a live quotes batch (within 1% of band).
 * Earnings, dividends, IPOs, splits/bonus and economic events have NO
 * free feed (Yahoo quoteSummary 401, NSE calendar 403) and are
 * therefore reported unavailable — never synthesized.
 */

export type CalendarKind =
  | "projection"
  | "milestone-high"
  | "milestone-low";

export interface CalendarQuote {
  symbol: string;
  name?: string | null;
  price?: number | null;
  week52High?: number | null;
  week52Low?: number | null;
  marketTime?: string | null;
}

export interface CalendarRecord {
  id: string;
  symbol: string;
  asOf: string | Date;
  central: number | null;
  low: number | null;
  high: number | null;
}

export interface CalendarEvent {
  id: string;
  kind: CalendarKind;
  symbol: string;
  name?: string | null;
  date: string; // ISO — the calendar day this belongs to
  title: string;
  detail: string | null;
  source: "forecast-store" | "live-quotes";
  observedAt: string; // when the underlying data was timestamped
}

const DAY = 24 * 3600 * 1000;

function isoDay(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

/** Projection windows ending within the next `horizonDays` (default 14). */
export function projectionEvents(
  records: CalendarRecord[],
  horizonDays = 14,
  now = Date.now()
): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  for (const r of records) {
    const asOf = new Date(r.asOf).getTime();
    if (!Number.isFinite(asOf)) continue;
    const end = asOf + 30 * DAY;
    if (end < now - DAY || end > now + horizonDays * DAY) continue;
    if (r.central == null || r.low == null || r.high == null) continue;
    out.push({
      id: `proj-${r.id}`,
      kind: "projection",
      symbol: r.symbol,
      date: isoDay(end),
      title: `AI 30-day window ends`,
      detail: `Projected central ${r.central} (range ${r.low}–${r.high})`,
      source: "forecast-store",
      observedAt: new Date(asOf).toISOString(),
    });
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** Symbols trading within 1% of their 52-week band edges today. */
export function milestoneEvents(quotes: CalendarQuote[], now = Date.now()): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  const today = isoDay(now);
  for (const q of quotes) {
    const sym = String(q.symbol || "").toUpperCase();
    if (!sym || q.price == null || !(q.price > 0)) continue;
    const obs =
      q.marketTime && Number.isFinite(new Date(q.marketTime).getTime())
        ? new Date(q.marketTime).toISOString()
        : new Date(now).toISOString();
    if (q.week52High && q.week52High > 0 && q.price >= q.week52High * 0.99) {
      out.push({
        id: `hi-${sym}-${today}`, kind: "milestone-high", symbol: sym, name: q.name ?? null,
        date: today, title: "Near 52-week high",
        detail: `Trading at ${q.price} vs 52-week high ${q.week52High}`,
        source: "live-quotes", observedAt: obs,
      });
    }
    if (q.week52Low && q.week52Low > 0 && q.price <= q.week52Low * 1.01) {
      out.push({
        id: `lo-${sym}-${today}`, kind: "milestone-low", symbol: sym, name: q.name ?? null,
        date: today, title: "Near 52-week low",
        detail: `Trading at ${q.price} vs 52-week low ${q.week52Low}`,
        source: "live-quotes", observedAt: obs,
      });
    }
  }
  return out;
}

export const UNAVAILABLE_TYPES = [
  "results",
  "dividends",
  "ipos",
  "bonus-split",
  "economic",
] as const;

export const CALENDAR_CONTRACT =
  "Results, dividends, IPOs, bonus/splits and economic events need a licensed feed (e.g. GET /api/v1/market/india/events). No free provider serves them; this endpoint reports them unavailable instead of estimating.";
