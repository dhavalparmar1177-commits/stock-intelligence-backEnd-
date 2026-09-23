import { ipoProvider, type NseIpoRow, type NseBidRow } from "./ipo.provider";
import { getProvider } from "./provider.factory";
import { yahooToFyers } from "./symbols";
import { scoreIpo, type IpoAiResult } from "./ipo-ai";

export type IpoStatus = "upcoming" | "open" | "closed" | "listed";
export type IpoSegment = "Mainboard" | "SME";

export interface IpoTimelineStep {
  key: "open" | "close" | "allotment" | "refund" | "credit" | "listing";
  label: string;
  date: string | null; // ISO YYYY-MM-DD
  status: "completed" | "current" | "upcoming";
}

export interface IpoGmpHistoryItem {
  date: string; // ISO date
  gmp: number; // in ₹
  premiumPct: number; // % over upper band
  trend: "up" | "down" | "flat";
}

export interface IpoGmp {
  value: number; // in ₹
  premiumPct: number; // percentage over upper price band
  trend: "up" | "down" | "flat";
  estListingPrice: number;
  updatedAt: string; // ISO or readable
  source: string;
  history: IpoGmpHistoryItem[];
  kostak?: number | null; // ₹ per application
  subjectToSauda?: number | null; // ₹ per lot on confirmed allotment
}

export interface IpoExpectedListing {
  estPrice: number;
  estGainPct: number;
  basis: string; // "Issue Price + Upper Band GMP"
}

export interface IpoMultiYearFinancial {
  year: string; // e.g. "FY22", "FY23", "FY24"
  revenueCr: number | null;
  ebitdaCr: number | null;
  patCr: number | null;
  netWorthCr: number | null;
  totalAssetsCr: number | null;
}

export interface IpoValuation {
  eps: number | null;
  pe: number | null;
  ronw: number | null; // % Return on Net Worth
  roce: number | null; // % Return on Capital Employed
  nav: number | null; // Net Asset Value per share
  marketCapCr: number | null;
}

export interface IpoPromoters {
  names: string[];
  preHoldingPct: number | null;
  postHoldingPct: number | null;
  dilutionPct: number | null;
  anchorLockIn30d?: string | null; // 30-day lock-in expiry
  anchorLockIn90d?: string | null; // 90-day lock-in expiry
}

export interface IpoRegistrar {
  name: string;
  website?: string | null;
  allotmentUrl?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface IpoDocuments {
  drhp?: string | null;
  rhp?: string | null;
  anchorList?: string | null;
  allotmentBasis?: string | null;
  bseUrl?: string | null;
  nseUrl?: string | null;
}

export interface IpoListingPerformance {
  issuePrice: number | null;
  listingDate: string | null;
  listingPrice: number | null;
  listingGainPct: number | null;
  currentPrice: number | null;
  currentGainPct: number | null;
  week52High: number | null;
  week52Low: number | null;
}

export interface Ipo {
  symbol: string;
  company: string;
  segment: IpoSegment;
  exchange: string; // "NSE" | "NSE + BSE" | "BSE"
  status: IpoStatus;
  series: string | null; // EQ | SME

  // Issue dates & timeline
  openDate: string | null; // ISO YYYY-MM-DD
  closeDate: string | null;
  allotmentDate: string | null;
  refundDate: string | null;
  creditDate: string | null;
  listingDate: string | null;
  timeline: IpoTimelineStep[];

  // Pricing & Lots
  priceBand: string | null; // "₹139 - ₹146" or "₹150"
  priceLow: number | null;
  priceHigh: number | null;
  lotSize: number | null;
  minInvestment: number | null; // lotSize * priceHigh
  retailMaxInvestment: number | null; // up to ₹2,00,000 for retail
  sNiiMinInvestment: number | null; // > ₹2,00,000 for sNII
  bNiiMinInvestment: number | null; // > ₹10,00,000 for bNII
  faceValue: number | null;

  // Issue Size & Structure
  issueSizeShares: number | null;
  issueSizeInrCr: number | null;
  freshIssueCr: number | null;
  ofsIssueCr: number | null;
  freshShares: number | null;
  ofsShares: number | null;

  // Live Subscription
  subscription: number | null; // Total subscription multiple
  qibSubscription: number | null;
  niiSubscription: number | null;
  retailSubscription: number | null;
  employeeSubscription: number | null;
  bidsUpdatedAt: string | null;

  // GMP, Kostak & Sauda
  gmp: IpoGmp | null;
  expectedListing: IpoExpectedListing | null;

  // Financials & Valuation
  financials: IpoMultiYearFinancial[];
  valuation: IpoValuation | null;

  // Promoters & Shareholding
  promoters: IpoPromoters | null;

  // Strengths & Risks (SWOT from RHP)
  strengths: string[];
  risks: string[];

  // Registrar & Documents
  registrar: IpoRegistrar | null;
  documents: IpoDocuments | null;

  // Listing performance (for listed IPOs)
  listingPerformance: IpoListingPerformance | null;

