import { Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { aiService } from "../services/ai.service";

export const analyze = asyncHandler(async (req: any, res: Response) => res.status(201).json(await aiService.analyze(req.params.symbol)));
export const latest = asyncHandler(async (req: any, res: Response) => res.json(await aiService.latest(req.params.symbol)));
