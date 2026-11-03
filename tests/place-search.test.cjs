const { test } = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const { queryKeys } = require("../src/lib/query-keys.ts");

function loadHook() {
  let options;
  let cancelled;
  let sent;
  const filename = path.resolve(__dirname, "../src/hooks/use-place-search.ts");
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = loaded.require.bind(loaded);
  loaded.require = (specifier) => {
    if (specifier === "@tanstack/react-query") {
      return {
        skipToken: Symbol.for("skip"),
        useQuery: (value) => {
          options = value;
          return {};
        },
        useQueryClient: () => ({
          cancelQueries: (value) => {
            cancelled = value;
          },
        }),
      };
    }
    if (specifier === "@/lib/api/places") {
      return {
        searchPlaces: (request, transport) => {
          sent = { request, transport };
        },
      };
    }
    return originalRequire(specifier);
  };
  loaded._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText,
    filename,
  );
  return {
    hook: loaded.exports.usePlaceSearch,
    options: () => options,
    cancelled: () => cancelled,
    sent: () => sent,
  };
}

const request = { city: "Leipzig", radius_km: 5, amenities: ["cafe"] };

test("expensive searches do not automatically repeat on failure or reconnect", () => {
  const h = loadHook();
  h.hook(request);
  assert.equal(h.options().retry, false);
  assert.equal(h.options().refetchOnReconnect, false);
});

test("Cancel targets only the active search and its signal reaches the transport", () => {
  const h = loadHook();
  const query = h.hook(request);
  const signal = new AbortController().signal;
  h.options().queryFn({ signal });
  assert.deepEqual(h.sent(), { request, transport: { signal } });
  query.cancel();
  assert.deepEqual(h.cancelled(), { queryKey: queryKeys.places.search(request), exact: true });
});

test("no submitted search stays disabled", () => {
  const h = loadHook();
  h.hook(null);
  assert.equal(h.options().queryFn, Symbol.for("skip"));
});
