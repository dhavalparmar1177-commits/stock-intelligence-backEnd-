import { ApiError } from "../utils/ApiError";
import { APP_SYMBOLS, MOVERS_UNIVERSE, toApp, toYahoo } from "./symbols";

// India-only gate: NSE (.NS) and BSE (.BO) listings. Everything else —
// US stocks, indices, futures — is rejected so forecasts stay in scope.
export interface IndianRef {
  appSymbol: string;
  yahoo: string;
  name: string;
  exchange: "NSE" | "BSE";
}

const KNOWN = [...APP_SYMBOLS, ...MOVERS_UNIVERSE];

export function resolveIndian(input: string): IndianRef {
  const s = input.trim().toUpperCase();
  if (!s) throw new ApiError(400, "Provide a symbol");
  const known = KNOWN.find((x) => x.app === s || x.yahoo === s);
  if (known) {
    if (known.exchange !== "NSE" && known.exchange !== "BSE") {
      throw new ApiError(400, `Only NSE and BSE stocks are supported (${s} is ${known.exchange})`);
    }
    return { appSymbol: known.app, yahoo: known.yahoo, name: known.name, exchange: known.exchange };
  }
  const yahoo = toYahoo(s);
  if (yahoo.endsWith(".NS")) return { appSymbol: toApp(yahoo), yahoo, name: toApp(yahoo), exchange: "NSE" };
  if (yahoo.endsWith(".BO")) return { appSymbol: toApp(yahoo), yahoo, name: toApp(yahoo), exchange: "BSE" };
  throw new ApiError(400, `Only NSE and BSE stocks are supported (got "${input}"). Use e.g. RELIANCE, TCS.NS, INFY.BO.`);
}

// Company sector -> Yahoo sector-index ticker (NSE). Unknown symbols get
// NIFTY-only market context instead of a fabricated sector.
export const SECTOR_INDEX: Record<string, { sector: string; index: string; indexName: string }> = {
  RELIANCE: { sector: "Energy", index: "^CNXENERGY", indexName: "Nifty Energy" },
  TCS: { sector: "IT", index: "^CNXIT", indexName: "Nifty IT" },
  INFY: { sector: "IT", index: "^CNXIT", indexName: "Nifty IT" },
  HDFCBANK: { sector: "Banking", index: "^NSEBANK", indexName: "Nifty Bank" },
  ICICIBANK: { sector: "Banking", index: "^NSEBANK", indexName: "Nifty Bank" },
  AXISBANK: { sector: "Banking", index: "^NSEBANK", indexName: "Nifty Bank" },
  KOTAKBANK: { sector: "Banking", index: "^NSEBANK", indexName: "Nifty Bank" },
  SBIN: { sector: "Banking", index: "^CNXPSUBANK", indexName: "Nifty PSU Bank" },
  TATAMOTORS: { sector: "Auto", index: "^CNXAUTO", indexName: "Nifty Auto" },
  ITC: { sector: "FMCG", index: "^CNXFMCG", indexName: "Nifty FMCG" },
  TITAN: { sector: "Consumer", index: "^CNXFMCG", indexName: "Nifty FMCG" },
  BHARTIARTL: { sector: "Telecom", index: "^NSEI", indexName: "NIFTY 50" },
  LT: { sector: "Infrastructure", index: "^NSEI", indexName: "NIFTY 50" },
  HDFCLIFE: { sector: "Insurance", index: "^NSEI", indexName: "NIFTY 50" },
  SBILIFE: { sector: "Insurance", index: "^NSEI", indexName: "NIFTY 50" },
};

// Full sector -> constituent stocks mapping based on real NSE Nifty index compositions.
// Each stock uses a real Yahoo Finance .NS ticker.
export interface SectorStock {
  app: string;
  yahoo: string;
  name: string;
}

export interface SectorDef {
  sector: string;
  index: string;
  indexName: string;
  stocks: SectorStock[];
}

