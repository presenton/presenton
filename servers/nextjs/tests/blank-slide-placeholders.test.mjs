import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

import { build } from "esbuild";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function loadBlankSlideFactory() {
  const outDir = await mkdtemp(path.join(tmpdir(), "blank-slide-test-"));
  const outfile = path.join(outDir, "blank-slide.mjs");

  await build({
    entryPoints: [
      path.join(
        projectRoot,
        "app",
        "(presentation-generator)",
        "_shared",
        "blank-slide.ts",
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

const blankSlideFactoryPromise = loadBlankSlideFactory();

test("creates editable title and subtitle placeholders for a Template V2 blank slide", async () => {
  const { createBlankPresentationSlide } = await blankSlideFactoryPromise;
  const slide = createBlankPresentationSlide({
    id: "blank-v2",
    isTemplateV2: true,
    templateId: "template-v2",
  });

  const textElements = slide.ui.elements.filter((element) => element.type === "text");

  assert.deepEqual(
    textElements.map((element) => ({
      text: element.text,
      runs: element.runs,
      position: element.position,
      size: element.size,
    })),
    [
      {
        text: "Title",
        runs: [{ text: "Title" }],
        position: { x: 120, y: 180 },
        size: { width: 1040, height: 100 },
      },
      {
        text: "Subtitle",
        runs: [{ text: "Subtitle" }],
        position: { x: 180, y: 310 },
        size: { width: 920, height: 64 },
      },
    ],
  );
});

test("keeps Legacy/V1 blank slides unchanged", async () => {
  const { createBlankPresentationSlide } = await blankSlideFactoryPromise;
  const slide = createBlankPresentationSlide({ id: "blank-v1", templateId: "general" });

  assert.equal(slide.ui, undefined);
  assert.deepEqual(slide.content, {});
});
