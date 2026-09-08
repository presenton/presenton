import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { build } from "esbuild";

let importer;
let textLayout;
let renderer;
let temporaryDirectory;

test.before(async () => {
  temporaryDirectory = await mkdtemp(
    path.join(tmpdir(), "presenton-renderer-fields-"),
  );
  const importerOutput = path.join(temporaryDirectory, "importer.mjs");
  const textLayoutOutput = path.join(temporaryDirectory, "text-layout.mjs");
  const rendererOutput = path.join(temporaryDirectory, "renderer.mjs");

  await Promise.all([
    build({
      entryPoints: [
        path.resolve(
          "components/slide-editor/importing/template-v2-import.ts",
        ),
      ],
      outfile: importerOutput,
      bundle: true,
      platform: "node",
      format: "esm",
      tsconfig: path.resolve("tsconfig.json"),
      logLevel: "silent",
    }),
    build({
      entryPoints: [
        path.resolve("components/slide-editor/text/template-v2-text.ts"),
      ],
      outfile: textLayoutOutput,
      bundle: true,
      platform: "node",
      format: "esm",
      tsconfig: path.resolve("tsconfig.json"),
      logLevel: "silent",
    }),
    build({
      entryPoints: [path.resolve("lib/template-v2-json-to-html.ts")],
      outfile: rendererOutput,
      bundle: true,
      platform: "node",
      format: "esm",
      tsconfig: path.resolve("tsconfig.json"),
      logLevel: "silent",
    }),
  ]);

  importer = await import(
    `${pathToFileURL(importerOutput).href}?cache=${Date.now()}`
  );
  textLayout = await import(
    `${pathToFileURL(textLayoutOutput).href}?cache=${Date.now()}`
  );
  renderer = await import(
    `${pathToFileURL(rendererOutput).href}?cache=${Date.now()}`
  );
});

test.after(async () => {
  if (temporaryDirectory) {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test("preserves text-list item and marker gaps when importing Template V2", () => {
  const slide = importer.adaptTemplateV2LayoutToSlide({
    id: "renderer-fields",
    elements: [
      {
        type: "text-list",
        marker: "bullet",
        gap: 9,
        marker_gap: 6,
        items: [[{ text: "One" }], [{ text: "Two" }]],
      },
    ],
  });

  assert.equal(slide.elements[0].gap, 9);
  assert.equal(slide.elements[0].marker_gap, 6);
});

test("adds text-list gap only between items in the canvas layout", () => {
  const baseElement = {
    type: "text-list",
    marker: "none",
    font: { family: "Arial", size: 10, line_height: 1 },
    items: [[{ text: "One" }], [{ text: "Two" }]],
  };
  const withoutGap = textLayout.layoutTextListRenderItems(
    baseElement,
    200,
    100,
  );
  const withGap = textLayout.layoutTextListRenderItems(
    { ...baseElement, gap: 7 },
    200,
    100,
  );

  assert.equal(withGap.contentHeight - withoutGap.contentHeight, 7);
  assert.equal(withGap.tokens[0].y, withoutGap.tokens[0].y);
  assert.equal(withGap.tokens[1].y - withoutGap.tokens[1].y, 7);
});

test("uses marker_gap between the marker and item text in canvas layout", () => {
  const { tokens } = textLayout.layoutTextListRenderItems(
    {
      type: "text-list",
      marker: "bullet",
      marker_gap: 8,
      font: { family: "Arial", size: 10, line_height: 1 },
      items: [[{ text: "One two three" }]],
    },
    40,
    100,
  );

  const marker = tokens[0];
  const contentTokens = tokens.slice(1).filter((token) => token.text.trim());
  const firstLineToken = contentTokens[0];
  const wrappedLineToken = contentTokens.find(
    (token) => token.y > firstLineToken.y,
  );

  assert.equal(firstLineToken.x - (marker.x + marker.width), 8);
  assert.equal(wrappedLineToken.x, firstLineToken.x);
});

test("honors text-list item and marker gaps in HTML", () => {
  const listHtml = renderer.templateV2UiToHtmlFragment(
    {
      elements: [
      {
        type: "text-list",
        size: { width: 240, height: 100 },
        marker: "bullet",
        gap: 11,
        marker_gap: 13,
        items: [[{ text: "First" }], [{ text: "Second" }]],
      },
      ],
    },
    { width: 240, height: 100 },
  );

  assert.match(listHtml, /column-gap:13px/);
  assert.match(listHtml, /<span aria-hidden="true">•<\/span>/);
  assert.match(listHtml, /<li style="margin-top:11px;/);
});
