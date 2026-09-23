import { createApp } from "./app";
import { env } from "./config/env";
import { getProvider } from "./market/provider.factory";
import { startMarketWs } from "./ws/market.ws";

const app = createApp();
app.listen(env.PORT, () => {
  console.log(`Backend on :${env.PORT} (provider: ${getProvider().name}, mode: ${env.MARKET_MODE})`);
  // Start WebSocket server for real-time streaming when using FYERS.
  if (env.MARKET_DATA_PROVIDER === "fyers") {
    startMarketWs();
  }
});
