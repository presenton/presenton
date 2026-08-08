import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { after, before } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const nextRoot = path.resolve(dirname, "..");
let tempDirectory;
let textModule;

before(async () => {
  tempDirectory = await mkdtemp(path.join(os.tmpdir(), "presenton-text-runs-"));
  const outfile = path.join(tempDirectory, "template-v2-text.mjs");

  await build({
    entryPoints: [
      path.join(
        nextRoot,
        "components/slide-editor/text/template-v2-text.ts",
      ),
    ],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile,
    alias: {
      "@": nextRoot,
    },
    logLevel: "silent",
  });

  textModule = await import(pathToFileURL(outfile).href);
});

after(async () => {
  if (tempDirectory) {
    await rm(tempDirectory, { recursive: true, force: true });
  }
});

const baseFont = {
  family: "Anton",
  size: 56,
  color: "#000000",
  bold: true,
  italic: false,
  underline: false,
  lineHeight: 1.05,
  letterSpacing: -0.55,
  opacity: 1,
};

test("layout text runs preserve explicit whitespace from runs", () => {
  const runs = [
    { text: "What is a ", font: baseFont },
    { text: "Smart Task Management", font: { ...baseFont, color: "#5F4F9B" } },
    { text: " Platform ?", font: baseFont },
  ];

  const [line] = textModule.layoutRenderTextRuns(runs, 4000, "word");
  const rendered = line.map((segment) => segment.text).join("");
  const spaceSegments = line.filter((segment) =>
    textModule.isRenderWhitespaceText(segment.text),
  );

  assert.equal(rendered, "What is a Smart Task Management Platform ?");
  assert.ok(spaceSegments.length > 0);
  assert.ok(spaceSegments.every((segment) => segment.width > 0));
  assert.ok(
    spaceSegments.every(
      (segment) =>
        textModule.renderKonvaTextSegment(segment.text) ===
        "\u00A0".repeat(segment.text.length),
    ),
  );
});

test("layout text runs do not infer spaces across color boundaries", () => {
  const runs = [
    { text: "Prod", font: baseFont },
    { text: "uc", font: { ...baseFont, color: "#5F4F9B" } },
    { text: "tivity Growth Analysis", font: baseFont },
  ];

  const [line] = textModule.layoutRenderTextRuns(runs, 4000, "word");
  const rendered = line.map((segment) => segment.text).join("");

  assert.equal(rendered, "Productivity Growth Analysis");
  assert.equal(rendered.includes("Prod uc tivity"), false);
});

test("raw render text runs do not infer spaces across styled word fragments", () => {
  const element = {
    type: "text",
    text: "Productivity",
    font: baseFont,
    runs: [
      { text: "Pro", font: baseFont },
      { text: "duct", font: { ...baseFont, bold: false } },
      { text: "ivity", font: { ...baseFont, italic: true } },
    ],
  };

  const rendered = textModule
    .rawRenderTextRuns(element)
    .map((run) => run.text)
    .join("");

  assert.equal(rendered, "Productivity");
});

test("layout text runs do not infer spaces before punctuation", () => {
  const runs = [
    { text: "Platform", font: baseFont },
    { text: "?", font: { ...baseFont, color: "#5F4F9B" } },
  ];

  const [line] = textModule.layoutRenderTextRuns(runs, 4000, "word");

  assert.equal(line.map((segment) => segment.text).join(""), "Platform?");
});

test("rich text layout preserves leading and trailing whitespace tokens", () => {
  const runs = [{ text: "  Padded  ", font: baseFont }];

  const { tokens } = textModule.layoutRichText(
    runs,
    4000,
    baseFont,
    "left",
    "top",
    200,
    "word",
  );

  assert.equal(tokens.map((token) => token.text).join(""), "  Padded  ");
  assert.equal(
    textModule.renderKonvaTextSegment(tokens[0].text),
    "\u00A0\u00A0",
  );
  assert.equal(
    textModule.renderKonvaTextSegment(tokens.at(-1).text),
    "\u00A0\u00A0",
  );
});
