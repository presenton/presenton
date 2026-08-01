import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { after, before } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { build } from "esbuild";

const nextRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
let tempDirectory;
let providerConstants;
let providerUtils;
let storeHelpers;

async function bundle(entry, name) {
  const outfile = path.join(tempDirectory, name);
  await build({
    entryPoints: [path.join(nextRoot, entry)],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile,
    logLevel: "silent",
  });
  return import(pathToFileURL(outfile).href);
}

before(async () => {
  tempDirectory = await mkdtemp(
    path.join(os.tmpdir(), "presenton-orcarouter-"),
  );
  providerConstants = await bundle(
    "utils/providerConstants.ts",
    "provider-constants.mjs",
  );
  providerUtils = await bundle("utils/providerUtils.ts", "provider-utils.mjs");
  storeHelpers = await bundle("utils/storeHelpers.ts", "store-helpers.mjs");
});

after(async () => {
  if (tempDirectory) {
    await rm(tempDirectory, { recursive: true, force: true });
  }
});

test("OrcaRouter is offered as a named LLM provider", () => {
  const orcarouter = providerConstants.LLM_PROVIDERS.orcarouter;

  assert.ok(orcarouter, "orcarouter should be in LLM_PROVIDERS");
  assert.equal(orcarouter.value, "orcarouter");
  assert.equal(orcarouter.label, "OrcaRouter");
  assert.equal(orcarouter.url, "https://api.orcarouter.ai/v1");
  assert.ok(orcarouter.getApiKeyUrl.startsWith("https://www.orcarouter.ai"));
});

test("OrcaRouter is distinct from OpenRouter", () => {
  const { orcarouter, openrouter } = providerConstants.LLM_PROVIDERS;

  assert.notEqual(orcarouter.value, openrouter.value);
  assert.notEqual(orcarouter.url, openrouter.url);
});

test("OrcaRouter config fields map to their env var names", () => {
  const base = { LLM: "orcarouter" };

  assert.equal(
    providerUtils.updateLLMConfig(base, "orcarouter_api_key", "sk-orca-test")
      .ORCAROUTER_API_KEY,
    "sk-orca-test",
  );
  assert.equal(
    providerUtils.updateLLMConfig(base, "orcarouter_model", "openai/gpt-5.5")
      .ORCAROUTER_MODEL,
    "openai/gpt-5.5",
  );
  assert.equal(
    providerUtils.updateLLMConfig(
      base,
      "orcarouter_base_url",
      "https://api.orcarouter.ai/v1",
    ).ORCAROUTER_BASE_URL,
    "https://api.orcarouter.ai/v1",
  );
});

test("OrcaRouter requires an API key and a model before saving", () => {
  // Image generation is turned off so the assertions below isolate the
  // text-provider branch rather than tripping the image-provider check first.
  const orcarouter = (extra) => ({
    LLM: "orcarouter",
    DISABLE_IMAGE_GENERATION: true,
    ...extra,
  });

  const missingKey = storeHelpers.getLLMConfigValidationError(orcarouter());
  assert.match(missingKey, /OrcaRouter API key is required/);

  const missingModel = storeHelpers.getLLMConfigValidationError(
    orcarouter({ ORCAROUTER_API_KEY: "sk-orca-test" }),
  );
  assert.match(missingModel, /OrcaRouter model id/);

  const complete = storeHelpers.getLLMConfigValidationError(
    orcarouter({
      ORCAROUTER_API_KEY: "sk-orca-test",
      ORCAROUTER_MODEL: "openai/gpt-5.5",
    }),
  );
  assert.equal(complete, null);
});
