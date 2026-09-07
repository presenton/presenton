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
    path.join(tmpdir(), "presenton-font-floors-"),
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

function renderSlide(elements) {
  return renderer.templateV2UiToHtml({
    elements,
    components: [],
  });
}

function extractChartConfig(html) {
  const match = html.match(/data-chart-config="([^"]+)"/);
  assert.ok(match, "chart HTML should embed a chart config");
  return JSON.parse(
    match[1].replaceAll("&quot;", '"').replaceAll("&#x27;", "'").replaceAll("&amp;", "&"),
  );
}

function collectFontSizes(value, sizes = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectFontSizes(item, sizes);
  } else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (
        (key === "size" || key === "titleFontSize" || key === "valueFontSize") &&
        typeof item === "number"
      ) {
        sizes.push(item);
      } else {
        collectFontSizes(item, sizes);
      }
    }
  }
  return sizes;
}

test("bumps authored text below the 12px floor", () => {
  const html = renderSlide([
    {
      type: "text",
      position: { x: 0, y: 0 },
      size: { width: 400, height: 200 },
      font: { size: 9, color: "#111111" },
      runs: [{ text: "Слишком мелкий авторский шрифт" }],
      decorative: false,
      name: "body_text",
      max_length: 200,
      min_length: 10,
    },
  ]);

  assert.ok(html);
  assert.match(html, /font-size:12px/);
  assert.doesNotMatch(html, /font-size:9px/);
});

test("keeps fonts at or above the floor untouched", () => {
  const html = renderSlide([
    {
      type: "text",
      position: { x: 0, y: 0 },
      size: { width: 400, height: 200 },
      font: { size: 20, color: "#111111" },
      runs: [{ text: "Обычный текст" }],
      decorative: false,
      name: "body_text",
      max_length: 200,
      min_length: 10,
    },
  ]);

  assert.match(html, /font-size:20px/);
});

test("bumps small fonts inside text runs", () => {
  const html = renderSlide([
    {
      type: "text",
      position: { x: 0, y: 0 },
      size: { width: 400, height: 200 },
      runs: [
        { text: "Мелкий ран ", font: { size: 10, color: "#111111" } },
        { text: "и крупный", font: { size: 18, color: "#111111" } },
      ],
      decorative: false,
      name: "mixed_text",
      max_length: 200,
      min_length: 10,
    },
  ]);

  assert.match(html, /font-size:12px/);
  assert.match(html, /font-size:18px/);
  assert.doesNotMatch(html, /font-size:10px/);
});

test("chart fonts stay readable on a recommended 640x300 chart", () => {
  const html = renderSlide([
    {
      type: "chart",
      position: { x: 0, y: 0 },
      size: { width: 640, height: 300 },
      chart_type: "bar",
      series: [{ name: "Выручка", values: [10, 24, 32] }],
      data: [{ label: "2023", value: 10 }, { label: "2024", value: 24 }],
      decorative: false,
      name: "revenue_chart",
    },
  ]);

  const config = extractChartConfig(html);
  const sizes = collectFontSizes(config);
  assert.ok(sizes.length > 0, "chart config should declare font sizes");
  // Тики допускаются до 10px, всё остальное — не ниже 12px (пол рендера).
  assert.ok(
    Math.min(...sizes) >= 10,
    `chart font sizes should be >= 10, got ${sizes.join(", ")}`,
  );
  assert.ok(
    Math.max(...sizes) >= 12,
    `legend/title fonts should be >= 12, got ${sizes.join(", ")}`,
  );
});
