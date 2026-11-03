const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

// Exercise the component's actual submit callback with controlled hook state. UI children
// stay unrendered; these cases concern query submission rather than browser layout.
function searchHarness({ submitted = null, isError = false, isFetching = false } = {}) {
  const updates = [];
  let retries = 0;
  const filename = path.resolve(__dirname, "../src/components/search/search-experience.tsx");
  const component = new Module(filename, module);
  component.filename = filename;
  component.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = component.require.bind(component);
  component.require = (specifier) => {
    if (specifier === "react") {
      return { useState: () => [submitted, (request) => updates.push(request)] };
    }
    if (specifier === "@/hooks/use-place-search") {
      return {
        usePlaceSearch: () => ({
          isError,
          isFetching,
          refetch: () => {
            retries++;
            return Promise.resolve();
          },
        }),
      };
    }
    if (specifier.startsWith("@/components/")) {
      return new Proxy({}, { get: (_, name) => name });
    }
    return originalRequire(specifier);
  };
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
    },
    fileName: filename,
  });
  component._compile(outputText, filename);
  const tree = component.exports.SearchExperience();
  return {
    submit: tree.props.children[0].props.onSearch,
    updates,
    retries: () => retries,
  };
}

const request = { city: "Hamburg", radius_km: 10, amenities: ["cafe", "restaurant"] };

test("resubmitting a failed search retries the same canonical query", () => {
  const harness = searchHarness({ submitted: request, isError: true });
  harness.submit({ ...request, city: "hamburg", amenities: ["restaurant", "cafe"] });
  assert.equal(harness.retries(), 1);
  assert.deepEqual(harness.updates, []);
});

test("a changed request after failure selects a new query", () => {
  const harness = searchHarness({ submitted: request, isError: true });
  const next = { ...request, radius_km: 5 };
  harness.submit(next);
  assert.deepEqual(harness.updates, [next]);
  assert.equal(harness.retries(), 0);
});

test("successful searches preserve caching and first submissions update state", () => {
  for (const submitted of [null, request]) {
    const harness = searchHarness({ submitted });
    harness.submit(request);
    assert.deepEqual(harness.updates, [request]);
    assert.equal(harness.retries(), 0);
  }
});

test("submission while a search is fetching cannot start another request", () => {
  const harness = searchHarness({ submitted: request, isError: true, isFetching: true });
  harness.submit(request);
  assert.deepEqual(harness.updates, []);
  assert.equal(harness.retries(), 0);
});
