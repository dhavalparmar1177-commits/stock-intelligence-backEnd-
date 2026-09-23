"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ipoAiOne = exports.ipoAiAll = exports.ipoBids = exports.ipoCurrent = exports.indiaScreen = exports.indiaCalendar = exports.indiaEvaluation = exports.indiaForecasts = exports.indiaMarket = exports.indiaCompare = exports.indiaOpportunities = exports.indiaAnalyze = exports.movers = exports.search = exports.history = exports.quotes = exports.indices = exports.status = void 0;
const asyncHandler_1 = require("../utils/asyncHandler");
const market_service_1 = require("../market/market.service");
const india_analysis_service_1 = require("../market/india-analysis.service");
const ipo_service_1 = require("../market/ipo.service");
const lang_1 = require("../market/lang");
// All handlers below serve REAL NSE/BSE provider data with mode: "live".
// On any provider failure they return 502/503 — never fabricated numbers.
exports.status = (0, asyncHandler_1.asyncHandler)(async (req, res) => res.json(market_service_1.marketService.status(req.query.mode)));
exports.indices = (0, asyncHandler_1.asyncHandler)(async (_, res) => res.json(await market_service_1.marketService.indices()));
exports.quotes = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const symbols = String(req.query.symbols || "").split(",").map((s) => s.trim()).filter(Boolean);
    res.json(await market_service_1.marketService.quotes(symbols));
});
exports.history = (0, asyncHandler_1.asyncHandler)(async (req, res) => res.json(await market_service_1.marketService.history(req.params.symbol, req.query.interval || "1d", req.query.range || "6mo")));
exports.search = (0, asyncHandler_1.asyncHandler)(async (req, res) => res.json(await market_service_1.marketService.search(req.query.q || "")));
exports.movers = (0, asyncHandler_1.asyncHandler)(async (_, res) => res.json(await market_service_1.marketService.movers()));
exports.indiaAnalyze = (0, asyncHandler_1.asyncHandler)(async (req, res) => res.json(await india_analysis_service_1.indiaAnalysisService.analyze(req.params.symbol, (0, lang_1.resolveLang)(req.query.lang))));
exports.indiaOpportunities = (0, asyncHandler_1.asyncHandler)(async (req, res) => res.json(await india_analysis_service_1.indiaAnalysisService.scanOpportunities(Number(req.query.limit) || 8, (0, lang_1.resolveLang)(req.query.lang))));
exports.indiaCompare = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const symbols = String(req.query.symbols || "").split(",").map((s) => s.trim()).filter(Boolean);
    res.json(await india_analysis_service_1.indiaAnalysisService.compare(symbols, (0, lang_1.resolveLang)(req.query.lang)));
});
exports.indiaMarket = (0, asyncHandler_1.asyncHandler)(async (req, res) => res.json(await india_analysis_service_1.indiaAnalysisService.marketOverview((0, lang_1.resolveLang)(req.query.lang))));
exports.indiaForecasts = (0, asyncHandler_1.asyncHandler)(async (req, res) => res.json(await india_analysis_service_1.indiaAnalysisService.forecastHistory(req.params.symbol, (0, lang_1.resolveLang)(req.query.lang))));
exports.indiaEvaluation = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const symbols = String(req.query.symbols || "").split(",").map((s) => s.trim()).filter(Boolean);
    res.json(await india_analysis_service_1.indiaAnalysisService.evaluation(symbols, (0, lang_1.resolveLang)(req.query.lang)));
});
exports.indiaCalendar = (0, asyncHandler_1.asyncHandler)(async (_, res) => res.json(await india_analysis_service_1.indiaAnalysisService.calendar()));
exports.indiaScreen = (0, asyncHandler_1.asyncHandler)(async (req, res) => res.json(await india_analysis_service_1.indiaAnalysisService.screenNatural(req.query.q || "", (0, lang_1.resolveLang)(req.query.lang))));
exports.ipoCurrent = (0, asyncHandler_1.asyncHandler)(async (_, res) => res.json(await ipo_service_1.ipoService.list()));
exports.ipoBids = (0, asyncHandler_1.asyncHandler)(async (req, res) => res.json(await ipo_service_1.ipoService.bids(req.params.symbol, req.query.series || "EQ")));
exports.ipoAiAll = (0, asyncHandler_1.asyncHandler)(async (_, res) => res.json(await ipo_service_1.ipoService.aiAll()));
exports.ipoAiOne = (0, asyncHandler_1.asyncHandler)(async (req, res) => res.json(await ipo_service_1.ipoService.aiOne(req.params.symbol)));
