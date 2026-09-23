import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";
export const validate = (schema: ZodSchema, src: "body" | "query" = "body") => (req: Request, res: Response, next: NextFunction) => {
  const r = schema.safeParse(req[src]);
  if (!r.success) return res.status(400).json({ error: "Validation failed", details: r.error.flatten() });
  (req as any)[src] = r.data;
  next();
};
