"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiRepo = void 0;
const db_1 = require("../config/db");
exports.aiRepo = {
    latest: (stockId) => db_1.prisma.aiAnalysis.findFirst({ where: { stockId }, orderBy: { createdAt: "desc" } }),
    create: (data) => db_1.prisma.aiAnalysis.create({ data }),
    score: (stockId) => db_1.prisma.stockScore.findUnique({ where: { stockId } }),
};
