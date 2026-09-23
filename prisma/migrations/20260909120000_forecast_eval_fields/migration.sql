-- Record AI confidence and exchange-data timestamp alongside each forecast.
-- Nullable: forecasts stored before this migration report "not recorded".
ALTER TABLE IF EXISTS "ForecastRecord" ADD COLUMN IF NOT EXISTS "confidence" INTEGER;
ALTER TABLE IF EXISTS "ForecastRecord" ADD COLUMN IF NOT EXISTS "dataTime" TIMESTAMP(3);
