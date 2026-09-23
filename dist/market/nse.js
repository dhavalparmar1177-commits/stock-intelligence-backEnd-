"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NIFTY = exports.SECTOR_INDEX = void 0;
exports.resolveIndian = resolveIndian;
const ApiError_1 = require("../utils/ApiError");
const symbols_1 = require("./symbols");
const KNOWN = [...symbols_1.APP_SYMBOLS, ...symbols_1.MOVERS_UNIVERSE];
function resolveIndian(input) {
    const s = input.trim().toUpperCase();
    if (!s)
        throw new ApiError_1.ApiError(400, "Provide a symbol");
    const known = KNOWN.find((x) => x.app === s || x.yahoo === s);
    if (known) {
        if (known.exchange !== "NSE" && known.exchange !== "BSE") {
            throw new ApiError_1.ApiError(400, `Only NSE and BSE stocks are supported (${s} is ${known.exchange})`);
        }
        return { appSymbol: known.app, yahoo: known.yahoo, name: known.name, exchange: known.exchange };
    }
    const yahoo = (0, symbols_1.toYahoo)(s);
    if (yahoo.endsWith(".NS"))
        return { appSymbol: (0, symbols_1.toApp)(yahoo), yahoo, name: (0, symbols_1.toApp)(yahoo), exchange: "NSE" };
    if (yahoo.endsWith(".BO"))
        return { appSymbol: (0, symbols_1.toApp)(yahoo), yahoo, name: (0, symbols_1.toApp)(yahoo), exchange: "BSE" };
    throw new ApiError_1.ApiError(400, `Only NSE and BSE stocks are supported (got "${input}"). Use e.g. RELIANCE, TCS.NS, INFY.BO.`);
}
// Company sector -> Yahoo sector-index ticker (NSE). Unknown symbols get
// NIFTY-only market context instead of a fabricated sector.
exports.SECTOR_INDEX = {
    RELIANCE: { sector: "Energy", index: "^CNXENERGY", indexName: "Nifty Energy" },
    TCS: { sector: "IT", index: "^CNXIT", indexName: "Nifty IT" },
    INFY: { sector: "IT", index: "^CNXIT", indexName: "Nifty IT" },
    HDFCBANK: { sector: "Banking", index: "^NSEBANK", indexName: "Nifty Bank" },
    ICICIBANK: { sector: "Banking", index: "^NSEBANK", indexName: "Nifty Bank" },
    AXISBANK: { sector: "Banking", index: "^NSEBANK", indexName: "Nifty Bank" },
    KOTAKBANK: { sector: "Banking", index: "^NSEBANK", indexName: "Nifty Bank" },
    SBIN: { sector: "Banking", index: "^CNXPSUBANK", indexName: "Nifty PSU Bank" },
    TATAMOTORS: { sector: "Auto", index: "^CNXAUTO", indexName: "Nifty Auto" },
    ITC: { sector: "FMCG", index: "^CNXFMCG", indexName: "Nifty FMCG" },
    TITAN: { sector: "Consumer", index: "^CNXFMCG", indexName: "Nifty FMCG" },
    BHARTIARTL: { sector: "Telecom", index: "^NSEI", indexName: "NIFTY 50" },
    LT: { sector: "Infrastructure", index: "^NSEI", indexName: "NIFTY 50" },
    HDFCLIFE: { sector: "Insurance", index: "^NSEI", indexName: "NIFTY 50" },
    SBILIFE: { sector: "Insurance", index: "^NSEI", indexName: "NIFTY 50" },
};
exports.NIFTY = "^NSEI";
