import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

import { build } from "esbuild";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function loadBlankSlideAiInstruction() {
  const outDir = await mkdtemp(path.join(tmpdir(), "blank-slide-ai-test-"));
  const outfile = path.join(outDir, "blank-slide-ai-instruction.mjs");

  await build({
    entryPoints: [
      path.join(
        projectRoot,
        "app",
        "(presentation-generator)",
        "_shared",
        "blank-slide-ai-instruction.ts",
      ),
    ],
    outfile,
    bundle: true,
    format: "esm",
    platform: "node",
    logLevel: "silent",
  });

  return import(pathToFileURL(outfile).href);
}

test("blank-slide AI instruction permits rewriting placeholder copy and applying a design", async () => {
  const { createBlankSlideAiInstruction } = await loadBlankSlideAiInstruction();
  const instruction = createBlankSlideAiInstruction({
    slideIndex: 2,
    layoutId: "template-v2:__blank_slide__",
  });

  assert.match(instruction, /slide 3/);
  assert.match(instruction, /Title and Subtitle/i);
  assert.match(instruction, /rewrite/i);
  assert.match(instruction, /expand/i);
  assert.match(instruction, /design|layout/i);
  assert.match(instruction, /do not add another slide/i);
});

test("layout-slide AI instruction preserves the selected layout", async () => {
  const { createBlankSlideAiInstruction } = await loadBlankSlideAiInstruction();
  const instruction = createBlankSlideAiInstruction({
    slideIndex: 0,
    layoutId: "template-v2:two-column",
    promptKind: "layout",
  });

  assert.match(instruction, /slide 1/);
  assert.match(instruction, /two-column/);
  assert.match(instruction, /Preserve the layout structure/i);
  assert.match(instruction, /do not add another slide/i);
});
