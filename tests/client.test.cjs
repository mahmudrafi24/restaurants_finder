const { test, afterEach, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { setTimeout: delay } = require("node:timers/promises");
process.env.NEXT_PUBLIC_API_URL = "https://api.example.org";
const { z } = require("zod");
const { apiRequest, apiDownload, ApiError } = require("../src/lib/api/client.ts");
const { exportPlaces } = require("../src/lib/api/places.ts");
const { MAX_REQUEST_BYTES } = require("../src/lib/schemas.ts");
const originalFetch = global.fetch;
let keepAlive;
beforeEach(() => {
  keepAlive = setInterval(() => {}, 100);
});
afterEach(() => {
  global.fetch = originalFetch;
  clearInterval(keepAlive);
});
const objectSchema = z.object({ ok: z.boolean() });
const isCode = (code) => (error) => error instanceof ApiError && error.code === code;

function interruptedBody(signal, error, waitForAbort = false, status = 200) {
  return new Response(
    new ReadableStream({
      start(controller) {
        if (waitForAbort) {
          signal.addEventListener("abort", () => controller.error(signal.reason), { once: true });
        } else {
          controller.error(error);
        }
      },
    }),
    { status },
  );
}

test("valid JSON is validated and URL query is encoded", async () => {
  global.fetch = async (url) => {
    assert.equal(new URL(url).searchParams.get("q"), "São Paulo");
    return Response.json({ ok: true });
  };
  assert.deepEqual(
    await apiRequest({ path: "/test", query: { q: "São Paulo" }, schema: objectSchema }),
    { ok: true },
  );
});

test("invalid JSON is distinct from transport failure", async () => {
  global.fetch = async () => new Response("not JSON");
  await assert.rejects(
    apiRequest({ path: "/test", schema: objectSchema }),
    isCode("malformed_response"),
  );
});

test("schema mismatch remains a malformed response", async () => {
  global.fetch = async () => Response.json({ wrong: true });
  await assert.rejects(
    apiRequest({ path: "/test", schema: objectSchema }),
    isCode("malformed_response"),
  );
});

test("connection lost after headers is a network failure", async () => {
  global.fetch = async (_url, { signal }) =>
    interruptedBody(signal, new TypeError("connection reset"));
  await assert.rejects(
    apiRequest({ path: "/test", schema: objectSchema }),
    isCode("network_error"),
  );
});

test("JSON body timeout uses the timeout code", async () => {
  global.fetch = async (_url, { signal }) => interruptedBody(signal, null, true);
  await assert.rejects(
    apiRequest({ path: "/test", schema: objectSchema, timeoutMs: 10 }),
    isCode("client_timeout"),
  );
});

test("download body timeout is translated too", async () => {
  global.fetch = async (_url, { signal }) => interruptedBody(signal, null, true);
  await assert.rejects(
    apiDownload({ path: "/download", body: {}, fallbackFilename: "test.csv", timeoutMs: 10 }),
    isCode("client_timeout"),
  );
});

test("error-response body transport failures are not hidden as HTTP errors", async () => {
  global.fetch = async (_url, { signal }) =>
    interruptedBody(signal, new TypeError("connection reset"), false, 503);
  await assert.rejects(
    apiRequest({ path: "/test", schema: objectSchema }),
    isCode("network_error"),
  );
});

test("caller cancellation during body reading propagates unchanged", async () => {
  const controller = new AbortController();
  global.fetch = async (_url, { signal }) => interruptedBody(signal, null, true);
  const pending = apiRequest({ path: "/test", schema: objectSchema, signal: controller.signal });
  await delay(5);
  controller.abort();
  await assert.rejects(pending, (error) => error === controller.signal.reason);
});

test("an upstream error envelope preserves its code and retry details", async () => {
  global.fetch = async () =>
    Response.json(
      {
        error: {
          code: "upstream_rate_limited",
          message: "Wait",
          details: { retry_after_seconds: 2 },
        },
      },
      { status: 429 },
    );
  await assert.rejects(
    apiRequest({ path: "/test", schema: objectSchema }),
    (error) => error.code === "upstream_rate_limited" && error.retryAfterSeconds === 2,
  );
});

test("file bytes and encoded filenames survive downloading", async () => {
  global.fetch = async () =>
    new Response("export bytes", {
      headers: { "Content-Disposition": "attachment; filename*=UTF-8''z%C3%BCrich.csv" },
    });
  const result = await apiDownload({
    path: "/download",
    body: {},
    fallbackFilename: "fallback.csv",
  });
  assert.equal(result.filename, "zürich.csv");
  assert.equal(await result.blob.text(), "export bytes");
});

test("UTF-8 export byte limit is enforced before a network call", async () => {
  let called = false;
  global.fetch = async () => {
    called = true;
    return new Response("unexpected");
  };
  const places = Array.from({ length: 2000 }, () => ({ name: "界".repeat(1000) }));
  assert.ok(Buffer.byteLength(JSON.stringify(places), "utf8") > MAX_REQUEST_BYTES);
  await assert.rejects(
    exportPlaces({ format: "csv", cityName: "City", places }),
    isCode("request_too_large"),
  );
  assert.equal(called, false);
});
