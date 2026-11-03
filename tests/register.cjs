// A test-only TypeScript loader uses the already installed compiler and resolves the app alias.
// This avoids requiring a second bundler or a different Node version for the unit tests.
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (specifier, ...args) {
  const resolved = specifier.startsWith("@/")
    ? path.join(root, "src", specifier.slice(2))
    : specifier;
  return originalResolve.call(this, resolved, ...args);
};
require.extensions[".ts"] = function (module, filename) {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    fileName: filename,
  });
  module._compile(outputText, filename);
};
