import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/ApiError";
export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  const status = err instanceof ApiError ? err.status : 500;
  res.status(status).json({ error: err.message || "Internal server error" });
}
