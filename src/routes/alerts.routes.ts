import { Router } from "express";
import * as alerts from "../controllers/alerts.controller";

const r = Router();

r.get("/alerts", alerts.list);
r.post("/alerts", alerts.create);
r.delete("/alerts/:id", alerts.remove);

export default r;
