import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

const compiled = await build({
  stdin: {
    contents: 'export * from "./utils/codexModels"; export * from "./utils/storeHelpers";',
    resolveDir: process.cwd(),
    loader: "ts",
  },
  bundle: true, platform: "node", format: "esm", write: false, logLevel: "silent",
});
const {
  parseCodexModelCatalog, getCodexReasoningEfforts,
  getLLMConfigValidationError, normalizeLLMConfig, handleSaveLLMConfig,
} = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`);

const model = {
  id: "FutureModel/ExactCase", name: "A future model",
  supported_reasoning_levels: ["none", "low", "ultra", "low"],
};
const catalog = (models = [model]) => ({ models, client_version: "0.169.0" });
const config = { LLM: "codex", CODEX_MODEL: model.id, DISABLE_IMAGE_GENERATION: true };

test("accepts previously unknown model IDs without rewriting their wire value", () => {
  assert.equal(parseCodexModelCatalog(catalog()).models[0].id, model.id);
  assert.equal(getLLMConfigValidationError(config), null);
  assert.equal(getLLMConfigValidationError({ ...config, LLM: "chatgpt" }), null);
  assert.match(getLLMConfigValidationError({ ...config, CODEX_MODEL: "" }), /Select a Codex model/);
});

test("rejects malformed and duplicate catalogs instead of inventing a fallback", () => {
  for (const payload of [null, {}, catalog([model, model]), catalog([{ ...model, id: "" }]),
    catalog([{ ...model, supported_reasoning_levels: [42] }])]) {
    assert.throws(() => parseCodexModelCatalog(payload), /invalid model catalog/);
  }
  assert.deepEqual(parseCodexModelCatalog(catalog([])).models, []);
});

test("intersects reasoning levels with the SDK and preserves a supported none value", () => {
  assert.deepEqual(getCodexReasoningEfforts(model), ["none", "low"]);
  assert.deepEqual(getCodexReasoningEfforts(), []);
  assert.equal(normalizeLLMConfig({ ...config, LLM_REASONING_EFFORT: "none" }).LLM_REASONING_EFFORT, "none");
  assert.equal(normalizeLLMConfig({ ...config, LLM: "openai", LLM_REASONING_EFFORT: "none" }).LLM_REASONING_EFFORT, "");
});

test("saves an exact dynamic ID and surfaces the server's catalog validation error", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (_url, options) => {
    calls.push(JSON.parse(options.body));
    return new Response(JSON.stringify({ detail: "The selected ChatGPT model is no longer available." }),
      { status: 400, headers: { "Content-Type": "application/json" } });
  };
  try {
    await assert.rejects(handleSaveLLMConfig(config), /selected ChatGPT model is no longer available/);
    assert.equal(calls[0].CODEX_MODEL, model.id);
    assert.equal(config.CODEX_MODEL, model.id);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
