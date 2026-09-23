import rateLimit from "express-rate-limit";
export const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 50 });
export const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 120 });
