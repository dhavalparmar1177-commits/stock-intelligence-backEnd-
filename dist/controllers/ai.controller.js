"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.latest = exports.analyze = void 0;
const asyncHandler_1 = require("../utils/asyncHandler");
const ai_service_1 = require("../services/ai.service");
exports.analyze = (0, asyncHandler_1.asyncHandler)(async (req, res) => res.status(201).json(await ai_service_1.aiService.analyze(req.params.symbol)));
exports.latest = (0, asyncHandler_1.asyncHandler)(async (req, res) => res.json(await ai_service_1.aiService.latest(req.params.symbol)));
