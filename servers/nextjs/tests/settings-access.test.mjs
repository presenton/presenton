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
let settingsAccess;

before(async () => {
  tempDirectory = await mkdtemp(
    path.join(os.tmpdir(), "presenton-settings-access-"),
  );
  const outfile = path.join(tempDirectory, "settings-access.mjs");

  await build({
    entryPoints: [path.join(nextRoot, "utils/settingsAccess.ts")],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile,
    logLevel: "silent",
  });

  settingsAccess = await import(pathToFileURL(outfile).href);
});

after(async () => {
  if (tempDirectory) {
    await rm(tempDirectory, { recursive: true, force: true });
  }
});

test("admins receive the full settings view", () => {
  assert.equal(settingsAccess.getSettingsView("admin"), "admin");
});

test("standard and unknown roles receive only the account view", () => {
  assert.equal(settingsAccess.getSettingsView("user"), "account");
  assert.equal(settingsAccess.getSettingsView(null), "account");
});
