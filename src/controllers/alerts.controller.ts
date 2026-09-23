import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";

interface Alert {
  id: number;
  stock: { symbol: string };
  type: string;
  value?: number;
  triggered: boolean;
  active: boolean;
  createdAt: string;
}

let nextId = 1;
const alerts: Alert[] = [];

export const list = asyncHandler(async (_req: Request, res: Response) => {
  res.json(alerts);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const { symbol, type, value } = req.body;
  if (!symbol || !type) {
    res.status(400).json({ error: "symbol and type are required" });
    return;
  }
  const alert: Alert = {
    id: nextId++,
    stock: { symbol: symbol.toUpperCase() },
    type,
    value: value != null ? Number(value) : undefined,
    triggered: false,
    active: true,
    createdAt: new Date().toISOString(),
  };
  alerts.push(alert);
  res.status(201).json(alert);
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const idx = alerts.findIndex((a) => a.id === id);
  if (idx === -1) {
    res.status(404).json({ error: "Alert not found" });
    return;
  }
  alerts.splice(idx, 1);
  res.json({ ok: true });
});
