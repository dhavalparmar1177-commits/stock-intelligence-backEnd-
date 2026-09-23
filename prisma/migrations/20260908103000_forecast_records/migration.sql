-- Store AI forecasts for later accuracy tracking against real prices.
CREATE TABLE IF NOT EXISTS "ForecastRecord" (
  "id" TEXT NOT NULL,
  "symbol" TEXT NOT NULL,
  "exchange" TEXT NOT NULL DEFAULT 'NSE',
  "asOf" TIMESTAMP(3) NOT NULL,
  "priceAtTime" DOUBLE PRECISION NOT NULL,
  "central" DOUBLE PRECISION NOT NULL,
  "low" DOUBLE PRECISION NOT NULL,
  "high" DOUBLE PRECISION NOT NULL,
  "expectedPct" DOUBLE PRECISION NOT NULL,
  "score" INTEGER NOT NULL,
  "signal" TEXT NOT NULL,
  "trend" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ForecastRecord_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ForecastRecord_symbol_createdAt_idx" ON "ForecastRecord"("symbol", "createdAt");
