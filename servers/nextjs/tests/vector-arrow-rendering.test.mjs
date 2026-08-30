import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { build } from "esbuild";

let renderer;
let insertElements;
let temporaryDirectory;

test.before(async () => {
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), "presenton-arrows-"));
  const outputFile = path.join(temporaryDirectory, "renderer.mjs");
  const insertOutputFile = path.join(temporaryDirectory, "insert-elements.mjs");

  await build({
    entryPoints: [path.resolve("lib/template-v2-json-to-html.ts")],
    outfile: outputFile,
    bundle: true,
    platform: "node",
    format: "esm",
    tsconfig: path.resolve("tsconfig.json"),
    logLevel: "silent",
  });
  await build({
    entryPoints: [path.resolve("components/slide-editor/insert/insert-elements.ts")],
    outfile: insertOutputFile,
    bundle: true,
    platform: "node",
    format: "esm",
    tsconfig: path.resolve("tsconfig.json"),
    logLevel: "silent",
  });

  renderer = await import(`${pathToFileURL(outputFile).href}?cache=${Date.now()}`);
  insertElements = await import(
    `${pathToFileURL(insertOutputFile).href}?cache=${Date.now()}`
  );
});

test.after(async () => {
  if (temporaryDirectory) {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

function renderLine(startMarker, endMarker) {
  return renderer.templateV2UiToHtml({
    background: "#FFFFFF",
    elements: [
      {
        type: "vector",
        points: [{ x: 120, y: 220 }, { x: 580, y: 220 }],
        closed: false,
        fill: null,
        stroke: { color: "#111111", width: 2 },
        start_marker: startMarker,
        end_marker: endMarker,
      },
    ],
    components: [],
  });
}

const theme = {
  primary: "#7A5AF8",
  primary_text: "#FFFFFF",
  background: "#FFFFFF",
  background_text: "#111111",
  card: "#F5F5F5",
  stroke: "#222222",
  fonts: {},
};

test("creates line arrows as one two-point editable vector", () => {
  const [arrow] = insertElements.createElementInsertElements(
    "vector-line-arrow",
    theme,
  );

  assert.equal(arrow.type, "vector");
  assert.equal(arrow.closed, false);
  assert.equal(arrow.points.length, 2);
  assert.equal(arrow.points[1].x - arrow.points[0].x, 300);
  assert.equal(arrow.end_marker, "arrow");
  assert.equal(arrow.fill, undefined);
});

test("offers arrowhead styles instead of redundant direction presets", () => {
  const lineGroup = insertElements.ELEMENT_INSERT_GROUPS.find(
    (group) => group.label === "Lines & Arrows",
  );
  const ids = lineGroup.items.map((item) => item.id);

  assert.deepEqual(ids, [
    "vector-line",
    "vector-line-arrow",
    "vector-line-arrow-both",
    "vector-line-stealth",
    "vector-line-filled",
    "vector-line-filled-both",
    "vector-line-circle-arrow",
    "vector-line-square-arrow",
    "vector-line-diamond-arrow",
  ]);
});

test("renders editable vector line arrowheads as SVG endpoint markers", () => {
  const html = renderLine("circle", "triangle");

  assert.match(html, /marker-start="url\(#vector-marker-[a-z0-9]+-start\)"/);
  assert.match(html, /marker-end="url\(#vector-marker-[a-z0-9]+-end\)"/);
  assert.match(html, /<circle cx="6" cy="0" r="4"/);
  assert.match(html, /M11 0 L1 -5 L1 5 Z/);
  assert.doesNotMatch(html, /<img/);
});

test("ignores unsupported endpoint marker values", () => {
  const html = renderLine("unknown", "arrow");

  assert.doesNotMatch(html, /marker-start=/);
  assert.match(html, /marker-end="url\(#vector-marker-[a-z0-9]+-end\)"/);
});
