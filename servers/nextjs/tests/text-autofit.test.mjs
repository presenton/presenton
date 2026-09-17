import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { build } from "esbuild";

let textLayout;
let renderer;
let temporaryDirectory;

test.before(async () => {
  temporaryDirectory = await mkdtemp(
    path.join(tmpdir(), "presenton-text-autofit-"),
  );
  const textLayoutOutput = path.join(temporaryDirectory, "text-layout.mjs");
  const rendererOutput = path.join(temporaryDirectory, "renderer.mjs");

  await Promise.all([
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

const BASE_FONT = {
  family: "Arial",
  size: 24,
  color: "#111827",
  bold: false,
  italic: false,
  underline: false,
  lineHeight: 1.15,
  letterSpacing: 0,
  opacity: 1,
};

test("returns scale 1 for short text in a generously-sized box", () => {
  const scale = textLayout.autofitFontScale(
    [{ text: "Short heading", font: BASE_FONT }],
    { width: 600, height: 400 },
    1.15,
  );

  assert.equal(scale, 1);
});

test("shrinks a long string in a small box but never below the floor", () => {
  const longText = "Lorem ipsum dolor sit amet, ".repeat(24).trim();
  assert.ok(longText.length >= 600);

  const scale = textLayout.autofitFontScale(
    [{ text: longText, font: BASE_FONT }],
    { width: 300, height: 80 },
    1.15,
  );

  assert.ok(scale < 1, `expected scale < 1, got ${scale}`);
  assert.ok(scale >= 0.72, `expected scale >= 0.72, got ${scale}`);
});

test("never returns NaN or an out-of-range value without a DOM", () => {
  assert.equal(typeof document, "undefined");

  const longText = "Lorem ipsum dolor sit amet, ".repeat(24).trim();
  const cases = [
    { runs: [{ text: "Short", font: BASE_FONT }], box: { width: 600, height: 400 } },
    { runs: [{ text: longText, font: BASE_FONT }], box: { width: 300, height: 80 } },
    { runs: [{ text: longText, font: BASE_FONT }], box: { width: 0, height: 0 } },
    { runs: [], box: { width: 300, height: 80 } },
  ];

  for (const { runs, box } of cases) {
    const scale = textLayout.autofitFontScale(runs, box, 1.15);
    assert.ok(Number.isFinite(scale), `scale must be finite, got ${scale}`);
    assert.ok(scale >= 0.72 && scale <= 1, `scale out of range: ${scale}`);
  }
});

test("renders long text at a smaller font-size than authored in the HTML output", () => {
  const longText = "Lorem ipsum dolor sit amet, ".repeat(24).trim();
  const html = renderer.templateV2UiToHtmlFragment(
    {
      elements: [
        {
          type: "text",
          size: { width: 300, height: 80 },
          font: { family: "Arial", size: 24, line_height: 1.15 },
          text: longText,
        },
      ],
    },
    { width: 300, height: 80 },
  );

  assert.doesNotMatch(html, /font-size:24px/);
  assert.match(html, /font-size:(\d+(\.\d+)?)px/);
  const [, matchedSize] = html.match(/font-size:(\d+(\.\d+)?)px/);
  assert.ok(Number(matchedSize) < 24);
  assert.ok(Number(matchedSize) >= 24 * 0.72 - 0.01);
});

test("does not change output for short text that already fits (scale-1 no-op)", () => {
  const element = {
    type: "text",
    size: { width: 300, height: 200 },
    font: { family: "Arial", size: 24, line_height: 1.15 },
    text: "Short heading",
  };
  const html = renderer.templateV2UiToHtmlFragment(
    { elements: [element] },
    { width: 300, height: 200 },
  );

  assert.match(html, /font-size:24px/);
});
