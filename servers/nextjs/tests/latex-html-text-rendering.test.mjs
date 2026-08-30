import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { build } from "esbuild";

let htmlText;
let temporaryDirectory;

test.before(async () => {
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), "presenton-math-html-"));
  const outputFile = path.join(temporaryDirectory, "html-text-attrs.mjs");
  await build({
    entryPoints: [
      path.resolve("components/slide-editor/text/html-text-attrs.ts"),
    ],
    outfile: outputFile,
    bundle: true,
    platform: "node",
    format: "esm",
    tsconfig: path.resolve("tsconfig.json"),
    logLevel: "silent",
  });
  htmlText = await import(
    `${pathToFileURL(outputFile).href}?cache=${Date.now()}`
  );
});

test.after(async () => {
  if (temporaryDirectory) {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test("uses browser text flow only for text containing LaTeX", () => {
  assert.equal(
    htmlText.shouldRenderTextElementAsHtml({
      type: "text",
      runs: [{ text: "Plain paragraph" }],
    }),
    false,
  );
  assert.equal(
    htmlText.shouldRenderTextElementAsHtml({
      type: "text",
      runs: [
        { text: "Energy: " },
        { type: "latex", latex: "E = mc^2" },
      ],
    }),
    true,
  );
});

test("detects LaTeX in object and array list-item runs", () => {
  assert.equal(
    htmlText.shouldRenderTextElementAsHtml({
      type: "text-list",
      items: [
        { runs: [{ text: "First" }] },
        { runs: [{ type: "latex", latex: "\\sum_i x_i" }] },
      ],
    }),
    true,
  );
  assert.equal(
    htmlText.shouldRenderTextElementAsHtml({
      type: "text-list",
      items: [[{ text: "Second" }, { type: "latex", latex: "x^2" }]],
    }),
    true,
  );
  assert.equal(
    htmlText.shouldRenderTextElementAsHtml({
      type: "text-list",
      items: [{ runs: [{ text: "Only text" }] }],
    }),
    false,
  );
});
