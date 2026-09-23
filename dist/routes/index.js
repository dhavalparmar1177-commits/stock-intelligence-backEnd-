"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const stock_routes_1 = __importDefault(require("./stock.routes"));
const market_routes_1 = __importDefault(require("./market.routes"));
const alerts_routes_1 = __importDefault(require("./alerts.routes"));
const r = (0, express_1.Router)();
r.use(stock_routes_1.default);
r.use(market_routes_1.default);
r.use(alerts_routes_1.default);
exports.default = r;
