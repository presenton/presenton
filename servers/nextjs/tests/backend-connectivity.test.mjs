import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { build } from "esbuild";

let connectivity;
let temporaryDirectory;

test.before(async () => {
  temporaryDirectory = await mkdtemp(
    path.join(tmpdir(), "presenton-backend-connectivity-"),
  );
  const entryFile = path.join(temporaryDirectory, "entry.ts");
  const outputFile = path.join(temporaryDirectory, "bundle.mjs");
  await writeFile(
    entryFile,
    [
      `export { assertBackendReachable, BackendConnectionError } from ${JSON.stringify(path.resolve("utils/api.ts"))};`,
      `export { clearOllamaModelsCache, isOllamaModelAvailable } from ${JSON.stringify(path.resolve("utils/providerUtils.ts"))};`,
    ].join("\n"),
  );
  await build({
    entryPoints: [entryFile],
    outfile: outputFile,
    bundle: true,
    platform: "node",
    format: "esm",
    tsconfig: path.resolve("tsconfig.json"),
    logLevel: "silent",
  });
  connectivity = await import(
    `${pathToFileURL(outputFile).href}?cache=${Date.now()}`
  );
});

test.after(async () => {
  if (temporaryDirectory) {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test("backend reachability accepts a JSON health response", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ configured: true, authenticated: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  try {
    await connectivity.assertBackendReachable();
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("backend reachability turns an HTML frontend response into a clear connection error", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response("<!DOCTYPE html><title>Not Found</title>", {
      status: 404,
      headers: { "Content-Type": "text/html" },
    });

  try {
    await assert.rejects(
      connectivity.assertBackendReachable(),
      (error) => {
        assert.ok(error instanceof connectivity.BackendConnectionError);
        assert.doesNotMatch(error.message, /<!DOCTYPE|Unexpected token/);
        assert.match(error.message, /FastAPI backend/i);
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("backend reachability turns a failed fetch into a clear connection error", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new TypeError("fetch failed");
  };

  try {
    await assert.rejects(
      connectivity.assertBackendReachable(),
      connectivity.BackendConnectionError,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Ollama availability only returns false for a valid model list", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify([{ name: "llama3.2:3b" }]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  try {
    connectivity.clearOllamaModelsCache();
    assert.equal(
      await connectivity.isOllamaModelAvailable(
        "missing-model",
        "http://ollama.test:11434",
      ),
      false,
    );
  } finally {
    connectivity.clearOllamaModelsCache();
    globalThis.fetch = originalFetch;
  }
});

test("Ollama availability does not classify HTML as a missing model", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response("<!DOCTYPE html><title>Not Found</title>", {
      status: 404,
      headers: { "Content-Type": "text/html" },
    });

  try {
    connectivity.clearOllamaModelsCache();
    await assert.rejects(
      connectivity.isOllamaModelAvailable(
        "llama3.2:3b",
        "http://ollama-html.test:11434",
      ),
      connectivity.BackendConnectionError,
    );
  } finally {
    connectivity.clearOllamaModelsCache();
    globalThis.fetch = originalFetch;
  }
});
