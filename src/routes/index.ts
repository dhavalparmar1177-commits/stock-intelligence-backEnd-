import { Router } from "express";
import stockRoutes from "./stock.routes";
import marketRoutes from "./market.routes";
import alertsRoutes from "./alerts.routes";

const r = Router();

r.use(stockRoutes);
r.use(marketRoutes);
r.use(alertsRoutes);

export default r;