export const SECTOR_STOCKS: SectorDef[] = [
  {
    sector: "Banking",
    index: "^NSEBANK",
    indexName: "Nifty Bank",
    stocks: [
      { app: "HDFCBANK", yahoo: "HDFCBANK.NS", name: "HDFC Bank Ltd" },
      { app: "ICICIBANK", yahoo: "ICICIBANK.NS", name: "ICICI Bank Ltd" },
      { app: "AXISBANK", yahoo: "AXISBANK.NS", name: "Axis Bank Ltd" },
      { app: "KOTAKBANK", yahoo: "KOTAKBANK.NS", name: "Kotak Mahindra Bank" },
      { app: "SBIN", yahoo: "SBIN.NS", name: "State Bank of India" },
      { app: "INDUSINDBK", yahoo: "INDUSINDBK.NS", name: "IndusInd Bank Ltd" },
      { app: "PNB", yahoo: "PNB.NS", name: "Punjab National Bank" },
      { app: "BANKBARODA", yahoo: "BANKBARODA.NS", name: "Bank of Baroda" },
    ],
  },
  {
    sector: "IT",
    index: "^CNXIT",
    indexName: "Nifty IT",
    stocks: [
      { app: "TCS", yahoo: "TCS.NS", name: "Tata Consultancy Services" },
      { app: "INFY", yahoo: "INFY.NS", name: "Infosys Ltd" },
      { app: "WIPRO", yahoo: "WIPRO.NS", name: "Wipro Ltd" },
      { app: "HCLTECH", yahoo: "HCLTECH.NS", name: "HCL Technologies Ltd" },
      { app: "TECHM", yahoo: "TECHM.NS", name: "Tech Mahindra Ltd" },
      { app: "LTIM", yahoo: "LTIM.NS", name: "LTIMindtree Ltd" },
      { app: "COFORGE", yahoo: "COFORGE.NS", name: "Coforge Ltd" },
    ],
  },
  {
    sector: "Energy",
    index: "^CNXENERGY",
    indexName: "Nifty Energy",
    stocks: [
      { app: "RELIANCE", yahoo: "RELIANCE.NS", name: "Reliance Industries Ltd" },
      { app: "NTPC", yahoo: "NTPC.NS", name: "NTPC Ltd" },
      { app: "POWERGRID", yahoo: "POWERGRID.NS", name: "Power Grid Corp" },
      { app: "ONGC", yahoo: "ONGC.NS", name: "Oil & Natural Gas Corp" },
      { app: "TATAPOWER", yahoo: "TATAPOWER.NS", name: "Tata Power Co Ltd" },
      { app: "BPCL", yahoo: "BPCL.NS", name: "Bharat Petroleum Corp" },
      { app: "HPCL", yahoo: "HPCL.NS", name: "Hindustan Petroleum Corp" },
      { app: "ADANIGREEN", yahoo: "ADANIGREEN.NS", name: "Adani Green Energy" },
    ],
  },
  {
    sector: "Auto",
    index: "^CNXAUTO",
    indexName: "Nifty Auto",
    stocks: [
      { app: "TATAMOTORS", yahoo: "TATAMOTORS.NS", name: "Tata Motors Ltd" },
      { app: "MARUTI", yahoo: "MARUTI.NS", name: "Maruti Suzuki India" },
      { app: "M_M", yahoo: "M_M.NS", name: "Mahindra & Mahindra" },
      { app: "BAJAJAUTO", yahoo: "BAJAJAUTO.NS", name: "Bajaj Auto Ltd" },
      { app: "HEROMOTOCO", yahoo: "HEROMOTOCO.NS", name: "Hero MotoCorp Ltd" },
      { app: "EICHERMOT", yahoo: "EICHERMOT.NS", name: "Eicher Motors Ltd" },
      { app: "ASHOKLEY", yahoo: "ASHOKLEY.NS", name: "Ashok Leyland Ltd" },
      { app: "TVSMOTOR", yahoo: "TVSMOTOR.NS", name: "TVS Motor Company" },
    ],
  },
  {
    sector: "FMCG",
    index: "^CNXFMCG",
    indexName: "Nifty FMCG",
    stocks: [
      { app: "ITC", yahoo: "ITC.NS", name: "ITC Ltd" },
      { app: "HINDUNILVR", yahoo: "HINDUNILVR.NS", name: "Hindustan Unilever" },
      { app: "NESTLEIND", yahoo: "NESTLEIND.NS", name: "Nestle India Ltd" },
      { app: "BRITANNIA", yahoo: "BRITANNIA.NS", name: "Britannia Industries" },
      { app: "DABUR", yahoo: "DABUR.NS", name: "Dabur India Ltd" },
      { app: "MARICO", yahoo: "MARICO.NS", name: "Marico Ltd" },
      { app: "COLPAL", yahoo: "COLPAL.NS", name: "Colgate-Palmolive India" },
      { app: "GODREJCP", yahoo: "GODREJCP.NS", name: "Godrej Consumer Products" },
    ],
  },
  {
    sector: "Pharma",
    index: "^CNXPHARMA",
    indexName: "Nifty Pharma",
    stocks: [
      { app: "SUNPHARMA", yahoo: "SUNPHARMA.NS", name: "Sun Pharmaceutical" },
      { app: "DRREDDY", yahoo: "DRREDDY.NS", name: "Dr. Reddy's Laboratories" },
      { app: "CIPLA", yahoo: "CIPLA.NS", name: "Cipla Ltd" },
      { app: "DIVISLAB", yahoo: "DIVISLAB.NS", name: "Divi's Laboratories" },
      { app: "AUROPHARMA", yahoo: "AUROPHARMA.NS", name: "Aurobindo Pharma" },
      { app: "ALKEM", yahoo: "ALKEM.NS", name: "Alkem Laboratories" },
      { app: "IPCALAB", yahoo: "IPCALAB.NS", name: "IPCA Laboratories" },
    ],
  },
  {
    sector: "Metal",
    index: "^CNXMETAL",
    indexName: "Nifty Metal",
    stocks: [
      { app: "TATASTEEL", yahoo: "TATASTEEL.NS", name: "Tata Steel Ltd" },
      { app: "JSWSTEEL", yahoo: "JSWSTEEL.NS", name: "JSW Steel Ltd" },
      { app: "HINDALCO", yahoo: "HINDALCO.NS", name: "Hindalco Industries" },
      { app: "VEDL", yahoo: "VEDL.NS", name: "Vedanta Ltd" },
      { app: "COALINDIA", yahoo: "COALINDIA.NS", name: "Coal India Ltd" },
      { app: "NMDC", yahoo: "NMDC.NS", name: "NMDC Ltd" },
      { app: "JINDALSTEL", yahoo: "JINDALSTEL.NS", name: "Jindal Steel & Power" },
    ],
  },
  {
    sector: "Realty",
    index: "^CNXREALTY",
    indexName: "Nifty Realty",
    stocks: [
      { app: "DLF", yahoo: "DLF.NS", name: "DLF Ltd" },
      { app: "GODREJPROP", yahoo: "GODREJPROP.NS", name: "Godrej Properties" },
      { app: "OBEROIRLTY", yahoo: "OBEROIRLTY.NS", name: "Oberoi Realty" },
      { app: "PRESTIGE", yahoo: "PRESTIGE.NS", name: "Prestige Estates" },
      { app: "BRIGADE", yahoo: "BRIGADE.NS", name: "Brigade Enterprises" },
      { app: "SOBHA", yahoo: "SOBHA.NS", name: "Sobha Ltd" },
    ],
  },
  {
    sector: "Infra",
    index: "^CNXINFRA",
    indexName: "Nifty Infra",
    stocks: [
      { app: "LT", yahoo: "LT.NS", name: "Larsen & Toubro Ltd" },
      { app: "ADANIENT", yahoo: "ADANIENT.NS", name: "Adani Enterprises" },
      { app: "ADANIPORTS", yahoo: "ADANIPORTS.NS", name: "Adani Ports & SEZ" },
      { app: "IRB", yahoo: "IRB.NS", name: "IRB Infrastructure" },
      { app: "NCC", yahoo: "NCC.NS", name: "NCC Ltd" },
    ],
  },
  {
    sector: "Consumer Durables",
    index: "^CNXCONSUM",
    indexName: "Nifty Consumption",
    stocks: [
      { app: "TITAN", yahoo: "TITAN.NS", name: "Titan Company Ltd" },
      { app: "VOLTAS", yahoo: "VOLTAS.NS", name: "Voltas Ltd" },
      { app: "BLUESTARLT", yahoo: "BLUESTARLT.NS", name: "Blue Star Ltd" },
      { app: "CROMPTON", yahoo: "CROMPTON.NS", name: "Crompton Greaves CE" },
      { app: "RAJESHEXPO", yahoo: "RAJESHEXPO.NS", name: "Rajesh Exports" },
      { app: "KAJARIACER", yahoo: "KAJARIACER.NS", name: "Kajaria Ceramics" },
    ],
  },
  {
    sector: "Telecom",
    index: "^CNXTELECOM",
    indexName: "Nifty Telecom",
    stocks: [
      { app: "BHARTIARTL", yahoo: "BHARTIARTL.NS", name: "Bharti Airtel Ltd" },
      { app: "IDEA", yahoo: "IDEA.NS", name: "Vodafone Idea Ltd" },
      { app: "INDUSTOWER", yahoo: "INDUSTOWER.NS", name: "Indus Towers Ltd" },
    ],
  },
  {
    sector: "Insurance",
    index: "^CNXINSUR",
    indexName: "Nifty Insurance",
    stocks: [
      { app: "HDFCLIFE", yahoo: "HDFCLIFE.NS", name: "HDFC Life Insurance" },
      { app: "SBILIFE", yahoo: "SBILIFE.NS", name: "SBI Life Insurance" },
      { app: "ICICIPRULI", yahoo: "ICICIPRULI.NS", name: "ICICI Prudential Life" },
    ],
  },
  {
    sector: "PSU",
    index: "^CNXPSUBANK",
    indexName: "Nifty PSU Bank",
    stocks: [
      { app: "SBIN", yahoo: "SBIN.NS", name: "State Bank of India" },
      { app: "PNB", yahoo: "PNB.NS", name: "Punjab National Bank" },
      { app: "BANKBARODA", yahoo: "BANKBARODA.NS", name: "Bank of Baroda" },
      { app: "ONGC", yahoo: "ONGC.NS", name: "Oil & Natural Gas Corp" },
      { app: "NTPC", yahoo: "NTPC.NS", name: "NTPC Ltd" },
      { app: "COALINDIA", yahoo: "COALINDIA.NS", name: "Coal India Ltd" },
      { app: "POWERGRID", yahoo: "POWERGRID.NS", name: "Power Grid Corp" },
      { app: "REC", yahoo: "REC.NS", name: "REC Ltd" },
      { app: "PFC", yahoo: "PFC.NS", name: "Power Finance Corp" },
    ],
  },
];

export const NIFTY = "^NSEI";
