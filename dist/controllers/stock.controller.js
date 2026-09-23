"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.screener = exports.compare = exports.detail = exports.search = exports.dashboard = void 0;
const asyncHandler_1 = require("../utils/asyncHandler");
const stock_service_1 = require("../services/stock.service");
exports.dashboard = (0, asyncHandler_1.asyncHandler)(async (_, res) => res.json(await stock_service_1.stockService.dashboard()));
exports.search = (0, asyncHandler_1.asyncHandler)(async (req, res) => res.json(await stock_service_1.stockService.search(req.query.q || "")));
exports.detail = (0, asyncHandler_1.asyncHandler)(async (req, res) => res.json(await stock_service_1.stockService.detail(req.params.symbol)));
exports.compare = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const symbols = String(req.query.symbols || "").split(",").map((s) => s.trim()).filter(Boolean);
    res.json(await stock_service_1.stockService.compare(symbols));
});
exports.screener = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const q = req.query;
    const num = (v) => (v === undefined || v === "" ? undefined : Number(v));
    res.json(await stock_service_1.stockService.screener({ sector: q.sector, minPE: num(q.minPE), maxPE: num(q.maxPE), minROE: num(q.minROE), minROCE: num(q.minROCE), maxDebtEquity: num(q.maxDebtEquity), minDivYield: num(q.minDivYield), minRevGrowth: num(q.minRevGrowth), minMarketCap: num(q.minMarketCap) }));
});
