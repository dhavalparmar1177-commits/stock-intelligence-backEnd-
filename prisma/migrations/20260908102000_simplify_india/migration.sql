-- Simplify to AI-powered Indian (NSE/BSE) analysis platform.
-- Drops auth, watchlist, portfolio, alerts and orders tables.
DROP TABLE IF EXISTS "Order" CASCADE;
DROP TABLE IF EXISTS "Alert" CASCADE;
DROP TABLE IF EXISTS "PortfolioHolding" CASCADE;
DROP TABLE IF EXISTS "Portfolio" CASCADE;
DROP TABLE IF EXISTS "WatchlistStock" CASCADE;
DROP TABLE IF EXISTS "Watchlist" CASCADE;
DROP TABLE IF EXISTS "RefreshToken" CASCADE;
DROP TABLE IF EXISTS "User" CASCADE;
DROP TYPE IF EXISTS "Role";