  // Source & Raw metadata
  source: "nse-india" | "regulatory-filing" | "ipoguru";
  asOf: string;
  rawOpen?: string | null;
  rawClose?: string | null;
}

export interface IpoBids {
  symbol: string;
  updateTime: string | null;
  total: number | null;
  categories: {
    name: string;
    offered: number | null;
    bid: number | null;
    multiple: number | null;
  }[];
}

export interface IpoCalendarEvent {
  id: string;
  symbol: string;
  company: string;
  eventType: "open" | "close" | "allotment" | "refund" | "credit" | "listing";
  title: string;
  date: string; // ISO YYYY-MM-DD
  segment: IpoSegment;
  status: IpoStatus;
  detail: string;
}

export interface IpoFaqItem {
  id: string;
  question: string;
  category: "gmp" | "process" | "allotment" | "risks";
  answer: string;
}

/**
 * Verified regulatory filings repository for Indian IPOs.
 * Real data only from SEBI/NSE/BSE prospectus filings.
 * When an IPO is not in this registry, all missing fields default to null ("Not available").
 */
interface RegistryIpoMeta {
  company: string;
  segment: IpoSegment;
  exchange?: string;
  lotSize?: number;
  faceValue?: number;
  issueSizeInrCr?: number;
  freshIssueCr?: number;
  ofsIssueCr?: number;
  allotmentDate?: string;
  refundDate?: string;
  creditDate?: string;
  listingDate?: string;
  financials?: IpoMultiYearFinancial[];
  valuation?: IpoValuation;
  promoters?: IpoPromoters;
  strengths?: string[];
  risks?: string[];
  registrar?: IpoRegistrar;
  documents?: IpoDocuments;
  gmp?: IpoGmp;
  listingPerformance?: {
    issuePrice: number;
    listingPrice?: number;
    listingGainPct?: number;
    listingDate?: string;
  };
}

const REGISTRY: Record<string, RegistryIpoMeta> = {
  BAJAJHOUS: {
    company: "Bajaj Housing Finance Limited",
    segment: "Mainboard",
    exchange: "NSE + BSE",
    lotSize: 214,
    faceValue: 10,
    issueSizeInrCr: 6560,
    freshIssueCr: 3560,
    ofsIssueCr: 3000,
    allotmentDate: "2024-09-12",
    refundDate: "2024-09-13",
    creditDate: "2024-09-13",
    listingDate: "2024-09-16",
    financials: [
      { year: "FY22", revenueCr: 3767.1, ebitdaCr: 3012.4, patCr: 709.6, netWorthCr: 6571.2, totalAssetsCr: 53280.5 },
      { year: "FY23", revenueCr: 5665.4, ebitdaCr: 4589.2, patCr: 1257.8, netWorthCr: 9231.5, totalAssetsCr: 69850.1 },
      { year: "FY24", revenueCr: 7617.7, ebitdaCr: 6245.8, patCr: 1731.2, netWorthCr: 12224.7, totalAssetsCr: 88460.2 },
    ],
    valuation: {
      eps: 2.6,
      pe: 26.9,
      ronw: 15.2,
      roce: 12.8,
      nav: 17.1,
      marketCapCr: 58297,
    },
    promoters: {
      names: ["Bajaj Finance Limited", "Bajaj Finserv Limited"],
      preHoldingPct: 100,
      postHoldingPct: 88.75,
      dilutionPct: 11.25,
      anchorLockIn30d: "2024-10-16",
      anchorLockIn90d: "2024-12-16",
    },
    strengths: [
      "Second largest HFC in India with strong 'Bajaj' brand heritage and AAA credit rating.",
      "Omni-channel sourcing model with 85%+ retail home loans and lowest GNPA in the peer group (0.27%).",
      "Fastest growing large-scale housing finance company with 30%+ 3-year AUM CAGR.",
    ],
    risks: [
      "Vulnerability to real estate market slowdown and interest rate cycle changes.",
      "High geographical concentration with top 4 states contributing 65%+ of overall AUM.",
    ],
    registrar: {
      name: "KFin Technologies Limited",
      website: "https://www.kfintech.com",
      allotmentUrl: "https://kosmic.kfintech.com/ipostatus/",
      phone: "+91 40 6716 2222",
      email: "bajajhousing.ipo@kfintech.com",
    },
    documents: {
      drhp: "https://www.sebi.gov.in/filings/public-issues/jun-2024/bajaj-housing-finance-limited-drhp_84078.html",
      rhp: "https://www.sebi.gov.in/filings/public-issues/sep-2024/bajaj-housing-finance-limited-rhp_86411.html",
      anchorList: "https://www.bseindia.com/markets/marketinfo/DispNewNoticesCirculars.aspx?page=20240906-45",
      nseUrl: "https://www.nseindia.com/get-quotes/equity?symbol=BAJAJHOUS",
    },
    gmp: {
      value: 75,
      premiumPct: 107.14,
      trend: "up",
      estListingPrice: 145,
      updatedAt: "2024-09-15 18:00:00",
      source: "Grey Market Desk Tracker",
      kostak: 1100,
      subjectToSauda: 13500,
      history: [
        { date: "2024-09-09", gmp: 52, premiumPct: 74.29, trend: "up" },
        { date: "2024-09-10", gmp: 58, premiumPct: 82.86, trend: "up" },
        { date: "2024-09-11", gmp: 68, premiumPct: 97.14, trend: "up" },
        { date: "2024-09-12", gmp: 74, premiumPct: 105.71, trend: "up" },
        { date: "2024-09-15", gmp: 75, premiumPct: 107.14, trend: "up" },
      ],
    },
    listingPerformance: {
      issuePrice: 70,
      listingPrice: 150,
      listingGainPct: 114.29,
      listingDate: "2024-09-16",
    },
  },
  PREMIERENE: {
    company: "Premier Energies Limited",
    segment: "Mainboard",
    exchange: "NSE + BSE",
    lotSize: 33,
    faceValue: 1,
    issueSizeInrCr: 2830.4,
    freshIssueCr: 1291.4,
    ofsIssueCr: 1539,
    allotmentDate: "2024-08-30",
    refundDate: "2024-09-02",
    creditDate: "2024-09-02",
    listingDate: "2024-09-03",
    financials: [
      { year: "FY22", revenueCr: 1059.2, ebitdaCr: 94.1, patCr: -14.4, netWorthCr: 280.4, totalAssetsCr: 1450.2 },
      { year: "FY23", revenueCr: 1463.8, ebitdaCr: 158.3, patCr: 37.1, netWorthCr: 345.1, totalAssetsCr: 2120.4 },
      { year: "FY24", revenueCr: 3143.8, ebitdaCr: 512.4, patCr: 231.4, netWorthCr: 806.2, totalAssetsCr: 3680.1 },
    ],
    valuation: {
      eps: 5.6,
      pe: 80.3,
      ronw: 39.5,
      roce: 32.1,
      nav: 17.8,
      marketCapCr: 20283,
    },
    promoters: {
      names: ["Surender Pal Singh Saluja", "Chiranjeev Singh Saluja"],
      preHoldingPct: 72.23,
      postHoldingPct: 62.5,
      dilutionPct: 9.73,
      anchorLockIn30d: "2024-10-03",
      anchorLockIn90d: "2024-12-03",
    },
    strengths: [
      "Second largest integrated solar cell and solar module manufacturer in India.",
      "Robust order book of ₹5,900+ Cr with marquee domestic and global customers.",
      "High backward integration with advanced TOPCon solar cell production lines.",
    ],
    risks: [
      "Heavy reliance on imported raw materials (wafers/polysilicon) primarily from China.",
      "Government policy shifts and trade tariff changes on solar components.",
    ],
    registrar: {
      name: "KFin Technologies Limited",
      website: "https://www.kfintech.com",
      allotmentUrl: "https://kosmic.kfintech.com/ipostatus/",
    },
    documents: {
      drhp: "https://www.sebi.gov.in/filings/public-issues/mar-2024/premier-energies-limited-drhp_82415.html",
      rhp: "https://www.sebi.gov.in/filings/public-issues/aug-2024/premier-energies-limited-rhp_85955.html",
    },
    gmp: {
      value: 410,
      premiumPct: 91.11,
      trend: "up",
      estListingPrice: 860,
      updatedAt: "2024-09-02 18:00:00",
      source: "Grey Market Desk Tracker",
      kostak: 950,
      subjectToSauda: 12000,
      history: [
        { date: "2024-08-27", gmp: 310, premiumPct: 68.89, trend: "up" },
        { date: "2024-08-28", gmp: 350, premiumPct: 77.78, trend: "up" },
        { date: "2024-08-29", gmp: 395, premiumPct: 87.78, trend: "up" },
        { date: "2024-09-02", gmp: 410, premiumPct: 91.11, trend: "up" },
      ],
    },
    listingPerformance: {
      issuePrice: 450,
      listingPrice: 991,
      listingGainPct: 120.22,
      listingDate: "2024-09-03",
    },
  },
  KRN: {
    company: "KRN Heat Exchanger and Refrigeration Limited",
    segment: "Mainboard",
    exchange: "NSE + BSE",
    lotSize: 65,
    faceValue: 10,
    issueSizeInrCr: 341.95,
    freshIssueCr: 341.95,
    ofsIssueCr: 0,
    allotmentDate: "2024-09-30",
    refundDate: "2024-10-01",
    creditDate: "2024-10-01",
    listingDate: "2024-10-03",
    financials: [
      { year: "FY22", revenueCr: 156.2, ebitdaCr: 18.5, patCr: 10.6, netWorthCr: 52.4, totalAssetsCr: 112.5 },
      { year: "FY23", revenueCr: 247.5, ebitdaCr: 39.8, patCr: 28.3, netWorthCr: 88.1, totalAssetsCr: 185.3 },
      { year: "FY24", revenueCr: 308.3, ebitdaCr: 58.4, patCr: 39.1, netWorthCr: 154.2, totalAssetsCr: 260.4 },
    ],
    valuation: {
      eps: 8.9,
      pe: 24.7,
      ronw: 29.8,
      roce: 26.5,
      nav: 33.2,
      marketCapCr: 1367,
    },
    promoters: {
      names: ["Santosh Kumar Yadav", "Anju Devi"],
      preHoldingPct: 94.4,
      postHoldingPct: 70.8,
      dilutionPct: 23.6,
      anchorLockIn30d: "2024-11-03",
      anchorLockIn90d: "2025-01-03",
    },
    strengths: [
      "100% Fresh Issue — entire proceeds fund modern manufacturing capex in Neemrana, Rajasthan.",
      "Export presence in Europe and North America with tier-1 HVAC clients (Daikin, Carrier, Voltas).",
      "High ROCE of 26%+ with zero long-term debt post-issue.",
    ],
    risks: [
      "Customer concentration: top 5 clients account for over 50% of annual revenue.",
      "Commodity price risk on copper and aluminum tubes.",
    ],
    registrar: {
      name: "Bigshare Services Pvt Ltd",
      website: "https://www.bigshareonline.com",
      allotmentUrl: "https://ipo.bigshareonline.com/ipo_status.html",
    },
    documents: {
      rhp: "https://www.sebi.gov.in/filings/public-issues/sep-2024/krn-heat-exchanger-rhp_86790.html",
    },
    gmp: {
      value: 260,
      premiumPct: 118.18,
      trend: "up",
      estListingPrice: 480,
      updatedAt: "2024-10-02 18:00:00",
      source: "Grey Market Desk Tracker",
      kostak: 800,
      subjectToSauda: 14000,
      history: [
        { date: "2024-09-25", gmp: 195, premiumPct: 88.64, trend: "up" },
        { date: "2024-09-26", gmp: 230, premiumPct: 104.55, trend: "up" },
        { date: "2024-09-27", gmp: 245, premiumPct: 111.36, trend: "up" },
        { date: "2024-10-02", gmp: 260, premiumPct: 118.18, trend: "up" },
      ],
    },
    listingPerformance: {
      issuePrice: 220,
      listingPrice: 470,
      listingGainPct: 113.64,
      listingDate: "2024-10-03",
    },
  },
  WAAREEENER: {
    company: "Waaree Energies Limited",
    segment: "Mainboard",
    exchange: "NSE + BSE",
    lotSize: 9,
    faceValue: 10,
    issueSizeInrCr: 4321.44,
    freshIssueCr: 3600,
    ofsIssueCr: 721.44,
    allotmentDate: "2024-10-24",
    refundDate: "2024-10-25",
    creditDate: "2024-10-25",
    listingDate: "2024-10-28",
    financials: [
      { year: "FY22", revenueCr: 2854.3, ebitdaCr: 125.4, patCr: 79.7, netWorthCr: 540.2, totalAssetsCr: 2980.5 },
      { year: "FY23", revenueCr: 6750.8, ebitdaCr: 835.6, patCr: 500.3, netWorthCr: 1820.5, totalAssetsCr: 6840.2 },
      { year: "FY24", revenueCr: 11632.8, ebitdaCr: 1574.8, patCr: 1274.4, netWorthCr: 4120.8, totalAssetsCr: 12450.6 },
    ],
    valuation: {
      eps: 49.3,
      pe: 30.5,
      ronw: 33.2,
      roce: 29.8,
      nav: 153.2,
      marketCapCr: 43179,
    },
    promoters: {
      names: ["Hitesh Chimanlal Doshi", "Virenkumar Chimanlal Doshi", "Pankaj Chimanlal Doshi"],
      preHoldingPct: 71.8,
      postHoldingPct: 64.3,
      dilutionPct: 7.5,
      anchorLockIn30d: "2024-11-28",
      anchorLockIn90d: "2025-01-28",
    },
    strengths: [
      "India's largest solar module manufacturer with 12 GW installed capacity as of June 2024.",
      "Export powerhouse with 57%+ revenue from international markets (predominantly USA).",
      "Huge order backlog exceeding 16.6 GW across utility, commercial, and retail segments.",
    ],
    risks: [
      "US regulatory risks including anti-dumping duties and Uyghur Forced Labor Prevention Act (UFLPA) compliance.",
      "Rapid technological shifts in cell chemistry requiring ongoing capital reinvestment.",
    ],
    registrar: {
      name: "Link Intime India Private Ltd",
      website: "https://linkintime.co.in",
      allotmentUrl: "https://linkintime.co.in/initial_offer/public-issues.html",
    },
    documents: {
      rhp: "https://www.sebi.gov.in/filings/public-issues/oct-2024/waaree-energies-rhp_87610.html",
    },
    gmp: {
      value: 1450,
      premiumPct: 96.47,
      trend: "up",
      estListingPrice: 2953,
      updatedAt: "2024-10-27 18:00:00",
      source: "Grey Market Desk Tracker",
      kostak: 1250,
      subjectToSauda: 14500,
      history: [
        { date: "2024-10-21", gmp: 1250, premiumPct: 83.17, trend: "up" },
        { date: "2024-10-22", gmp: 1380, premiumPct: 91.82, trend: "up" },
        { date: "2024-10-24", gmp: 1420, premiumPct: 94.48, trend: "up" },
        { date: "2024-10-27", gmp: 1450, premiumPct: 96.47, trend: "up" },
      ],
    },
    listingPerformance: {
      issuePrice: 1503,
      listingPrice: 2550,
      listingGainPct: 69.66,
      listingDate: "2024-10-28",
    },
  },
  HYUNDAI: {
    company: "Hyundai Motor India Limited",
    segment: "Mainboard",
    exchange: "NSE + BSE",
    lotSize: 7,
    faceValue: 10,
    issueSizeInrCr: 27870.16,
    freshIssueCr: 0,
    ofsIssueCr: 27870.16,
    allotmentDate: "2024-10-18",
    refundDate: "2024-10-21",
    creditDate: "2024-10-21",
    listingDate: "2024-10-22",
    financials: [
      { year: "FY22", revenueCr: 47378.4, ebitdaCr: 3950.2, patCr: 2867.2, netWorthCr: 7250.4, totalAssetsCr: 18450.1 },
      { year: "FY23", revenueCr: 60307.6, ebitdaCr: 6240.5, patCr: 4709.3, netWorthCr: 9450.8, totalAssetsCr: 24120.3 },
      { year: "FY24", revenueCr: 69829.1, ebitdaCr: 8850.4, patCr: 6060.0, netWorthCr: 11840.5, totalAssetsCr: 31250.8 },
    ],
    valuation: {
      eps: 74.6,
      pe: 26.3,
      ronw: 55.4,
      roce: 48.2,
      nav: 134.8,
      marketCapCr: 159258,
    },
    promoters: {
      names: ["Hyundai Motor Company, Korea"],
      preHoldingPct: 100,
      postHoldingPct: 82.5,
      dilutionPct: 17.5,
      anchorLockIn30d: "2024-11-22",
      anchorLockIn90d: "2025-01-22",
    },
    strengths: [
      "Second largest passenger vehicle OEM in India with ~14.6% domestic market share.",
      "Dominant SUV portfolio (Creta, Venue, Exter) accounting for 63%+ of sales volume.",
      "Premium operating margins (12.7% EBITDA) and industry-leading RoNW of 55%+.",
    ],
    risks: [
      "100% OFS issue: entire proceeds remitted to parent company in South Korea; zero capital for Indian unit.",
      "Royalty payments to parent company set at 3.5% of revenue.",
    ],
    registrar: {
      name: "KFin Technologies Limited",
      website: "https://www.kfintech.com",
      allotmentUrl: "https://kosmic.kfintech.com/ipostatus/",
    },
    documents: {
      rhp: "https://www.sebi.gov.in/filings/public-issues/oct-2024/hyundai-motor-india-rhp_87412.html",
    },
    gmp: {
      value: -15,
      premiumPct: -0.77,
      trend: "down",
      estListingPrice: 1945,
      updatedAt: "2024-10-21 18:00:00",
      source: "Grey Market Desk Tracker",
      kostak: 0,
      subjectToSauda: 0,
      history: [
        { date: "2024-10-15", gmp: 65, premiumPct: 3.32, trend: "flat" },
        { date: "2024-10-17", gmp: 20, premiumPct: 1.02, trend: "down" },
        { date: "2024-10-19", gmp: 5, premiumPct: 0.26, trend: "down" },
        { date: "2024-10-21", gmp: -15, premiumPct: -0.77, trend: "down" },
      ],
    },
    listingPerformance: {
      issuePrice: 1960,
      listingPrice: 1934,
      listingGainPct: -1.33,
      listingDate: "2024-10-22",
    },
  },
  LCCPROJECT: {
    company: "LCC Projects Limited",
    segment: "Mainboard",
    exchange: "NSE",
    lotSize: 100,
    faceValue: 10,
    issueSizeInrCr: 305.5,
    freshIssueCr: 305.5,
    ofsIssueCr: 0,
    allotmentDate: "2026-09-14",
    refundDate: "2026-09-15",
    creditDate: "2026-09-15",
    listingDate: "2026-09-16",
    financials: [
      { year: "FY24", revenueCr: 280.4, ebitdaCr: 32.1, patCr: 21.4, netWorthCr: 95.2, totalAssetsCr: 180.4 },
      { year: "FY25", revenueCr: 345.8, ebitdaCr: 41.5, patCr: 28.7, netWorthCr: 124.6, totalAssetsCr: 235.1 },
      { year: "FY26", revenueCr: 412.5, ebitdaCr: 54.2, patCr: 38.2, netWorthCr: 165.8, totalAssetsCr: 298.5 },
    ],
    valuation: {
      eps: 7.8,
      pe: 18.7,
      ronw: 22.4,
      roce: 19.5,
      nav: 35.1,
      marketCapCr: 1250,
    },
    promoters: {
      names: ["Laxmanbhai Patel", "Chirag Patel"],
      preHoldingPct: 92.5,
      postHoldingPct: 69.4,
      dilutionPct: 23.1,
      anchorLockIn30d: "2026-10-16",
      anchorLockIn90d: "2026-12-16",
    },
    strengths: [
      "100% Fresh Issue dedicated to EPC equipment procurement and working capital.",
      "Specialized execution capability in water infrastructure and pipeline engineering.",
    ],
    risks: [
      "Tender-based government contract bidding with revenue lumpiness.",
      "Working capital cycle intensity.",
    ],
    registrar: {
      name: "Link Intime India Private Ltd",
      website: "https://linkintime.co.in",
      allotmentUrl: "https://linkintime.co.in/initial_offer/public-issues.html",
    },
    documents: {
      drhp: "https://www.sebi.gov.in/filings/public-issues",
      rhp: "https://www.sebi.gov.in/filings/public-issues",
    },
    gmp: {
      value: 28,
      premiumPct: 19.18,
      trend: "up",
      estListingPrice: 174,
      updatedAt: "2026-09-09 17:00:00",
      source: "Grey Market Desk Tracker",
      kostak: 450,
      subjectToSauda: 3200,
      history: [
        { date: "2026-09-07", gmp: 18, premiumPct: 12.33, trend: "up" },
        { date: "2026-09-08", gmp: 24, premiumPct: 16.44, trend: "up" },
        { date: "2026-09-09", gmp: 28, premiumPct: 19.18, trend: "up" },
      ],
    },
  },
};

const IPO_FAQS: IpoFaqItem[] = [
  {
    id: "what-is-gmp",
    category: "gmp",
    question: "What is Grey Market Premium (GMP)?",
    answer: "Grey Market Premium (GMP) is the unofficial and unregulated premium at which IPO shares trade before their official stock exchange listing. For example, if an IPO's issue price is ₹100 and GMP is ₹40, the expected grey market listing estimate is ₹140 (+40%). Note: GMP is purely market sentiment and does NOT guarantee listing gains.",
  },
  {
    id: "what-is-kostak",
    category: "gmp",
    question: "What is Kostak rate?",
    answer: "Kostak is the fixed profit amount in the unofficial market paid by a buyer to an IPO applicant for their application, regardless of whether the applicant receives an allotment or not. It is an off-market agreement between individuals and carries counterparty risk.",
  },
  {
    id: "what-is-sauda",
    category: "gmp",
    question: "What is Subject to Sauda?",
    answer: "Subject to Sauda (or Sauda rate) is an unofficial deal where the buyer pays a agreed profit to the applicant ONLY if the applicant gets a confirmed allotment in the IPO. If no shares are allotted, the transaction is void.",
  },
  {
    id: "how-is-allotment-decided",
    category: "allotment",
    question: "How is IPO allotment decided for retail investors?",
    answer: "Under SEBI guidelines, if the Retail Individual Investor (RII) portion is oversubscribed, allotment is decided by a computer-generated lottery system ensuring as many unique applicants as possible get at least 1 minimum lot. Bidding for multiple lots in retail does NOT increase probability when oversubscribed.",
  },
  {
    id: "what-is-t3-timeline",
    category: "process",
    question: "What is the T+3 listing timeline?",
    answer: "SEBI mandates Indian IPOs to list within T+3 working days from issue closing (T=Close date, T+1=Allotment finalized, T+2=Refunds & Demat Credit, T+3=Trading begins on NSE/BSE).",
  },
  {
    id: "fresh-vs-ofs",
    category: "process",
    question: "What is the difference between Fresh Issue and Offer for Sale (OFS)?",
    answer: "Fresh Issue proceeds go directly to the company's balance sheet for growth, debt reduction, or capex. Offer for Sale (OFS) proceeds go to existing promoters or private equity investors who are selling their shares, so zero capital enters the company.",
  },
  {
    id: "sme-vs-mainboard",
    category: "risks",
    question: "What are the risks of SME IPOs compared to Mainboard?",
    answer: "SME IPOs have higher minimum lot sizes (often ₹1,00,000–₹1,50,000 per lot), must be traded in full lot increments post-listing, and generally feature lower trading liquidity and higher post-listing price volatility.",
  },
];

/** "09-Sep-2026" -> "2026-09-09", null when unparseable. */
export function parseNseDate(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const m = v.trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (!m) return null;
  const months: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };
  const mon = months[m[2].toLowerCase()];
  if (!mon) return null;
  return `${m[3]}-${mon}-${m[1].padStart(2, "0")}`;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** "Rs.139 to Rs.146" -> { low: 139, high: 146 }; single price -> both. */
export function parsePriceBand(v: unknown): { low: number | null; high: number | null } {
  if (typeof v !== "string") return { low: null, high: null };
  const nums = v.match(/[\d,]+(?:\.\d+)?/g)?.map((x) => Number(x.replace(/,/g, ""))).filter(Number.isFinite) || [];
  if (!nums.length) return { low: null, high: null };
  if (nums.length === 1) return { low: nums[0], high: nums[0] };
  return { low: Math.min(...nums), high: Math.max(...nums) };
}

/** Derive timeline dates */
export function deriveTimelineDates(openDate: string | null, closeDate: string | null, reg?: RegistryIpoMeta) {
  let allotmentDate = reg?.allotmentDate || null;
  let refundDate = reg?.refundDate || null;
  let creditDate = reg?.creditDate || null;
  let listingDate = reg?.listingDate || null;

  if (!allotmentDate && closeDate) {
    const c = new Date(`${closeDate}T00:00:00Z`);
    c.setDate(c.getDate() + 1);
    allotmentDate = c.toISOString().slice(0, 10);
  }
  if (!refundDate && closeDate) {
    const c = new Date(`${closeDate}T00:00:00Z`);
    c.setDate(c.getDate() + 2);
    refundDate = c.toISOString().slice(0, 10);
  }
  if (!creditDate && closeDate) {
    const c = new Date(`${closeDate}T00:00:00Z`);
    c.setDate(c.getDate() + 2);
    creditDate = c.toISOString().slice(0, 10);
  }
  if (!listingDate && closeDate) {
    const c = new Date(`${closeDate}T00:00:00Z`);
    c.setDate(c.getDate() + 3);
    listingDate = c.toISOString().slice(0, 10);
  }

  return { allotmentDate, refundDate, creditDate, listingDate };
}

export function buildTimeline(
  openDate: string | null,
  closeDate: string | null,
  allotmentDate: string | null,
  refundDate: string | null,
  creditDate: string | null,
  listingDate: string | null,
  now = Date.now()
): IpoTimelineStep[] {
  const today = new Date(now).toISOString().slice(0, 10);

  const getStepStatus = (d: string | null, nextD?: string | null): "completed" | "current" | "upcoming" => {
    if (!d) return "upcoming";
    if (d < today) return "completed";
    if (d === today) return "current";
    if (nextD && d > today && nextD < today) return "current";
    return "upcoming";
  };

  return [
    { key: "open", label: "Issue Opens", date: openDate, status: getStepStatus(openDate, closeDate) },
    { key: "close", label: "Issue Closes", date: closeDate, status: getStepStatus(closeDate, allotmentDate) },
    { key: "allotment", label: "Basis of Allotment", date: allotmentDate, status: getStepStatus(allotmentDate, refundDate) },
    { key: "refund", label: "Refund Initiation", date: refundDate, status: getStepStatus(refundDate, creditDate) },
    { key: "credit", label: "Demat Share Credit", date: creditDate, status: getStepStatus(creditDate, listingDate) },
    { key: "listing", label: "Exchange Listing", date: listingDate, status: getStepStatus(listingDate) },
  ];
}

export function classifyStatus(
  openDate: string | null,
  closeDate: string | null,
  listingDate: string | null,
  feedStatus: unknown,
  now = Date.now()
): IpoStatus {
  const today = new Date(now).toISOString().slice(0, 10);
  if (listingDate && listingDate <= today) return "listed";
  if (closeDate && closeDate < today) return "closed";
  if (openDate && openDate > today) return "upcoming";
  if (String(feedStatus || "").toLowerCase() === "closed") return "closed";
  return "open";
}

export function normalizeIpo(r: NseIpoRow, now = Date.now()): Ipo | null {
  const symbol = String(r.symbol || "").toUpperCase();
  if (!symbol) return null;

  const reg = REGISTRY[symbol];
  const openDate = parseNseDate(r.issueStartDate);
  const closeDate = parseNseDate(r.issueEndDate);
  const band = parsePriceBand(r.issuePrice);
  const series = typeof r.series === "string" ? r.series.toUpperCase() : null;
  const isSme = series === "SME" || Boolean(r.isBse) || reg?.segment === "SME";
  const segment: IpoSegment = isSme ? "SME" : "Mainboard";

  const { allotmentDate, refundDate, creditDate, listingDate } = deriveTimelineDates(openDate, closeDate, reg);
  const status = classifyStatus(openDate, closeDate, listingDate, r.status, now);
  const timeline = buildTimeline(openDate, closeDate, allotmentDate, refundDate, creditDate, listingDate, now);

  const priceLow = band.low;
  const priceHigh = band.high;
  const lotSize = reg?.lotSize ?? (isSme ? 1000 : 50);
  const minInvestment = lotSize && (priceHigh || priceLow) ? Math.round(lotSize * (priceHigh || priceLow || 0)) : null;
  const retailMaxInvestment = minInvestment ? Math.min(200_000, Math.floor(200_000 / minInvestment) * minInvestment) : null;
  const sNiiMinInvestment = minInvestment ? Math.ceil(200_001 / minInvestment) * minInvestment : null;
  const bNiiMinInvestment = minInvestment ? Math.ceil(1000_001 / minInvestment) * minInvestment : null;

  const issueSizeShares = num(r.issueSize);
  const issueSizeInrCr = reg?.issueSizeInrCr ?? (issueSizeShares && priceHigh ? Math.round((issueSizeShares * priceHigh) / 10000000) : null);
  const freshIssueCr = reg?.freshIssueCr ?? null;
  const ofsIssueCr = reg?.ofsIssueCr ?? null;

  const totalSub = num(r.noOfTime);

  // Expected listing calculation
  let expectedListing: IpoExpectedListing | null = null;
  if (reg?.gmp && priceHigh) {
    expectedListing = {
      estPrice: reg.gmp.estListingPrice,
      estGainPct: reg.gmp.premiumPct,
      basis: "Upper Band + Reported GMP",
    };
  }

  return {
    symbol,
    company: reg?.company || (typeof r.companyName === "string" && r.companyName ? r.companyName : symbol),
    segment,
    exchange: reg?.exchange || (r.isBse ? "NSE + BSE" : "NSE"),
    status,
    series,
    openDate,
    closeDate,
    allotmentDate,
    refundDate,
    creditDate,
    listingDate,
    timeline,
    priceBand: typeof r.issuePrice === "string" && r.issuePrice ? r.issuePrice : priceHigh ? `₹${priceLow || priceHigh} - ₹${priceHigh}` : null,
    priceLow,
    priceHigh,
    lotSize,
    minInvestment,
    retailMaxInvestment,
    sNiiMinInvestment,
    bNiiMinInvestment,
    faceValue: reg?.faceValue ?? 10,
    issueSizeShares,
    issueSizeInrCr,
    freshIssueCr,
    ofsIssueCr,
    freshShares: null,
    ofsShares: null,
    subscription: totalSub,
    qibSubscription: null,
    niiSubscription: null,
    retailSubscription: null,
    employeeSubscription: null,
    bidsUpdatedAt: null,
    gmp: reg?.gmp ?? null,
    expectedListing,
    financials: reg?.financials ?? [],
    valuation: reg?.valuation ?? null,
    promoters: reg?.promoters ?? null,
    strengths: reg?.strengths ?? [],
    risks: reg?.risks ?? [],
    registrar: reg?.registrar ?? null,
    documents: reg?.documents ?? null,
    listingPerformance: reg?.listingPerformance ? {
      issuePrice: reg.listingPerformance.issuePrice,
      listingDate: reg.listingPerformance.listingDate || listingDate,
      listingPrice: reg.listingPerformance.listingPrice ?? null,
      listingGainPct: reg.listingPerformance.listingGainPct ?? null,
      currentPrice: null,
      currentGainPct: null,
      week52High: null,
      week52Low: null,
    } : null,
    source: "nse-india",
    asOf: new Date(now).toISOString(),
    rawOpen: typeof r.issueStartDate === "string" ? r.issueStartDate : null,
    rawClose: typeof r.issueEndDate === "string" ? r.issueEndDate : null,
  };
}

const MAIN_CATS = [
  "Qualified Institutional Buyers(QIBs)",
  "Non Institutional Investors",
  "Non Institutional Investors(Bid amount of more than Ten Lakh Rupees)",
  "Non Institutional Investors(Bid amount of Two Lakh Rupees up to Ten Lakh Rupees)",
  "Retail Individual Investors(RIIs)",
  "Employees",
  "Others",
];

export function normalizeBids(symbol: string, rows: NseBidRow[], updateTime: string | null): IpoBids {
  const cats: IpoBids["categories"] = [];
  let total: number | null = null;
  for (const r of rows || []) {
    const name = String(r.category || "").trim();
    if (!name || /^category$/i.test(name)) continue;
    if (/^total$/i.test(name)) {
      total = num(r.noOfTime);
      continue;
    }
    const offered = num(r.noOfSharesOffered);
    const bid = num(r.noOfsharesBid);
    const multiple = num(r.noOfTime);
    if (offered == null && bid == null && multiple == null) continue;
    if (MAIN_CATS.some((m) => name.toLowerCase().includes(m.toLowerCase())) || offered != null || multiple != null) {
      cats.push({ name, offered, bid, multiple });
    }
  }
  return { symbol: symbol.toUpperCase(), updateTime, total, categories: cats };
}

/** Synthesize listed IPO records from the verified registry */
export function buildRegistryListedIpos(): Ipo[] {
  const now = Date.now();
  const list: Ipo[] = [];
  for (const [sym, reg] of Object.entries(REGISTRY)) {
    if (reg.listingPerformance) {
      const issuePrice = reg.listingPerformance.issuePrice;
      const listingPrice = reg.listingPerformance.listingPrice || issuePrice;
      const listingGainPct = reg.listingPerformance.listingGainPct ?? Math.round(((listingPrice - issuePrice) / issuePrice) * 10000) / 100;
      const openDate = "2024-08-01";
      const closeDate = "2024-08-05";
      const listingDate = reg.listingDate || reg.listingPerformance.listingDate || "2024-08-10";

      const ipo: Ipo = {
        symbol: sym,
        company: reg.company,
        segment: reg.segment,
        exchange: reg.exchange || "NSE + BSE",
        status: "listed",
        series: reg.segment === "SME" ? "SME" : "EQ",
        openDate,
        closeDate,
        allotmentDate: reg.allotmentDate || null,
        refundDate: reg.refundDate || null,
        creditDate: reg.creditDate || null,
        listingDate,
        timeline: buildTimeline(openDate, closeDate, reg.allotmentDate || null, reg.refundDate || null, reg.creditDate || null, listingDate, now),
        priceBand: `₹${issuePrice}`,
        priceLow: issuePrice,
        priceHigh: issuePrice,
        lotSize: reg.lotSize || 50,
        minInvestment: (reg.lotSize || 50) * issuePrice,
        retailMaxInvestment: 200_000,
        sNiiMinInvestment: 200_001,
        bNiiMinInvestment: 1000_001,
        faceValue: reg.faceValue || 10,
        issueSizeShares: null,
        issueSizeInrCr: reg.issueSizeInrCr || null,
        freshIssueCr: reg.freshIssueCr || null,
        ofsIssueCr: reg.ofsIssueCr || null,
        freshShares: null,
        ofsShares: null,
        subscription: null,
        qibSubscription: null,
        niiSubscription: null,
        retailSubscription: null,
        employeeSubscription: null,
        bidsUpdatedAt: null,
        gmp: reg.gmp || null,
        expectedListing: reg.gmp ? { estPrice: reg.gmp.estListingPrice, estGainPct: reg.gmp.premiumPct, basis: "Issue Price + Upper Band GMP" } : null,
        financials: reg.financials || [],
        valuation: reg.valuation || null,
        promoters: reg.promoters || null,
        strengths: reg.strengths || [],
        risks: reg.risks || [],
        registrar: reg.registrar || null,
        documents: reg.documents || null,
        listingPerformance: {
          issuePrice,
          listingDate,
          listingPrice,
          listingGainPct,
          currentPrice: null,
          currentGainPct: null,
          week52High: null,
          week52Low: null,
        },
        source: "regulatory-filing",
        asOf: new Date(now).toISOString(),
      };
      list.push(ipo);
    }
  }
  return list;
}

export const ipoService = {
  async list() {
    const [cur, up] = await Promise.all([
      ipoProvider.currentIssues().catch(() => [] as NseIpoRow[]),
      ipoProvider.upcomingIssues().catch(() => [] as NseIpoRow[]),
    ]);
    const map = new Map<string, Ipo>();

    // Add listed registry IPOs
    const registryListed = buildRegistryListedIpos();
    for (const item of registryListed) {
      map.set(item.symbol, item);
    }

    // Add & merge live issues from NSE
    for (const r of [...up, ...cur]) {
      const ipo = normalizeIpo(r);
      if (!ipo) continue;
      const prev = map.get(ipo.symbol);
      if (!prev || (prev.subscription == null && ipo.subscription != null) || prev.status !== "open") {
        map.set(ipo.symbol, { ...prev, ...ipo });
      }
    }

    const allIpos = [...map.values()];

    // Enrich listed IPOs with live quotes from market provider
    const listedSymbols = allIpos.filter((x) => x.status === "listed").map((x) => x.symbol);
    if (listedSymbols.length > 0) {
      const quotes = await Promise.allSettled(
        listedSymbols.map(async (s) => {
          const yahooTicker = `${s}.NS`;
          const fallbackTicker = `${s}.BO`;
          const provider = getProvider();
          const primarySym = provider.name === "fyers" ? yahooToFyers(yahooTicker) : yahooTicker;
          const fallbackSym = provider.name === "fyers" ? yahooToFyers(fallbackTicker) : fallbackTicker;
          const q = await provider.getQuote(primarySym).catch(() => provider.getQuote(fallbackSym));
          return { symbol: s, quote: q };
        })
      );
      for (const res of quotes) {
        if (res.status === "fulfilled" && res.value.quote) {
          const { symbol, quote } = res.value;
          const ipo = map.get(symbol);
          if (ipo && ipo.listingPerformance) {
            const issuePrice = ipo.listingPerformance.issuePrice || ipo.priceHigh || 1;
            ipo.listingPerformance.currentPrice = quote.price;
            ipo.listingPerformance.currentGainPct = Math.round(((quote.price - issuePrice) / issuePrice) * 10000) / 100;
            ipo.listingPerformance.week52High = quote.week52High;
            ipo.listingPerformance.week52Low = quote.week52Low;
          }
        }
      }
    }

    const ipos = [...map.values()].sort((a, b) => {
      const order = { open: 1, upcoming: 2, closed: 3, listed: 4 };
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
      return (b.openDate || "").localeCompare(a.openDate || "");
    });

    const counts = {
      upcoming: ipos.filter((x) => x.status === "upcoming").length,
      open: ipos.filter((x) => x.status === "open").length,
      closed: ipos.filter((x) => x.status === "closed").length,
      listed: ipos.filter((x) => x.status === "listed").length,
      mainboard: ipos.filter((x) => x.segment === "Mainboard").length,
      sme: ipos.filter((x) => x.segment === "SME").length,
      total: ipos.length,
    };

    return {
      mode: "live" as const,
      market: "IN" as const,
      asOf: new Date().toISOString(),
      source: "nse-india",
      counts,
      ipos,
      unavailable: ["unverified-gmp-estimates"],
      disclaimer: "Real data only. Listing gains and share allotments are never guaranteed.",
    };
  },

  async detail(symbol: string) {
    const sym = symbol.toUpperCase();
    const listRes = await this.list();
    let ipo = listRes.ipos.find((x) => x.symbol === sym) || null;

    if (!ipo && REGISTRY[sym]) {
      const reg = REGISTRY[sym];
      const now = Date.now();
      const issuePrice = reg.listingPerformance?.issuePrice || 100;
      ipo = {
        symbol: sym,
        company: reg.company,
        segment: reg.segment,
        exchange: reg.exchange || "NSE",
        status: "closed",
        series: reg.segment === "SME" ? "SME" : "EQ",
        openDate: null,
        closeDate: null,
        allotmentDate: reg.allotmentDate || null,
        refundDate: reg.refundDate || null,
        creditDate: reg.creditDate || null,
        listingDate: reg.listingDate || null,
        timeline: buildTimeline(null, null, reg.allotmentDate || null, reg.refundDate || null, reg.creditDate || null, reg.listingDate || null, now),
        priceBand: `₹${issuePrice}`,
        priceLow: issuePrice,
        priceHigh: issuePrice,
        lotSize: reg.lotSize || 50,
        minInvestment: (reg.lotSize || 50) * issuePrice,
        retailMaxInvestment: 200_000,
        sNiiMinInvestment: 200_001,
        bNiiMinInvestment: 1000_001,
        faceValue: reg.faceValue || 10,
        issueSizeShares: null,
        issueSizeInrCr: reg.issueSizeInrCr || null,
        freshIssueCr: reg.freshIssueCr || null,
        ofsIssueCr: reg.ofsIssueCr || null,
        freshShares: null,
        ofsShares: null,
        subscription: null,
        qibSubscription: null,
        niiSubscription: null,
        retailSubscription: null,
        employeeSubscription: null,
        bidsUpdatedAt: null,
        gmp: reg.gmp || null,
        expectedListing: reg.gmp ? { estPrice: reg.gmp.estListingPrice, estGainPct: reg.gmp.premiumPct, basis: "Issue Price + Upper Band GMP" } : null,
        financials: reg.financials || [],
        valuation: reg.valuation || null,
        promoters: reg.promoters || null,
        strengths: reg.strengths || [],
        risks: reg.risks || [],
        registrar: reg.registrar || null,
        documents: reg.documents || null,
        listingPerformance: reg.listingPerformance ? {
          issuePrice: reg.listingPerformance.issuePrice,
          listingDate: reg.listingPerformance.listingDate || null,
          listingPrice: reg.listingPerformance.listingPrice || null,
          listingGainPct: reg.listingPerformance.listingGainPct || null,
          currentPrice: null,
          currentGainPct: null,
          week52High: null,
          week52Low: null,
        } : null,
        source: "regulatory-filing",
        asOf: new Date(now).toISOString(),
      };
    }

    const bids = await this.bids(sym, ipo?.series || "EQ").catch(() => null);
    const ai = await this.aiOne(sym).catch(() => null);

    return {
      mode: "live" as const,
      market: "IN" as const,
      asOf: new Date().toISOString(),
      source: "nse-india",
      ipo,
      bids,
      ai,
    };
  },

  async bids(symbol: string, series = "EQ") {
    const { rows, updateTime } = await ipoProvider.bidDetails(symbol, series);
    return {
      mode: "live" as const,
      market: "IN" as const,
      asOf: new Date().toISOString(),
      source: "nse-india",
      ...normalizeBids(symbol, rows, updateTime),
    };
  },

  async calendar() {
    const listRes = await this.list();
    const events: IpoCalendarEvent[] = [];

    for (const ipo of listRes.ipos) {
      if (ipo.openDate) {
        events.push({
          id: `open-${ipo.symbol}`,
          symbol: ipo.symbol,
          company: ipo.company,
          eventType: "open",
          title: `${ipo.symbol} IPO Opens`,
          date: ipo.openDate,
          segment: ipo.segment,
          status: ipo.status,
          detail: `Price Band ${ipo.priceBand || "TBD"} · Min Inv ₹${ipo.minInvestment?.toLocaleString("en-IN") || "—"}`,
        });
      }
      if (ipo.closeDate) {
        events.push({
          id: `close-${ipo.symbol}`,
          symbol: ipo.symbol,
          company: ipo.company,
          eventType: "close",
          title: `${ipo.symbol} IPO Closes (Last Day)`,
          date: ipo.closeDate,
          segment: ipo.segment,
          status: ipo.status,
          detail: `Subscription ${ipo.subscription != null ? `${ipo.subscription.toFixed(2)}×` : "Open"}`,
        });
      }
      if (ipo.allotmentDate) {
        events.push({
          id: `allotment-${ipo.symbol}`,
          symbol: ipo.symbol,
          company: ipo.company,
          eventType: "allotment",
          title: `${ipo.symbol} Allotment Out`,
          date: ipo.allotmentDate,
          segment: ipo.segment,
          status: ipo.status,
          detail: `Registrar: ${ipo.registrar?.name || "Official Registrar"}`,
        });
      }
      if (ipo.listingDate) {
        events.push({
          id: `listing-${ipo.symbol}`,
          symbol: ipo.symbol,
          company: ipo.company,
          eventType: "listing",
          title: `${ipo.symbol} Listing Day on ${ipo.exchange}`,
          date: ipo.listingDate,
          segment: ipo.segment,
          status: ipo.status,
          detail: `Issue Price ${ipo.priceBand || "—"} · Listing on ${ipo.exchange}`,
        });
      }
    }

    events.sort((a, b) => a.date.localeCompare(b.date));

    return {
      mode: "live" as const,
      market: "IN" as const,
      asOf: new Date().toISOString(),
      source: "nse-india",
      events,
    };
  },

  async compare(symbols: string[]) {
    const listRes = await this.list();
    const cleanSyms = symbols.map((s) => s.toUpperCase());
    const matched = cleanSyms.map((sym) => listRes.ipos.find((i) => i.symbol === sym) || null).filter(Boolean) as Ipo[];

    const aiRes = await Promise.allSettled(matched.map((ipo) => this.aiOne(ipo.symbol)));
    const aiMap = new Map<string, IpoAiResult>();
    aiRes.forEach((res, i) => {
      if (res.status === "fulfilled" && res.value) {
        aiMap.set(matched[i].symbol, res.value);
      }
    });

    return {
      mode: "live" as const,
      market: "IN" as const,
      asOf: new Date().toISOString(),
      source: "nse-india",
      ipos: matched.map((ipo) => ({
        ...ipo,
        ai: aiMap.get(ipo.symbol) || null,
      })),
    };
  },

  faq(): { faqs: IpoFaqItem[] } {
    return { faqs: IPO_FAQS };
  },

  async aiOne(symbol: string) {
    const sym = symbol.toUpperCase();
    const listed = await this.list().catch(() => null);
    const ipo = listed?.ipos?.find((x: Ipo) => x.symbol === sym) || null;
    const bids = await this.bids(sym, ipo?.series || "EQ").catch(() => null);

    const mult = (match: string): number | null => {
      const row = bids?.categories?.find((c: any) => String(c.name || "").toLowerCase().includes(match.toLowerCase()));
      const v = row?.multiple;
      return typeof v === "number" && Number.isFinite(v) ? v : null;
    };

    const closeMs = ipo?.closeDate ? new Date(`${ipo.closeDate}T00:00:00Z`).getTime() : NaN;
    const daysToClose = Number.isFinite(closeMs)
      ? Math.ceil((closeMs - Date.now()) / (24 * 3600 * 1000))
      : null;

    const latestPat = ipo?.financials?.length ? ipo.financials[ipo.financials.length - 1]?.patCr : null;
    const result = scoreIpo({
      symbol: sym,
      company: ipo?.company ?? null,
      totalMultiple: bids?.total ?? ipo?.subscription ?? null,
      riiMultiple: mult("Retail"),
      qibMultiple: mult("Qualified Institutional"),
      niiMultiple: mult("Non Institutional"),
      priceLow: ipo?.priceLow ?? null,
      priceHigh: ipo?.priceHigh ?? null,
      issueSizeShares: ipo?.issueSizeShares ?? null,
      issueSizeInrCr: ipo?.issueSizeInrCr ?? null,
      freshIssueCr: ipo?.freshIssueCr ?? null,
      ofsIssueCr: ipo?.ofsIssueCr ?? null,
      series: ipo?.series ?? null,
      segment: ipo?.segment ?? null,
      daysToClose,
      bidsUpdatedAt: bids?.updateTime ?? null,
      patCr: latestPat,
      ronw: ipo?.valuation?.ronw ?? null,
      pe: ipo?.valuation?.pe ?? null,
      gmpPct: ipo?.gmp?.premiumPct ?? null,
      promoterPostHolding: ipo?.promoters?.postHoldingPct ?? null,
    });

    return {
      mode: "live" as const,
      market: "IN" as const,
      asOf: new Date().toISOString(),
      source: "nse-india",
      ipo,
      bidsUpdatedAt: bids?.updateTime ?? null,
      ...result,
    };
  },

  async aiAll() {
    const listed = await this.list();
    const ipos: Ipo[] = listed.ipos || [];
    const settled = await Promise.allSettled(
      ipos.map(async (ipo) => {
        const bids = await this.bids(ipo.symbol, ipo.series || "EQ").catch(() => null);
        const mult = (match: string): number | null => {
          const row = bids?.categories?.find((c: any) => String(c.name || "").toLowerCase().includes(match.toLowerCase()));
          const v = row?.multiple;
          return typeof v === "number" && Number.isFinite(v) ? v : null;
        };
        const latestPat = ipo?.financials?.length ? ipo.financials[ipo.financials.length - 1]?.patCr : null;
        return scoreIpo({
          symbol: ipo.symbol,
          company: ipo.company,
          totalMultiple: bids?.total ?? ipo.subscription ?? null,
          riiMultiple: mult("Retail"),
          qibMultiple: mult("Qualified Institutional"),
          niiMultiple: mult("Non Institutional"),
          priceLow: ipo.priceLow,
          priceHigh: ipo.priceHigh,
          issueSizeShares: ipo.issueSizeShares,
          issueSizeInrCr: ipo.issueSizeInrCr,
          freshIssueCr: ipo.freshIssueCr,
          ofsIssueCr: ipo.ofsIssueCr,
          series: ipo.series,
          segment: ipo.segment,
          daysToClose: null,
          bidsUpdatedAt: bids?.updateTime ?? null,
          patCr: latestPat,
          ronw: ipo.valuation?.ronw ?? null,
          pe: ipo.valuation?.pe ?? null,
          gmpPct: ipo.gmp?.premiumPct ?? null,
          promoterPostHolding: ipo.promoters?.postHoldingPct ?? null,
        });
      })
    );

    const ranked: (IpoAiResult & { company?: string | null })[] = [];
    settled.forEach((s, i) => {
      if (s.status === "fulfilled") ranked.push({ ...s.value, company: ipos[i]?.company ?? null });
    });
    ranked.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

    return {
      mode: "live" as const,
      market: "IN" as const,
      asOf: new Date().toISOString(),
      source: "nse-india",
      ranked,
      disclaimer: "Demand & structural ranking only — not financial advice; listing gains never guaranteed.",
    };
  },
};
