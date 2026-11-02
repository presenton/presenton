import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { build } from "esbuild";


let runtimeConfig;
let temporaryDirectory;

test.before(async () => {
  temporaryDirectory = await mkdtemp(
    path.join(tmpdir(), "presenton-runtime-provider-config-")
  );
  const entryFile = path.join(temporaryDirectory, "entry.ts");
  const outputFile = path.join(temporaryDirectory, "bundle.mjs");
  await writeFile(
    entryFile,
    `export { readRuntimeProviderConfig } from ${JSON.stringify(
      path.resolve("lib/runtime-provider-config.ts")
    )};
    export { IMAGE_PROVIDERS, GPT_IMAGE_2_QUALITY_OPTIONS, GPT_IMAGE_2_5_QUALITY_OPTIONS, DEFAULT_OPENAI_IMAGE_PROVIDER } from ${JSON.stringify(
      path.resolve("utils/providerConstants.ts")
    )};
    export { normalizeLLMConfig, getLLMConfigValidationError } from ${JSON.stringify(path.resolve("utils/storeHelpers.ts"))};
    export { changeProvider, updateLLMConfig } from ${JSON.stringify(path.resolve("utils/providerUtils.ts"))};
    export { default as userConfigReducer } from ${JSON.stringify(path.resolve("store/slices/userConfig.ts"))};`
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
  runtimeConfig = await import(
    `${pathToFileURL(outputFile).href}?cache=${Date.now()}`
  );
});

test.after(async () => {
  if (temporaryDirectory) {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test("regular-user runtime config keeps provider choices and redacts secrets", async () => {
  const configPath = path.join(temporaryDirectory, "userConfig.json");
  await writeFile(
    configPath,
    JSON.stringify({
      LLM: "openrouter",
      OPENROUTER_MODEL: "openai/example-model",
      OPENROUTER_API_KEY: "shared-secret",
      IMAGE_PROVIDER: "pexels",
      PEXELS_API_KEY: "shared-image-secret",
      DISABLE_IMAGE_GENERATION: false,
      LLM_MAX_OUTPUT_TOKENS: 16384,
      AUTH_SECRET_KEY: "private-signing-key",
      AUTH_PASSWORD_HASH: "private-password-hash",
      AUTH_USERNAME: "private-account",
    })
  );
  const previousPath = process.env.USER_CONFIG_PATH;
  process.env.USER_CONFIG_PATH = configPath;

  try {
    const result = runtimeConfig.readRuntimeProviderConfig();
    assert.equal(result.configured, true);
    assert.equal(result.config.LLM, "openrouter");
    assert.equal(result.config.OPENROUTER_MODEL, "openai/example-model");
    assert.equal(result.config.OPENROUTER_API_KEY, "__configured__");
    assert.equal(result.config.PEXELS_API_KEY, "__configured__");
    assert.equal(result.config.LLM_MAX_OUTPUT_TOKENS, 16384);
    assert.doesNotMatch(JSON.stringify(result), /shared-secret/);
    assert.doesNotMatch(JSON.stringify(result), /shared-image-secret/);
    assert.doesNotMatch(JSON.stringify(result), /AUTH_|private-signing-key|private-password-hash/);
  } finally {
    if (previousPath === undefined) delete process.env.USER_CONFIG_PATH;
    else process.env.USER_CONFIG_PATH = previousPath;
  }
});

test("runtime config migrates the removed DALL-E provider and keeps GPT Image 2 quality", async () => {
  const configPath = path.join(temporaryDirectory, "legacy-image-config.json");
  await writeFile(configPath, JSON.stringify({
    LLM: "openai", OPENAI_MODEL: "test-model", OPENAI_API_KEY: "shared-key",
    IMAGE_PROVIDER: "dall-e-3", DALL_E_3_QUALITY: "hd",
  }));
  const previousPath = process.env.USER_CONFIG_PATH;
  process.env.USER_CONFIG_PATH = configPath;
  try {
    const result = runtimeConfig.readRuntimeProviderConfig();
    assert.equal(result.configured, true);
    assert.equal(result.config.IMAGE_PROVIDER, "gpt-image-2");
    assert.equal(result.config.GPT_IMAGE_2_QUALITY, "high");
    assert.equal(result.config.OPENAI_API_KEY, "__configured__");
    assert.equal("DALL_E_3_QUALITY" in result.config, false);
  } finally {
    if (previousPath === undefined) delete process.env.USER_CONFIG_PATH;
    else process.env.USER_CONFIG_PATH = previousPath;
  }
});

test("image provider choices replace DALL-E 3 with GPT Image 2 and supported qualities", () => {
  assert.equal("dall-e-3" in runtimeConfig.IMAGE_PROVIDERS, false);
  const provider = runtimeConfig.IMAGE_PROVIDERS["gpt-image-2"];
  assert.equal(provider.value, "gpt-image-2");
  assert.equal(provider.label, "GPT Image 2");
  assert.equal(provider.apiKeyField, "OPENAI_API_KEY");
  assert.deepEqual(runtimeConfig.GPT_IMAGE_2_QUALITY_OPTIONS.map(({ value }) => value), [
    "low", "medium", "high",
  ]);
});


for (const providerId of ["gpt-image-2.5-flare", "gpt-image-2.5-sunburst"]) {
  test(`${providerId} is selectable and requires the shared OpenAI API key`, () => {
    const provider = runtimeConfig.IMAGE_PROVIDERS[providerId];
    assert.equal(provider.value, providerId);
    assert.equal(provider.label, providerId.endsWith("flare") ? "GPT Image 2.5 Flare" : "GPT Image 2.5 Sunburst");
    assert.equal(provider.apiKeyField, "OPENAI_API_KEY");
    const base = { LLM: "google", GOOGLE_API_KEY: "google-key", GOOGLE_MODEL: "text-model", IMAGE_PROVIDER: providerId };
    assert.match(runtimeConfig.getLLMConfigValidationError(base), /OpenAI API key is required/);
    assert.equal(runtimeConfig.getLLMConfigValidationError({ ...base, OPENAI_API_KEY: "image-key" }), null);
    const updated = runtimeConfig.updateLLMConfig(base, "gpt_image_2_5_quality", "xhigh");
    assert.equal(updated.IMAGE_PROVIDER, providerId);
    assert.equal(updated.GPT_IMAGE_2_5_QUALITY, "xhigh");
  });
}

test("GPT Image 2.5 exposes its additional quality levels without changing GPT Image 2", () => {
  assert.equal("gpt-image-1.5" in runtimeConfig.IMAGE_PROVIDERS, false);
  assert.deepEqual(runtimeConfig.GPT_IMAGE_2_5_QUALITY_OPTIONS.map(({ value }) => value), [
    "low", "medium", "high", "xhigh", "max", "auto",
  ]);
});

test("new OpenAI configurations default to Flare at medium quality", () => {
  assert.equal(runtimeConfig.DEFAULT_OPENAI_IMAGE_PROVIDER, "gpt-image-2.5-flare");
  const initial = runtimeConfig.userConfigReducer(undefined, { type: "initial" }).llm_config;
  assert.equal(initial.IMAGE_PROVIDER, "gpt-image-2.5-flare");
  assert.equal(initial.GPT_IMAGE_2_5_QUALITY, "medium");
  const config = runtimeConfig.changeProvider({}, "openai");
  assert.equal(config.IMAGE_PROVIDER, "gpt-image-2.5-flare");
  assert.equal(config.GPT_IMAGE_2_5_QUALITY, "medium");
});

for (const legacyProvider of ["gpt-image-1.5", "gpt-image-1.5-2025-12-16"]) {
  for (const quality of ["low", "medium", "high", undefined]) {
    test(`normalization migrates ${legacyProvider} with ${quality || "default"} quality`, () => {
      const original = { IMAGE_PROVIDER: legacyProvider, GPT_IMAGE_1_5_QUALITY: quality };
      const migrated = runtimeConfig.normalizeLLMConfig(original);
      assert.equal(migrated.IMAGE_PROVIDER, "gpt-image-2.5-flare");
      assert.equal(migrated.GPT_IMAGE_2_5_QUALITY, quality || "medium");
      assert.equal("GPT_IMAGE_1_5_QUALITY" in migrated, false);
      assert.equal(original.IMAGE_PROVIDER, legacyProvider);
    });
  }
}

test("migration preserves explicit GPT Image 2.5 quality and unrelated provider choices", () => {
  const migrated = runtimeConfig.normalizeLLMConfig({ IMAGE_PROVIDER: "gpt-image-1.5", GPT_IMAGE_1_5_QUALITY: "high", GPT_IMAGE_2_5_QUALITY: "max" });
  assert.equal(migrated.GPT_IMAGE_2_5_QUALITY, "max");
  for (const provider of ["gpt-image-2", "gpt-image-2.5-sunburst", "pexels", "gemini_flash"]) {
    const config = runtimeConfig.normalizeLLMConfig({ IMAGE_PROVIDER: provider, GPT_IMAGE_1_5_QUALITY: "high" });
    assert.equal(config.IMAGE_PROVIDER, provider);
    assert.equal(config.GPT_IMAGE_2_5_QUALITY, undefined);
  }
});

test("regular-user runtime configuration migrates saved GPT Image 1.5", async () => {
  const configPath = path.join(temporaryDirectory, "gpt-image-1-5-config.json");
  await writeFile(configPath, JSON.stringify({
    LLM: "openai", OPENAI_MODEL: "text-model", OPENAI_API_KEY: "shared-key",
    IMAGE_PROVIDER: "gpt-image-1.5", GPT_IMAGE_1_5_QUALITY: "high",
  }));
  const previousPath = process.env.USER_CONFIG_PATH;
  process.env.USER_CONFIG_PATH = configPath;
  try {
    const result = runtimeConfig.readRuntimeProviderConfig();
    assert.equal(result.configured, true);
    assert.equal(result.config.IMAGE_PROVIDER, "gpt-image-2.5-flare");
    assert.equal(result.config.GPT_IMAGE_2_5_QUALITY, "high");
    assert.equal(result.config.OPENAI_API_KEY, "__configured__");
    assert.equal("GPT_IMAGE_1_5_QUALITY" in result.config, false);
  } finally {
    if (previousPath === undefined) delete process.env.USER_CONFIG_PATH;
    else process.env.USER_CONFIG_PATH = previousPath;
  }
});
