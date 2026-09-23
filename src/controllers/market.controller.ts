import { Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { marketService } from "../market/market.service";
import { indiaAnalysisService } from "../market/india-analysis.service";
import { ipoService } from "../market/ipo.service";
import { resolveLang } from "../market/lang";

// All handlers below serve REAL NSE/BSE provider data with mode: "live".
// On any provider failure they return 502/503 — never fabricated numbers.
export const status = asyncHandler(async (req: any, res: Response) => res.json(marketService.status(req.query.mode)));
export const indices = asyncHandler(async (_: any, res: Response) => res.json(await marketService.indices()));
export const quotes = asyncHandler(async (req: any, res: Response) => {
  const symbols = String(req.query.symbols || "").split(",").map((s: string) => s.trim()).filter(Boolean);
  res.json(await marketService.quotes(symbols));
});
export const history = asyncHandler(async (req: any, res: Response) =>
  res.json(await marketService.history(req.params.symbol, (req.query.interval as string) || "1d", (req.query.range as string) || "6mo")));
export const search = asyncHandler(async (req: any, res: Response) => res.json(await marketService.search((req.query.q as string) || "")));
export const movers = asyncHandler(async (_: any, res: Response) => res.json(await marketService.movers()));
export const indiaAnalyze = asyncHandler(async (req: any, res: Response) => res.json(await indiaAnalysisService.analyze(req.params.symbol, resolveLang(req.query.lang))));
export const indiaOpportunities = asyncHandler(async (req: any, res: Response) => res.json(await indiaAnalysisService.scanOpportunities(Number(req.query.limit) || 8, resolveLang(req.query.lang))));
export const indiaCompare = asyncHandler(async (req: any, res: Response) => {
  const symbols = String(req.query.symbols || "").split(",").map((s: string) => s.trim()).filter(Boolean);
  res.json(await indiaAnalysisService.compare(symbols, resolveLang(req.query.lang)));
});
export const indiaMarket = asyncHandler(async (req: any, res: Response) => res.json(await indiaAnalysisService.marketOverview(resolveLang(req.query.lang))));
export const indiaSectors = asyncHandler(async (req: any, res: Response) => res.json(await indiaAnalysisService.sectorConstituents(resolveLang(req.query.lang))));
export const indiaForecasts = asyncHandler(async (req: any, res: Response) => res.json(await indiaAnalysisService.forecastHistory(req.params.symbol, resolveLang(req.query.lang))));
export const indiaEvaluation = asyncHandler(async (req: any, res: Response) => {
  const symbols = String(req.query.symbols || "").split(",").map((s: string) => s.trim()).filter(Boolean);
  res.json(await indiaAnalysisService.evaluation(symbols, resolveLang(req.query.lang)));
});
export const indiaCalendar = asyncHandler(async (_: any, res: Response) => res.json(await indiaAnalysisService.calendar()));
export const indiaScreen = asyncHandler(async (req: any, res: Response) => res.json(await indiaAnalysisService.screenNatural((req.query.q as string) || "", resolveLang(req.query.lang))));
export const ipoCurrent = asyncHandler(async (_: any, res: Response) => res.json(await ipoService.list()));
export const ipoDetail = asyncHandler(async (req: any, res: Response) => res.json(await ipoService.detail(req.params.symbol)));
export const ipoCalendar = asyncHandler(async (_: any, res: Response) => res.json(await ipoService.calendar()));
export const ipoFaq = asyncHandler(async (_: any, res: Response) => res.json(ipoService.faq()));
export const ipoCompare = asyncHandler(async (req: any, res: Response) => {
  const symbols = String(req.query.symbols || "").split(",").map((s: string) => s.trim()).filter(Boolean);
  res.json(await ipoService.compare(symbols));
});
export const ipoBids = asyncHandler(async (req: any, res: Response) =>
  res.json(await ipoService.bids(req.params.symbol, (req.query.series as string) || "EQ")));
export const ipoAiAll = asyncHandler(async (_: any, res: Response) => res.json(await ipoService.aiAll()));
export const ipoAiOne = asyncHandler(async (req: any, res: Response) => res.json(await ipoService.aiOne(req.params.symbol)));
