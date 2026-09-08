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
    )};`
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
  } finally {
    if (previousPath === undefined) delete process.env.USER_CONFIG_PATH;
    else process.env.USER_CONFIG_PATH = previousPath;
  }
});
