"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ipoService = void 0;
exports.parseNseDate = parseNseDate;
exports.parsePriceBand = parsePriceBand;
exports.classifyStatus = classifyStatus;
exports.normalizeIpo = normalizeIpo;
exports.normalizeBids = normalizeBids;
const ipo_provider_1 = require("./ipo.provider");
const ipo_ai_1 = require("./ipo-ai");
/** "09-Sep-2026" -> "2026-09-09", null when unparseable (never guessed). */
function parseNseDate(v) {
    if (typeof v !== "string")
        return null;
    const m = v.trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
    if (!m)
        return null;
    const months = {
        jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
        jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
    };
    const mon = months[m[2].toLowerCase()];
    if (!mon)
        return null;
    return `${m[3]}-${mon}-${m[1].padStart(2, "0")}`;
}
function num(v) {
    if (v === null || v === undefined || v === "")
        return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}
/** "Rs.139 to Rs.146" -> { low: 139, high: 146 }; single price -> both. */
function parsePriceBand(v) {
    if (typeof v !== "string")
        return { low: null, high: null };
    const nums = v.match(/[\d,]+(?:\.\d+)?/g)?.map((x) => Number(x.replace(/,/g, ""))).filter(Number.isFinite) || [];
    if (!nums.length)
        return { low: null, high: null };
    if (nums.length === 1)
        return { low: nums[0], high: nums[0] };
    return { low: Math.min(...nums), high: Math.max(...nums) };
}
function classifyStatus(openDate, closeDate, feedStatus, now = Date.now()) {
    const today = new Date(now).toISOString().slice(0, 10);
    if (openDate && openDate > today)
        return "upcoming";
    if (closeDate && closeDate < today)
        return "closed";
    if (String(feedStatus || "").toLowerCase() !== "active")
        return "closed";
    if (!openDate || !closeDate)
        return "open"; // listed without parseable window: treat as open, never drop
    return "open";
}
function normalizeIpo(r, now = Date.now()) {
    const symbol = String(r.symbol || "").toUpperCase();
    if (!symbol)
        return null;
    const openDate = parseNseDate(r.issueStartDate);
    const closeDate = parseNseDate(r.issueEndDate);
    const band = parsePriceBand(r.issuePrice);
    const series = typeof r.series === "string" ? r.series.toUpperCase() : null;
    return {
        symbol,
        company: typeof r.companyName === "string" && r.companyName ? r.companyName : symbol,
        openDate,
        closeDate,
        priceBand: typeof r.issuePrice === "string" && r.issuePrice ? r.issuePrice : null,
        priceLow: band.low,
        priceHigh: band.high,
        issueSizeShares: num(r.issueSize),
        series,
        exchange: r.isBse ? "NSE + BSE (SME)" : "NSE",
        subscription: num(r.noOfTime),
        status: classifyStatus(openDate, closeDate, r.status, now),
        source: "nse-india",
        rawOpen: typeof r.issueStartDate === "string" ? r.issueStartDate : null,
        rawClose: typeof r.issueEndDate === "string" ? r.issueEndDate : null,
    };
}
const MAIN_CATS = ["Qualified Institutional Buyers(QIBs)", "Non Institutional Investors", "Retail Individual Investors(RIIs)"];
/** Keep header/total/main-category rows with real numbers; drop empty sub-splits. */
function normalizeBids(symbol, rows, updateTime) {
    const cats = [];
    let total = null;
    for (const r of rows || []) {
        const name = String(r.category || "").trim();
        if (!name || /^category$/i.test(name))
            continue; // header row
        if (/^total$/i.test(name)) {
            total = num(r.noOfTime);
            continue;
        }
        const offered = num(r.noOfSharesOffered);
        const bid = num(r.noOfsharesBid);
        const multiple = num(r.noOfTime);
        if (offered == null && bid == null && multiple == null)
            continue; // empty sub-split
        if (MAIN_CATS.includes(name) || offered != null || multiple != null) {
            cats.push({ name, offered, bid, multiple });
        }
    }
    return { symbol: symbol.toUpperCase(), updateTime, total, categories: cats };
}
exports.ipoService = {
    async list() {
        const [cur, up] = await Promise.all([
            ipo_provider_1.ipoProvider.currentIssues().catch(() => []),
            ipo_provider_1.ipoProvider.upcomingIssues().catch(() => []),
        ]);
        const map = new Map();
        for (const r of [...up, ...cur]) {
            const ipo = normalizeIpo(r);
            if (!ipo)
                continue;
            const prev = map.get(ipo.symbol);
            // Prefer the row carrying subscription data; never overwrite real data with emptier rows.
            if (!prev || (prev.subscription == null && ipo.subscription != null))
                map.set(ipo.symbol, ipo);
        }
        const ipos = [...map.values()].sort((a, b) => (a.openDate || "").localeCompare(b.openDate || ""));
        return {
            mode: "live",
            market: "IN",
            asOf: new Date().toISOString(),
            source: "nse-india",
            count: ipos.length,
            ipos,
            unavailable: ["gmp", "lot-size", "allotment", "registrar", "issue-size-inr", "fresh-vs-ofs", "ipo-news"],
            contract: "GMP, lot size, allotment/refund/demat/listing dates, registrar, rupee issue size, fresh/OFS split and IPO news need a licensed feed. Reported missing, never estimated.",
        };
    },
    async bids(symbol, series = "EQ") {
        const { rows, updateTime } = await ipo_provider_1.ipoProvider.bidDetails(symbol, series);
        return {
            mode: "live",
            market: "IN",
            asOf: new Date().toISOString(),
            source: "nse-india",
            ...normalizeBids(symbol, rows, updateTime),
        };
    },
    async aiOne(symbol) {
        const sym = symbol.toUpperCase();
        const listed = await this.list().catch(() => null);
        const ipo = listed?.ipos?.find((x) => x.symbol === sym) || null;
        const bids = await this.bids(sym, ipo?.series || "EQ").catch(() => null);
        const mult = (prefix) => {
            const row = bids?.categories?.find((c) => String(c.name || "").startsWith(prefix));
            const v = row?.multiple;
            return typeof v === "number" && Number.isFinite(v) ? v : null;
        };
        const closeMs = ipo?.closeDate ? new Date(`${ipo.closeDate}T00:00:00Z`).getTime() : NaN;
        const daysToClose = Number.isFinite(closeMs)
            ? Math.ceil((closeMs - Date.now()) / (24 * 3600 * 1000))
            : null;
        const result = (0, ipo_ai_1.scoreIpo)({
            symbol: sym,
            company: ipo?.company ?? null,
            totalMultiple: bids?.total ?? ipo?.subscription ?? null,
            riiMultiple: mult("Retail Individual Investors"),
            qibMultiple: mult("Qualified Institutional Buyers"),
            niiMultiple: mult("Non Institutional Investors(Bid amount of more than Ten Lakh Rupees)") ?? mult("Non Institutional Investors"),
            priceLow: ipo?.priceLow ?? null,
            priceHigh: ipo?.priceHigh ?? null,
            issueSizeShares: ipo?.issueSizeShares ?? null,
            series: ipo?.series ?? null,
            daysToClose,
            bidsUpdatedAt: bids?.updateTime ?? null,
        });
        return {
            mode: "live",
            market: "IN",
            asOf: new Date().toISOString(),
            source: "nse-india",
            ipo,
            bidsUpdatedAt: bids?.updateTime ?? null,
            gmp: null,
            gmpNote: "GMP has no licensed feed and is excluded from the score by design.",
            rhp: null,
            rhpNote: "RHP/DRHP documents are not available to this system; nothing is summarized.",
            disclaimer: "Demand-based research view only — not investment advice. Listing gains are never guaranteed; most analytical inputs are unavailable (see missing).",
            ...result,
        };
    },
    async aiAll() {
        const listed = await this.list();
        const ipos = listed.ipos || [];
        const settled = await Promise.allSettled(ipos.map(async (ipo) => {
            const bids = await this.bids(ipo.symbol, ipo.series || "EQ").catch(() => null);
            const mult = (prefix) => {
                const row = bids?.categories?.find((c) => String(c.name || "").startsWith(prefix));
                const v = row?.multiple;
                return typeof v === "number" && Number.isFinite(v) ? v : null;
            };
            return (0, ipo_ai_1.scoreIpo)({
                symbol: ipo.symbol,
                company: ipo.company,
                totalMultiple: bids?.total ?? ipo.subscription ?? null,
                riiMultiple: mult("Retail Individual Investors"),
                qibMultiple: mult("Qualified Institutional Buyers"),
                niiMultiple: mult("Non Institutional Investors(Bid amount of more than Ten Lakh Rupees)") ?? mult("Non Institutional Investors"),
                priceLow: ipo.priceLow,
                priceHigh: ipo.priceHigh,
                issueSizeShares: ipo.issueSizeShares,
                series: ipo.series,
                daysToClose: null,
                bidsUpdatedAt: bids?.updateTime ?? null,
            });
        }));
        const ranked = [];
        settled.forEach((s, i) => {
            if (s.status === "fulfilled")
                ranked.push({ ...s.value, company: ipos[i]?.company ?? null });
        });
        ranked.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
        return {
            mode: "live",
            market: "IN",
            asOf: new Date().toISOString(),
            source: "nse-india",
            ranked,
            disclaimer: "Demand-based ranking only — not investment advice; listing gains never guaranteed.",
        };
    },
};
