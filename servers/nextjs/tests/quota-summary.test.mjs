import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { build } from "esbuild";

let quotaModule;
let temporaryDirectory;

test.before(async () => {
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), "presenton-quota-"));
  const entryFile = path.join(temporaryDirectory, "entry.ts");
  const outputFile = path.join(temporaryDirectory, "bundle.mjs");
  await writeFile(
    entryFile,
    `export { fetchQuotaStatus, formatQuotaSummary, formatResetCountdown, normalizeQuotaStatus } from ${JSON.stringify(path.resolve("utils/quota.ts"))};`,
  );
  await build({
    entryPoints: [entryFile],
    outfile: outputFile,
    bundle: true,
    platform: "node",
    format: "esm",
  });
  quotaModule = await import(pathToFileURL(outputFile).href);
});

test.after(async () => {
  await rm(temporaryDirectory, { recursive: true, force: true });
});

const SAMPLE = {
  limit: 10,
  used: 3,
  remaining: 7,
  period_hours: 24,
  resets_in_seconds: null,
};

test("normalizeQuotaStatus accepts a valid payload", () => {
  assert.deepEqual(quotaModule.normalizeQuotaStatus(SAMPLE), SAMPLE);
});

test("normalizeQuotaStatus rejects malformed payloads", () => {
  assert.equal(quotaModule.normalizeQuotaStatus(null), null);
  assert.equal(quotaModule.normalizeQuotaStatus("nope"), null);
  assert.equal(quotaModule.normalizeQuotaStatus({}), null);
  assert.equal(
    quotaModule.normalizeQuotaStatus({ ...SAMPLE, remaining: "7" }),
    null,
  );
  assert.equal(
    quotaModule.normalizeQuotaStatus({ ...SAMPLE, limit: "10" }),
    null,
  );
});

test("formatQuotaSummary describes remaining generations", () => {
  assert.equal(
    quotaModule.formatQuotaSummary(SAMPLE),
    "7 of 10 left",
  );
});

test("formatQuotaSummary reports unlimited when remaining is null", () => {
  assert.equal(
    quotaModule.formatQuotaSummary({ ...SAMPLE, remaining: null }),
    "Unlimited generations",
  );
});

test("formatQuotaSummary includes reset countdown when exhausted", () => {
  assert.equal(
    quotaModule.formatQuotaSummary({
      ...SAMPLE,
      remaining: 0,
      resets_in_seconds: 5400,
    }),
    "0 of 10 left — next slot in 1h 30m",
  );
});

test("formatResetCountdown renders human intervals", () => {
  assert.equal(quotaModule.formatResetCountdown(3600), "1h");
  assert.equal(quotaModule.formatResetCountdown(7320), "2h 2m");
  assert.equal(quotaModule.formatResetCountdown(300), "5m");
  assert.equal(quotaModule.formatResetCountdown(45), "45s");
  assert.equal(quotaModule.formatResetCountdown(0), "0s");
});

test("fetchQuotaStatus returns null on non-ok response", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ detail: "nope" }), { status: 500 });
  try {
    assert.equal(await quotaModule.fetchQuotaStatus(), null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fetchQuotaStatus returns normalized status on ok response", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify(SAMPLE), { status: 200 });
  try {
    assert.deepEqual(await quotaModule.fetchQuotaStatus(), SAMPLE);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
