const path = require("path");

module.exports = {
  entry: {
    "default-handler": "./handlers/default-handler.js",
    "api-handler": "./handlers/api-handler.js",
  },
  target: "node",
  output: {
    filename: "[name].js",
    path: path.resolve("./build/handlers"), // path.resolve(__dirname, "build/handlers"),
  },
  resolve: {
    extensions: [".wasm", ".mjs", ".js", ".json"],
  },
  optimization: {
    minimize: false,
  },
};
