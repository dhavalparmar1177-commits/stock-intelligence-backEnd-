"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const m = __importStar(require("../controllers/market.controller"));
const r = (0, express_1.Router)();
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
r.get("/market/india/forecasts/:symbol", m.indiaForecasts);
r.get("/market/india/evaluation", m.indiaEvaluation);
r.get("/market/india/calendar", m.indiaCalendar);
r.get("/market/ipo/current", m.ipoCurrent);
r.get("/market/ipo/bids/:symbol", m.ipoBids);
r.get("/market/ipo/ai", m.ipoAiAll);
r.get("/market/ipo/ai/:symbol", m.ipoAiOne);
exports.default = r;
