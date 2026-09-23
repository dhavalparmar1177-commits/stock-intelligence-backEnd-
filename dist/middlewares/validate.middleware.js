"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = void 0;
const validate = (schema, src = "body") => (req, res, next) => {
    const r = schema.safeParse(req[src]);
    if (!r.success)
        return res.status(400).json({ error: "Validation failed", details: r.error.flatten() });
    req[src] = r.data;
    next();
};
exports.validate = validate;
