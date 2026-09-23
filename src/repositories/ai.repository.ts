import { prisma } from "../config/db";

export const aiRepo = {
  latest: (stockId: string) => prisma.aiAnalysis.findFirst({ where: { stockId }, orderBy: { createdAt: "desc" } }),
  create: (data: any) => prisma.aiAnalysis.create({ data }),
  score: (stockId: string) => prisma.stockScore.findUnique({ where: { stockId } }),
};
