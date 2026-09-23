// Plain-Node entry point. Run from this directory:
//
//   node server.js
//
// Loads the TypeScript sources in ./src via ts-node (no build step needed).
require("ts-node").register({ transpileOnly: true });
require("./src/index.ts");
