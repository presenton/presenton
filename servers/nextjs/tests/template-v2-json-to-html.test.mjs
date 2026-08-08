import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { build } from "esbuild";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

async function importRenderer() {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "template-v2-html-"));
  const outfile = path.join(tempDirectory, "template-v2-json-to-html.mjs");
  await build({
    absWorkingDir: projectRoot,
    bundle: true,
    entryPoints: ["lib/template-v2-json-to-html.ts"],
    format: "esm",
    outfile,
    platform: "node",
    tsconfig: path.join(projectRoot, "tsconfig.json"),
  });
  return import(pathToFileURL(outfile).href);
}

test("renders template v2 text run underlines in generated HTML", async () => {
  const { templateV2UiToHtml } = await importRenderer();

  const html = templateV2UiToHtml({
    elements: [
      {
        type: "text",
        position: { x: 0, y: 0 },
        size: { width: 300, height: 80 },
        font: {
          family: "Arial",
          size: 24,
          color: "#111827",
          underline: true,
        },
        runs: [
          { text: "Under", font: { underline: true } },
          { text: "Plain", font: { underline: false } },
        ],
      },
    ],
  });

  assert.ok(html);
  assert.match(
    html,
    /<span style="[^"]*text-decoration:underline;[^"]*">Under\s*<\/span>/,
  );
  assert.match(
    html,
    /<span style="[^"]*text-decoration:none;[^"]*">Plain<\/span>/,
  );
  assert.doesNotMatch(
    html,
    /display:flex;[^"]*text-decoration:underline;/,
    "text wrappers should not force underline onto child runs",
  );
});

test("renders legacy text-decoration underline fields", async () => {
  const { templateV2UiToHtml } = await importRenderer();

  const html = templateV2UiToHtml({
    elements: [
      {
        type: "text",
        position: { x: 0, y: 0 },
        size: { width: 300, height: 80 },
        font: { family: "Arial", size: 24, color: "#111827" },
        runs: [{ text: "Legacy", font: { text_decoration: "underline" } }],
      },
    ],
  });

  assert.ok(html);
  assert.match(
    html,
    /<span style="[^"]*text-decoration:underline;[^"]*">Legacy<\/span>/,
  );
});

test("renders math expressions with KaTeX and export screenshot metadata", async () => {
  const { templateV2UiToHtml } = await importRenderer();

  const html = templateV2UiToHtml({
    elements: [
      {
        type: "math",
        position: { x: 20, y: 30 },
        size: { width: 600, height: 120 },
        latex: String.raw`$$\frac{x_i^2}{\sum_{j=1}^n y_j}$$`,
        display_mode: true,
        font: { size: 38, color: "#312E81" },
        alignment: { horizontal: "center", vertical: "middle" },
      },
    ],
  });

  assert.ok(html);
  assert.match(html, /data-presenton-math="true"/);
  assert.match(html, /data-screenshot="true"/);
  assert.match(html, /data-screenshot-include-children="true"/);
  assert.match(html, /class="katex-display"/);
  assert.match(html, /<math[^>]*display="block"/);
  assert.match(html, /x_i\^2/);
  assert.doesNotMatch(html, /\$\$/);
});

test("renders charts with local Chart.js and datalabels scripts", async () => {
  const { templateV2UiToHtml } = await importRenderer();

  const html = templateV2UiToHtml({
    elements: [
      {
        type: "chart",
        chartType: "bar",
        position: { x: 0, y: 0 },
        size: { width: 640, height: 360 },
        categories: ["One", "Two"],
        series: [{ name: "Values", values: [10, 20] }],
        dataLabels: "top",
      },
    ],
  });

  assert.ok(html);
  assert.match(html, /<script src="\/vendor\/chart-4\.5\.1\.umd\.min\.js"><\/script>/);
  assert.match(
    html,
    /<script src="\/vendor\/chartjs-plugin-datalabels-2\.2\.0\.min\.js"><\/script>/,
  );
  assert.match(html, /&quot;datalabels&quot;:\{/);
  assert.match(html, /Chart\.register\(window\.ChartDataLabels\)/);
  assert.doesNotMatch(html, /cdn\.jsdelivr\.net/);

  const inlineScripts = Array.from(
    html.matchAll(/<script>([\s\S]*?)<\/script>/g),
    (match) => match[1],
  );
  assert.equal(inlineScripts.length, 1);
  assert.doesNotThrow(() => new Function(inlineScripts[0]));
});
