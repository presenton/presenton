import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { build } from "esbuild";

let layouts;
let workspace;
let previousCwd;

const LAYOUT_TSX = `
import * as z from "zod";

export const layoutId = "cover-slide";
export const layoutName = "Cover Slide";
export const layoutDescription = "Cover slide";

export const Schema = z.object({
  title: z.string().default("Hello"),
});
`;

test.before(async () => {
  workspace = await mkdtemp(path.join(tmpdir(), "presenton-template-group-"));
  const outputFile = path.join(workspace, "server-template-layouts.mjs");

  await build({
    entryPoints: [path.resolve("lib/server-template-layouts.ts")],
    outfile: outputFile,
    bundle: true,
    platform: "node",
    format: "esm",
    tsconfig: path.resolve("tsconfig.json"),
    logLevel: "silent",
  });

  layouts = await import(
    `${pathToFileURL(outputFile).href}?cache=${Date.now()}`
  );

  const templatesRoot = path.join(workspace, "app", "presentation-templates");
  await mkdir(path.join(templatesRoot, "valid-group"), { recursive: true });
  await mkdir(path.join(workspace, "secret"), { recursive: true });
  await writeFile(
    path.join(templatesRoot, "valid-group", "CoverSlide.tsx"),
    LAYOUT_TSX,
  );
  await writeFile(path.join(workspace, "secret", "Evil.tsx"), LAYOUT_TSX);

  previousCwd = process.cwd();
  process.chdir(workspace);
});

test.after(async () => {
  if (previousCwd) {
    process.chdir(previousCwd);
  }
  if (workspace) {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("builds a payload for a valid template group", async () => {
  const payload = await layouts.buildBuiltinTemplateLayoutPayload("valid-group");

  assert.ok(payload);
  assert.equal(payload.slides.length, 1);
  assert.equal(payload.slides[0].id, "valid-group:cover-slide");
});

test("rejects group names that escape the templates directory", async () => {
  for (const group of [
    "../../secret",
    "valid-group/../../secret",
    "..",
    ".",
    "a/b",
    "a\\b",
    "/etc",
  ]) {
    const payload = await layouts.buildBuiltinTemplateLayoutPayload(group);
    assert.equal(payload, null, `expected null payload for ${JSON.stringify(group)}`);
  }
});
