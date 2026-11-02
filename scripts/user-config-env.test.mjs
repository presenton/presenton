import assert from "node:assert/strict";
import test from "node:test";

import userConfigEnv from "./user-config-env.cjs";

const { buildUserConfigFromEnv } = userConfigEnv;

test("OpenAI startup defaults to GPT Image 2.5 Flare at medium quality", () => {
  const config = buildUserConfigFromEnv({}, {
    LLM: "openai", OPENAI_API_KEY: "test-key",
  });
  assert.equal(config.IMAGE_PROVIDER, "gpt-image-2.5-flare");
  assert.equal(config.GPT_IMAGE_2_5_QUALITY, "medium");
});

for (const provider of ["gpt-image-2.5-flare", "gpt-image-2.5-sunburst"]) {
  test(`environment config accepts ${provider} and its quality`, () => {
    const config = buildUserConfigFromEnv({}, {
      IMAGE_PROVIDER: provider, GPT_IMAGE_2_5_QUALITY: "xhigh",
    });
    assert.equal(config.IMAGE_PROVIDER, provider);
    assert.equal(config.GPT_IMAGE_2_5_QUALITY, "xhigh");
  });
}

for (const legacyProvider of ["gpt-image-1.5", "gpt-image-1.5-2025-12-16"]) {
  for (const quality of ["low", "medium", "high"]) {
    test(`saved ${legacyProvider} migrates to Flare preserving ${quality} quality`, () => {
      const saved = { IMAGE_PROVIDER: legacyProvider, GPT_IMAGE_1_5_QUALITY: quality };
      const config = buildUserConfigFromEnv(saved, {});
      assert.equal(config.IMAGE_PROVIDER, "gpt-image-2.5-flare");
      assert.equal(config.GPT_IMAGE_2_5_QUALITY, quality);
      assert.equal("GPT_IMAGE_1_5_QUALITY" in config, false);
      assert.equal(saved.IMAGE_PROVIDER, legacyProvider);
      assert.deepEqual(buildUserConfigFromEnv(config, {}), config);
    });
  }
}

test("legacy environment migrates without overriding explicit GPT Image 2.5 quality", () => {
  const config = buildUserConfigFromEnv({}, {
    IMAGE_PROVIDER: "gpt-image-1.5", GPT_IMAGE_1_5_QUALITY: "high",
    GPT_IMAGE_2_5_QUALITY: "low",
  });
  assert.equal(config.IMAGE_PROVIDER, "gpt-image-2.5-flare");
  assert.equal(config.GPT_IMAGE_2_5_QUALITY, "low");
  assert.equal("GPT_IMAGE_1_5_QUALITY" in config, false);
});

test("legacy GPT Image config without quality migrates to medium", () => {
  const config = buildUserConfigFromEnv({ IMAGE_PROVIDER: "gpt-image-1.5" }, {});
  assert.equal(config.IMAGE_PROVIDER, "gpt-image-2.5-flare");
  assert.equal(config.GPT_IMAGE_2_5_QUALITY, "medium");
});

test("legacy environment preserves an explicitly saved GPT Image 2.5 quality", () => {
  const config = buildUserConfigFromEnv({ GPT_IMAGE_2_5_QUALITY: "max" }, {
    IMAGE_PROVIDER: "gpt-image-1.5", GPT_IMAGE_1_5_QUALITY: "low",
  });
  assert.equal(config.IMAGE_PROVIDER, "gpt-image-2.5-flare");
  assert.equal(config.GPT_IMAGE_2_5_QUALITY, "max");
});

test("explicit Sunburst environment overrides a saved GPT Image 1.5 provider", () => {
  const config = buildUserConfigFromEnv({
    IMAGE_PROVIDER: "gpt-image-1.5", GPT_IMAGE_1_5_QUALITY: "high",
  }, { IMAGE_PROVIDER: "gpt-image-2.5-sunburst", GPT_IMAGE_2_5_QUALITY: "max" });
  assert.equal(config.IMAGE_PROVIDER, "gpt-image-2.5-sunburst");
  assert.equal(config.GPT_IMAGE_2_5_QUALITY, "max");
});

test("OpenAI startup preserves explicit GPT Image 2.5 quality", () => {
  const config = buildUserConfigFromEnv({}, {
    LLM: "openai", OPENAI_API_KEY: "test-key", GPT_IMAGE_2_5_QUALITY: "auto",
  });
  assert.equal(config.GPT_IMAGE_2_5_QUALITY, "auto");
});

test("explicit stock providers and disabled image generation retain their behavior", () => {
  const stockConfig = buildUserConfigFromEnv({}, {
    LLM: "openai", OPENAI_API_KEY: "test-key", PEXELS_API_KEY: "stock-key",
  });
  assert.equal(stockConfig.IMAGE_PROVIDER, "pexels");
  const disabledConfig = buildUserConfigFromEnv({}, {
    LLM: "openai", OPENAI_API_KEY: "test-key", DISABLE_IMAGE_GENERATION: "true",
  });
  assert.equal(disabledConfig.DISABLE_IMAGE_GENERATION, true);
  assert.equal(disabledConfig.IMAGE_PROVIDER, undefined);
});

test("environment config accepts GPT Image 2 and its quality", () => {
  const config = buildUserConfigFromEnv({}, {
    IMAGE_PROVIDER: "gpt-image-2", GPT_IMAGE_2_QUALITY: "low",
  });
  assert.equal(config.IMAGE_PROVIDER, "gpt-image-2");
  assert.equal(config.GPT_IMAGE_2_QUALITY, "low");
});

for (const [legacyQuality, expected] of [["standard", "medium"], ["hd", "high"]]) {
  test(`saved DALL-E ${legacyQuality} quality migrates to GPT Image 2 ${expected}`, () => {
    const config = buildUserConfigFromEnv({
      IMAGE_PROVIDER: "dall-e-3", DALL_E_3_QUALITY: legacyQuality,
    }, {});
    assert.equal(config.IMAGE_PROVIDER, "gpt-image-2");
    assert.equal(config.GPT_IMAGE_2_QUALITY, expected);
    assert.equal("DALL_E_3_QUALITY" in config, false);
  });
}

test("legacy environment migrates without overriding explicit GPT Image 2 quality", () => {
  const config = buildUserConfigFromEnv({}, {
    IMAGE_PROVIDER: "dall-e-3", DALL_E_3_QUALITY: "hd", GPT_IMAGE_2_QUALITY: "low",
  });
  assert.equal(config.IMAGE_PROVIDER, "gpt-image-2");
  assert.equal(config.GPT_IMAGE_2_QUALITY, "low");
  assert.equal("DALL_E_3_QUALITY" in config, false);
});

test("choosing another provider discards obsolete DALL-E quality", () => {
  const config = buildUserConfigFromEnv({
    IMAGE_PROVIDER: "dall-e-3", DALL_E_3_QUALITY: "hd",
  }, { IMAGE_PROVIDER: "pexels" });
  assert.equal(config.IMAGE_PROVIDER, "pexels");
  assert.equal("DALL_E_3_QUALITY" in config, false);
});
