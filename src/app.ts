import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env";
import routes from "./routes";
import { errorHandler } from "./middlewares/error.middleware";
import { apiLimiter } from "./middlewares/rate-limit.middleware";
export function createApp() {
  const app = express();
  // Prisma returns BigInt for volume fields; convert so res.json() never crashes.
  app.set("json replacer", (_k: string, v: unknown) => (typeof v === "bigint" ? Number(v) : v));
  app.use(helmet());
  const allowedOrigins = (env.CORS_ORIGIN || "http://localhost:5173,http://localhost:5174")
    .split(",")
    .map((o: string) => o.trim());
  app.use(cors({ origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) cb(null, true);
    else cb(new Error("Not allowed by CORS"));
  }}));
  app.use(express.json({ limit: "1mb" }));
  app.use("/api/v1", apiLimiter, routes);
  app.get("/health", (_req, res) => res.json({ ok: true, demo: true }));
  app.use(errorHandler);
  return app;
}
