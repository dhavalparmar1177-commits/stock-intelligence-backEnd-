"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const env_1 = require("./config/env");
const routes_1 = __importDefault(require("./routes"));
const error_middleware_1 = require("./middlewares/error.middleware");
const rate_limit_middleware_1 = require("./middlewares/rate-limit.middleware");
function createApp() {
    const app = (0, express_1.default)();
    // Prisma returns BigInt for volume fields; convert so res.json() never crashes.
    app.set("json replacer", (_k, v) => (typeof v === "bigint" ? Number(v) : v));
    app.use((0, helmet_1.default)());
    const allowedOrigins = (env_1.env.CORS_ORIGIN || "http://localhost:5173,http://localhost:5174")
        .split(",")
        .map((o) => o.trim());
    app.use((0, cors_1.default)({ origin: (origin, cb) => {
            if (!origin || allowedOrigins.includes(origin))
                cb(null, true);
            else
                cb(new Error("Not allowed by CORS"));
        } }));
    app.use(express_1.default.json({ limit: "1mb" }));
    app.use("/api/v1", rate_limit_middleware_1.apiLimiter, routes_1.default);
    app.get("/health", (_req, res) => res.json({ ok: true, demo: true }));
    app.use(error_middleware_1.errorHandler);
    return app;
}
