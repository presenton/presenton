import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

let api;
let directory;
const originalFetch = globalThis.fetch;

test.before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "presenton-provider-errors-"));
  const entry = path.join(directory, "entry.ts");
  const output = path.join(directory, "bundle.mjs");
  await writeFile(entry, [
    `export * from ${JSON.stringify(path.resolve("app/(presentation-generator)/services/api/api-error-handler.ts"))};`,
    `export * from ${JSON.stringify(path.resolve("app/(presentation-generator)/services/api/chat.ts"))};`,
    `export * from ${JSON.stringify(path.resolve("utils/apiErrorMessages.ts"))};`,
  ].join("\n"));
  await build({ entryPoints: [entry], outfile: output, bundle: true, platform: "node", format: "esm", tsconfig: path.resolve("tsconfig.json"), logLevel: "silent" });
  api = await import(pathToFileURL(output).href);
});

test.afterEach(() => { globalThis.fetch = originalFetch; });
test.after(async () => { await rm(directory, { recursive: true, force: true }); });

test("HTTP provider errors preserve safe details, code and retry policy", async () => {
  const response = new Response(JSON.stringify({ detail: "Check provider billing.", code: "provider_quota_exceeded", retryable: false, request_id: "request-123" }), { status: 429 });
  await assert.rejects(api.ApiResponseHandler.handleResponse(response, "Failed"), error => {
    assert.equal(error.message, "Check provider billing.");
    assert.equal(error.code, "provider_quota_exceeded");
    assert.equal(error.retryable, false);
    assert.equal(error.requestId, "request-123");
    return true;
  });
});

test("nested message keeps root retry metadata", () => {
  const data = { detail: { message: "Model unavailable" }, code: "provider_model_unavailable", retryable: false };
  assert.equal(api.extractApiErrorMetadata(data, 503).retryable, false);
  assert.equal(api.extractApiErrorMetadata(data, 503).code, "provider_model_unavailable");
});

test("HTML gateway failures produce an actionable message", async () => {
  const response = new Response("<html><h1>502 Bad Gateway</h1>secret upstream</html>", { status: 502 });
  await assert.rejects(api.ApiResponseHandler.handleResponse(response, "Failed"), error => {
    assert.equal(error.status, 502);
    assert.doesNotMatch(error.message, /html|secret|<h1>/);
    assert.match(error.message, /try again/i);
    return true;
  });
});

test("malformed success JSON fails instead of returning an empty object", async () => {
  await assert.rejects(api.ApiResponseHandler.handleResponse(new Response("{"), "Failed"), error => {
    assert.equal(error.code, "invalid_response");
    assert.equal(error.status, 502);
    return true;
  });
  assert.equal(await api.ApiResponseHandler.handleResponse(new Response(null, { status: 204 }), "Failed"), true);
});

test("raw payloads, endpoints and credentials are never displayed", () => {
  for (const detail of ["<html>secret</html>", "Traceback secret", "Connect failed http://user:secret@internal/api", "Authorization: secret", '{"error":"secret"}']) {
    assert.equal(api.extractApiErrorMessage({ detail }, "Safe fallback", 502), "Safe fallback");
  }
  const detail = [{ loc: ["body", "provider"], msg: "Field required", input: "secret" }];
  assert.equal(api.extractApiErrorMessage({ detail }, "Fallback", 422), "body.provider: Field required");
});

test("network errors are actionable and mutating requests are never replayed", async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new TypeError("fetch failed secret host"); };
  await assert.rejects(api.apiFetch("/api/test", { method: "POST" }), error => {
    assert.equal(error.code, "backend_unreachable");
    assert.doesNotMatch(error.message, /secret/);
    return true;
  });
  assert.equal(calls, 1);
});

test("intentional cancellation stays cancelled; timeouts get a useful error", async () => {
  const abort = new DOMException("Cancelled", "AbortError");
  globalThis.fetch = async () => { throw abort; };
  await assert.rejects(api.apiFetch("/api/test"), error => error === abort);
  const controller = new AbortController();
  const timeout = new DOMException("Timed out", "TimeoutError");
  controller.abort(timeout);
  globalThis.fetch = async () => { throw timeout; };
  await assert.rejects(api.apiFetch("/api/test", { signal: controller.signal }), error => error.code === "request_timeout");
});

function streamResponse(frames, onCancel = () => {}) {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream({
    start(controller) { for (const frame of frames) controller.enqueue(encoder.encode(frame)); },
    cancel() { onCancel(); },
  }), { headers: { "content-type": "text/event-stream" } });
}

const payload = { presentation_id: "presentation", message: "Edit title" };

test("SSE provider errors keep metadata and cancel the reader", async () => {
  let cancelled = 0;
  globalThis.fetch = async () => streamResponse(['event: response\ndata: {"type":"error","detail":"Check provider billing.","code":"provider_quota_exceeded","status_code":429,"retryable":false}\n\n'], () => cancelled++);
  await assert.rejects(api.PresentationChatApi.streamMessage(payload), error => {
    assert.equal(error.code, "provider_quota_exceeded");
    assert.equal(error.status, 429);
    assert.equal(error.retryable, false);
    return true;
  });
  assert.equal(cancelled, 1);
});

test("fragmented CRLF streams complete without waiting for the connection to close", async () => {
  const frame = 'event: response\r\ndata: {"type":"complete","chat":{"response":"Done"}}\r\n\r\n';
  let cancelled = 0;
  globalThis.fetch = async () => streamResponse([frame.slice(0, -1), frame.slice(-1)], () => cancelled++);
  const result = await api.PresentationChatApi.streamMessage(payload);
  assert.equal(result.response, "Done");
  assert.equal(cancelled, 1);
});

test("malformed stream payloads fail cleanly and cancel the reader", async () => {
  for (const data of ["null", "{"]) {
    let cancelled = 0;
    globalThis.fetch = async () => streamResponse([`event: response\ndata: ${data}\n\n`], () => cancelled++);
    await assert.rejects(api.PresentationChatApi.streamMessage(payload), error => error.code === "invalid_response");
    assert.equal(cancelled, 1);
  }
});

test("early stream termination warns about saved changes without automatic retry", async () => {
  globalThis.fetch = async () => new Response("event: response\ndata: {\"type\":\"chunk\",\"chunk\":\"Partial\"}\n\n");
  await assert.rejects(api.PresentationChatApi.streamMessage(payload), error => {
    assert.equal(error.code, "stream_interrupted");
    assert.equal(error.retryable, false);
    assert.match(error.message, /saved changes/);
    return true;
  });
});
