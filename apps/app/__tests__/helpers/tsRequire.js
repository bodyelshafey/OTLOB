/**
 * Dependency-free test harness: lets plain `node --test` load this app's
 * TypeScript sources (transpiled with the repo's own `typescript`), resolve the
 * "@/..." alias, and swap React-Native-only modules for stubs. No jest-expo /
 * babel needed.
 */
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");

const ROOT = path.resolve(__dirname, "..", "..");
const ts = require(require.resolve("typescript", { paths: [ROOT] }));

const stubs = new Map();

require.extensions[".ts"] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  });
  module._compile(outputText, filename);
};

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (typeof request === "string" && request.startsWith("@/") && !stubs.has(request)) {
    request = path.join(ROOT, request.slice(2));
  }
  return origResolve.call(this, request, ...rest);
};

const origLoad = Module._load;
Module._load = function (request, ...rest) {
  if (stubs.has(request)) return stubs.get(request);
  return origLoad.call(this, request, ...rest);
};

/** Replace a module (by the exact specifier the source uses) for subsequent loads. */
function stub(specifier, exports) {
  stubs.set(specifier, exports);
}
function clearStubs() {
  stubs.clear();
}

/** Require an app source file with a clean module cache (fresh module state). */
function loadFresh(relativePath) {
  for (const key of Object.keys(require.cache)) {
    if (key.startsWith(ROOT) && !key.includes("node_modules")) delete require.cache[key];
  }
  return require(path.join(ROOT, relativePath));
}

module.exports = { ROOT, stub, clearStubs, loadFresh };
