import { Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { stockService } from "../services/stock.service";

export const dashboard = asyncHandler(async (_: any, res: Response) => res.json(await stockService.dashboard()));
export const search = asyncHandler(async (req: any, res: Response) => res.json(await stockService.search(req.query.q as string || "")));
export const detail = asyncHandler(async (req: any, res: Response) => res.json(await stockService.detail(req.params.symbol)));
export const compare = asyncHandler(async (req: any, res: Response) => {
  const symbols = String(req.query.symbols || "").split(",").map((s: string) => s.trim()).filter(Boolean);
  res.json(await stockService.compare(symbols));
});
export const screener = asyncHandler(async (req: any, res: Response) => {
  const q = req.query as any;
  const num = (v: any) => (v === undefined || v === "" ? undefined : Number(v));
  res.json(await stockService.screener({ sector: q.sector, minPE: num(q.minPE), maxPE: num(q.maxPE), minROE: num(q.minROE), minROCE: num(q.minROCE), maxDebtEquity: num(q.maxDebtEquity), minDivYield: num(q.minDivYield), minRevGrowth: num(q.minRevGrowth), minMarketCap: num(q.minMarketCap) }));
});
