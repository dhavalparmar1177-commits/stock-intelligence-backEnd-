import dotenv from "dotenv";
dotenv.config();
export const env = {
  PORT: Number(process.env.PORT || 4000),
  DATABASE_URL: process.env.DATABASE_URL || "",
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || "dev-access",
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || "dev-refresh",
  JWT_ACCESS_EXPIRES: process.env.JWT_ACCESS_EXPIRES || "15m",
  JWT_REFRESH_EXPIRES: process.env.JWT_REFRESH_EXPIRES || "7d",
  CORS_ORIGIN: process.env.CORS_ORIGIN || "http://localhost:5173",
  PROVIDER: process.env.MARKET_DATA_PROVIDER || "demo",
  // LIVE market mode: "demo" (local DB seed data) or "live" (real NSE/BSE provider data). Never mixed.
  MARKET_MODE: (process.env.MARKET_MODE === "live" ? "live" : "demo") as "demo" | "live",
  MARKET_DATA_PROVIDER: (process.env.MARKET_DATA_PROVIDER || "yahoo") as "yahoo" | "fyers",
  IPOGURU_API_KEY: process.env.IPOGURU_API_KEY || "",
  // FYERS API credentials (required when MARKET_DATA_PROVIDER=fyers).
  FYERS_APP_ID: process.env.FYERS_APP_ID || "",
  FYERS_SECRET_KEY: process.env.FYERS_SECRET_KEY || "",
  FYERS_REDIRECT_URL: process.env.FYERS_REDIRECT_URL || "http://localhost:4000/api/v1/market/fyers/callback",
  FYERS_ACCESS_TOKEN: process.env.FYERS_ACCESS_TOKEN || "",
  // WebSocket server config
  WS_PORT: Number(process.env.WS_PORT || 4001),
};
