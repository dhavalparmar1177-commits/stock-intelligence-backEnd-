"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.remove = exports.create = exports.list = void 0;
const asyncHandler_1 = require("../utils/asyncHandler");
let nextId = 1;
const alerts = [];
exports.list = (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    res.json(alerts);
});
exports.create = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { symbol, type, value } = req.body;
    if (!symbol || !type) {
        res.status(400).json({ error: "symbol and type are required" });
        return;
    }
    const alert = {
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
exports.remove = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const id = Number(req.params.id);
    const idx = alerts.findIndex((a) => a.id === id);
    if (idx === -1) {
        res.status(404).json({ error: "Alert not found" });
        return;
    }
    alerts.splice(idx, 1);
    res.json({ ok: true });
});
