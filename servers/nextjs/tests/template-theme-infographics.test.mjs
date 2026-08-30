import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { build } from "esbuild";

let themedInserts;
let temporaryDirectory;

test.before(async () => {
  temporaryDirectory = await mkdtemp(
    path.join(tmpdir(), "presenton-template-theme-"),
  );
  const entryFile = path.join(temporaryDirectory, "entry.ts");
  const outputFile = path.join(temporaryDirectory, "bundle.mjs");
  await writeFile(
    entryFile,
    [
      `export { createInfographicInsertElements } from ${JSON.stringify(path.resolve("components/slide-editor/insert/insert-elements.ts"))};`,
      `export { normalizeTemplateTheme, resolveTemplateIdFromPresentation, resolveTemplateTheme } from ${JSON.stringify(path.resolve("lib/template-theme.ts"))};`,
      `export { default as TemplateService } from ${JSON.stringify(path.resolve("app/(presentation-generator)/services/api/template.ts"))};`,
    ].join("\n"),
  );
  await build({
    entryPoints: [entryFile],
    outfile: outputFile,
    bundle: true,
    platform: "node",
    format: "esm",
    tsconfig: path.resolve("tsconfig.json"),
    logLevel: "silent",
  });
  themedInserts = await import(
    `${pathToFileURL(outputFile).href}?cache=${Date.now()}`
  );
});

test.after(async () => {
  if (temporaryDirectory) {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

const theme = {
  primary: "#aa2200",
  background: "#fffaf0",
  card: "#f5dfcf",
  stroke: "#c7aa98",
  primary_text: "#ffffff",
  background_text: "#28150d",
  graph_0: "#7a1800",
  graph_1: "#a53516",
  graph_2: "#c85735",
  graph_3: "#e27b57",
  graph_4: "#ed9e80",
  graph_5: "#f3baa3",
  graph_6: "#f7cfbe",
  graph_7: "#fae0d4",
  graph_8: "#fcedea",
  graph_9: "#fff6f2",
};

test("applies semantic template roles to structural infographics", () => {
  const [element] = themedInserts.createInfographicInsertElements(
    "timeline",
    theme,
  );
  assert.equal(element.text_color, theme.background_text);
  assert.deepEqual(element.colors.slice(0, 4), [
    theme.background,
    theme.graph_0,
    theme.graph_1,
    theme.graph_2,
  ]);
  assert.equal(element.data.card_color, theme.card);
  assert.equal(element.data.background_text_color, theme.background_text);
});

test("uses primary and card roles for meter infographics", () => {
  const [progress] = themedInserts.createInfographicInsertElements(
    "progress-bar",
    theme,
  );
  assert.deepEqual(progress.colors, [theme.card, theme.primary]);
});

test("normalizes nested API themes and derives a template fallback", () => {
  const normalized = themedInserts.normalizeTemplateTheme({
    theme: { colors: theme },
  });
  assert.equal(normalized.primary, theme.primary);
  assert.equal(normalized.background, theme.background);

  const derived = themedInserts.resolveTemplateTheme({
    layouts: {
      layouts: [
        {
          components: [
            {
              elements: [
                { type: "container", fill: { color: "#fefefe" } },
                { type: "chart", colors: ["#7c3aed", "#0891b2"] },
                { type: "text", font: { color: "#111827" } },
              ],
            },
          ],
        },
      ],
    },
  });
  assert.equal(derived.background, "#fefefe");
  assert.ok(["#7c3aed", "#0891b2"].includes(derived.primary));
  assert.equal(derived.background_text, "#111827");
});

test("loads and caches normalized template themes from the theme endpoint", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url) => {
    requests.push(String(url));
    return new Response(
      JSON.stringify({
        template_id: "theme-service-test",
        theme: { colors: theme },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  };

  try {
    const first = await themedInserts.TemplateService.getTemplateTheme(
      "template-v2-theme-service-test",
    );
    const second = await themedInserts.TemplateService.getTemplateTheme(
      "theme-service-test",
    );

    assert.equal(first.primary, theme.primary);
    assert.equal(second.background, theme.background);
    assert.deepEqual(requests, [
      "/api/v1/ppt/template/theme-service-test/theme",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("resolves the template id used when a presentation loads", () => {
  assert.equal(
    themedInserts.resolveTemplateIdFromPresentation({
      template_id: "template-top-level",
      slides: [{ layout_group: "template-from-slide" }],
    }),
    "template-top-level",
  );
  assert.equal(
    themedInserts.resolveTemplateIdFromPresentation({
      slides: [{ layout_group: "template-from-slide" }],
    }),
    "template-from-slide",
  );
  assert.equal(
    themedInserts.resolveTemplateIdFromPresentation({
      slides: [{ layout_group: "blank" }],
    }),
    "",
  );
});
