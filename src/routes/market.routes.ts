import { Router } from "express";
import * as m from "../controllers/market.controller";

const r = Router();

// Live NSE/BSE market data (public) — always real provider data, mode: "live"
r.get("/market/status", m.status);
r.get("/market/indices", m.indices);
r.get("/market/quotes", m.quotes);
r.get("/market/history/:symbol", m.history);
r.get("/market/search", m.search);
r.get("/market/movers", m.movers);
r.get("/market/india/analysis/:symbol", m.indiaAnalyze);
r.get("/market/india/opportunities", m.indiaOpportunities);
r.get("/market/india/screen", m.indiaScreen);
r.get("/market/india/compare", m.indiaCompare);
r.get("/market/india/market", m.indiaMarket);
r.get("/market/india/sectors", m.indiaSectors);
r.get("/market/india/forecasts/:symbol", m.indiaForecasts);
r.get("/market/india/evaluation", m.indiaEvaluation);
r.get("/market/india/calendar", m.indiaCalendar);
r.get("/market/ipo/current", m.ipoCurrent);
r.get("/market/ipo/calendar", m.ipoCalendar);
r.get("/market/ipo/faq", m.ipoFaq);
r.get("/market/ipo/compare", m.ipoCompare);
r.get("/market/ipo/detail/:symbol", m.ipoDetail);
r.get("/market/ipo/bids/:symbol", m.ipoBids);
r.get("/market/ipo/ai", m.ipoAiAll);
r.get("/market/ipo/ai/:symbol", m.ipoAiOne);

export default r;
