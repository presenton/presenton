import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { after, before } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { build } from "esbuild";

const nextRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let tempDirectory;
let i18n;

before(async () => {
  tempDirectory = await mkdtemp(path.join(os.tmpdir(), "presenton-i18n-"));
  const outfile = path.join(tempDirectory, "i18n.mjs");

  await build({
    entryPoints: [path.join(nextRoot, "i18n/index.ts")],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile,
    logLevel: "silent",
  });

  i18n = await import(pathToFileURL(outfile).href);
});

after(async () => {
  if (tempDirectory) {
    await rm(tempDirectory, { recursive: true, force: true });
  }
});

test("normalizes supported locales and falls back to English", () => {
  assert.equal(i18n.normalizeLocale("zh-CN"), "zh-CN");
  assert.equal(i18n.normalizeLocale("zh-cn"), "zh-CN");
  assert.equal(i18n.normalizeLocale("zh"), "zh-CN");
  assert.equal(i18n.normalizeLocale("zh-SG"), "zh-CN");
  assert.equal(i18n.normalizeLocale("en-US"), "en");
  assert.equal(i18n.normalizeLocale("fr"), "en");
  assert.equal(i18n.normalizeLocale(null), "en");
});

test("translates known keys to Simplified Chinese", () => {
  assert.equal(i18n.translate("zh-CN", "settings.title"), "设置");
  assert.equal(i18n.translate("zh-CN", "settings.textProvider"), "文本模型");
  assert.equal(i18n.translate("zh-CN", "admin.users"), "用户管理");
});

test("translates core admin operation feedback and settings errors", () => {
  assert.equal(i18n.translate("zh-CN", "admin.userCreated"), "用户已创建");
  assert.equal(
    i18n.translate("zh-CN", "admin.userCanSignIn", { username: "alice" }),
    "alice 现在可以登录。",
  );
  assert.equal(
    i18n.translate("zh-CN", "settings.stockImageProviderUnavailable"),
    "所选图库服务不可用",
  );
  assert.equal(
    i18n.translate("zh-CN", "settings.chatGptReauth"),
    "请在设置中重新登录 ChatGPT。",
  );
});

test("falls back to English for unsupported locales", () => {
  assert.equal(i18n.translate("fr", "settings.save"), "Save Configuration");
});

test("interpolates dynamic values in translated messages", () => {
  assert.equal(
    i18n.translate("zh-CN", "admin.deleteUserTitle", { username: "kosmo" }),
    "删除 kosmo？",
  );
});

test("returns the key when no locale defines it", () => {
  assert.equal(i18n.translate("zh-CN", "missing.key"), "missing.key");
});
