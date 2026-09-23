"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.env = {
    PORT: Number(process.env.PORT || 4000),
    DATABASE_URL: process.env.DATABASE_URL || "",
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || "dev-access",
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || "dev-refresh",
    JWT_ACCESS_EXPIRES: process.env.JWT_ACCESS_EXPIRES || "15m",
    JWT_REFRESH_EXPIRES: process.env.JWT_REFRESH_EXPIRES || "7d",
    CORS_ORIGIN: process.env.CORS_ORIGIN || "http://localhost:5173",
    PROVIDER: process.env.MARKET_DATA_PROVIDER || "demo",
    // LIVE market mode: "demo" (local DB seed data) or "live" (real NSE/BSE provider data). Never mixed.
    MARKET_MODE: (process.env.MARKET_MODE === "live" ? "live" : "demo"),
};
