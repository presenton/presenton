import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { build } from "esbuild";

let renderer;
let temporaryDirectory;

test.before(async () => {
  temporaryDirectory = await mkdtemp(
    path.join(tmpdir(), "presenton-cjk-line-height-"),
  );
  const outputFile = path.join(temporaryDirectory, "renderer.mjs");

  await build({
    entryPoints: [path.resolve("lib/template-v2-json-to-html.ts")],
    outfile: outputFile,
    bundle: true,
    platform: "node",
    format: "esm",
    tsconfig: path.resolve("tsconfig.json"),
    logLevel: "silent",
  });

  renderer = await import(
    `${pathToFileURL(outputFile).href}?cache=${Date.now()}`
  );
});

test.after(async () => {
  if (temporaryDirectory) {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

function textElement({ text, lineHeight = 0.8 }) {
  return {
    type: "text",
    text,
    position: { x: 40, y: 40 },
    size: { width: 600, height: 120 },
    font: {
      size: 32,
      family: "Arial",
      color: "#111827",
      line_height: lineHeight,
    },
    alignment: { horizontal: "left", vertical: "top" },
  };
}

function render(elements, options) {
  return renderer.templateV2UiToHtmlFragment(
    { background: "#FFFFFF", elements, components: [] },
    options,
  );
}

test("keeps sub-1.0 line height for latin text by default", () => {
  const html = render([textElement({ text: "Quarterly revenue review" })]);

  assert.match(html, /line-height:0\.8;/);
});

test("raises line height for CJK text when the export floor is enabled", () => {
  const html = render(
    [textElement({ text: "中国儿童早期教育科普" })],
    { minCjkLineHeight: 1.35 },
  );

  assert.match(html, /line-height:1\.35;/);
  assert.doesNotMatch(html, /line-height:0\.8;/);
});

test("leaves latin text untouched when the export floor is enabled", () => {
  const html = render(
    [textElement({ text: "Quarterly revenue review" })],
    { minCjkLineHeight: 1.35 },
  );

  assert.match(html, /line-height:0\.8;/);
  assert.doesNotMatch(html, /line-height:1\.35;/);
});

test("keeps declared line heights above the floor", () => {
  const html = render(
    [textElement({ text: "第一行\n第二行", lineHeight: 1.5 })],
    { minCjkLineHeight: 1.35 },
  );

  assert.match(html, /line-height:1\.5;/);
});

test("applies the floor inside nested containers and flex layouts", () => {
  const html = render(
    [
      {
        type: "container",
        position: { x: 0, y: 0 },
        size: { width: 1280, height: 720 },
        child: {
          type: "flex",
          direction: "column",
          gap: 12,
          position: { x: 24, y: 24 },
          size: { width: 600, height: 300 },
          children: [textElement({ text: "产品路线图" })],
        },
      },
    ],
    { minCjkLineHeight: 1.35 },
  );

  assert.match(html, /line-height:1\.35;/);
});

test("leaves the full document renderer unchanged when no floor is passed", () => {
  const html = renderer.templateV2UiToHtml({
    background: "#FFFFFF",
    elements: [textElement({ text: "产品路线图" })],
    components: [],
  });

  assert.match(html, /line-height:0\.8;/);
});
