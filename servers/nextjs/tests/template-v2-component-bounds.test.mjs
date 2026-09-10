import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { build } from "esbuild";

let templateImport;
let temporaryDirectory;

test.before(async () => {
  temporaryDirectory = await mkdtemp(
    path.join(tmpdir(), "presenton-component-bounds-"),
  );
  const outputFile = path.join(temporaryDirectory, "template-v2-import.mjs");

  await build({
    entryPoints: [
      path.resolve("components/slide-editor/importing/template-v2-import.ts"),
    ],
    outfile: outputFile,
    bundle: true,
    platform: "node",
    format: "esm",
    tsconfig: path.resolve("tsconfig.json"),
    logLevel: "silent",
  });

  templateImport = await import(
    `${pathToFileURL(outputFile).href}?cache=${Date.now()}`
  );
});

test.after(async () => {
  if (temporaryDirectory) {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test("localizes point-only vectors within an unpositioned component", () => {
  const element = templateImport.adaptTemplateV2ComponentToElement({
    id: "vector-component",
    elements: [
      {
        type: "vector",
        points: [
          { x: 10, y: 20 },
          { x: 50, y: 80 },
          { x: "invalid", y: 30 },
        ],
        stroke: { color: "#101828", width: 2 },
      },
    ],
  });

  assert.deepEqual(element.position, { x: 10, y: 20 });
  assert.deepEqual(element.size, { width: 40, height: 60 });
  assert.deepEqual(element.children[0].points, [
    { x: 0, y: 0 },
    { x: 40, y: 60 },
  ]);
});

test("does not synthesize vector bounds from incomplete point pairs", () => {
  const element = templateImport.adaptTemplateV2ComponentToElement({
    id: "invalid-vector-component",
    elements: [
      {
        type: "vector",
        points: [{ x: 10 }, { y: 20 }],
        stroke: { color: "#101828", width: 2 },
      },
    ],
  });

  assert.equal(element, null);
});

test("keeps vector points relative to a positioned ancestor", () => {
  const element = templateImport.adaptTemplateV2ComponentToElement({
    id: "nested-vector-component",
    elements: [
      {
        type: "group",
        position: { x: 20, y: 30 },
        children: [
          {
            type: "vector",
            points: [
              { x: 5, y: 6 },
              { x: 45, y: 66 },
            ],
            stroke: { color: "#101828", width: 2 },
          },
        ],
      },
    ],
  });

  assert.deepEqual(element.position, { x: 25, y: 36 });
  assert.deepEqual(element.children[0].position, { x: -5, y: -6 });
  assert.deepEqual(element.children[0].children[0].points, [
    { x: 5, y: 6 },
    { x: 45, y: 66 },
  ]);
});
