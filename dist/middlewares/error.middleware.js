"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const ApiError_1 = require("../utils/ApiError");
function errorHandler(err, _req, res, _next) {
    const status = err instanceof ApiError_1.ApiError ? err.status : 500;
    res.status(status).json({ error: err.message || "Internal server error" });
}
