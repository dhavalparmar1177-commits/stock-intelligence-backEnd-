import { Router } from "express";
import * as stock from "../controllers/stock.controller";
import * as ai from "../controllers/ai.controller";

const r = Router();

// Market overview + search (public)
r.get("/dashboard", stock.dashboard);
r.get("/stocks/search", stock.search);
r.get("/stocks/compare", stock.compare);
r.get("/stocks/screener", stock.screener);
// NOTE: /stocks/:symbol must stay last so it doesn't swallow the routes above
r.get("/stocks/:symbol", stock.detail);
r.get("/stocks/:symbol/ai", ai.latest);
r.post("/stocks/:symbol/ai", ai.analyze);

export default r;
