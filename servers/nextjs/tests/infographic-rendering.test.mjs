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
    path.join(tmpdir(), "presenton-infographics-"),
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

const structuralTypes = [
  "gantt",
  "timeline",
  "roadmap",
  "milestone_timeline",
  "staircase",
  "supply_chain",
  "stair_step_blocks",
  "maturity_model",
  "pillar_framework",
  "transformation_hub",
  "diagonal_circles",
  "risk_matrix",
  "chevron_process",
  "radial_cycle",
  "conversion_funnel",
  "pyramid",
  "segmented_wheel",
  "customer_journey",
  "before_after",
  "impact_effort_matrix",
  "comparison_matrix",
  "org_chart",
  "decision_tree",
  "mind_map",
];

function renderInfographic(type, data = {}) {
  return renderer.templateV2UiToHtml({
    background: "#FFFFFF",
    elements: [
      {
        type: "infographic",
        position: { x: 20, y: 20 },
        size: { width: 720, height: 420 },
        data: { type, items: [], ...data },
        colors: ["#FFFFFF", "#102E79", "#6388D0"],
        text_color: "#111111",
      },
    ],
    components: [],
  });
}

test("renders every structural infographic through the export HTML surface", () => {
  for (const type of structuralTypes) {
    const html = renderInfographic(type);
    assert.ok(html, `${type} should produce HTML`);
    assert.match(
      html,
      /data-presenton-infographic-surface="true"/,
      `${type} should use the fixed-layout export surface`,
    );
    assert.doesNotMatch(html, /NaN|undefined/, `${type} output must be valid`);
  }
});

test("preserves aspect ratio and centers fixed-layout infographics", () => {
  const html = renderer.templateV2UiToHtml({
    elements: [
      {
        type: "infographic",
        position: { x: 0, y: 0 },
        size: { width: 360, height: 360 },
        data: { type: "timeline", items: [] },
        colors: ["#FFFFFF", "#102E79"],
      },
    ],
    components: [],
  });

  assert.match(html, /transform:scale\(0\.5\)/);
  assert.match(html, /top:115px/);
});

test("keeps progress and gauge exports on their native meter renderers", () => {
  const progress = renderInfographic("progress_bar", {
    min_value: 0,
    max_value: 100,
    value: 65,
  });
  const gauge = renderInfographic("gauge", {
    min_value: 0,
    max_value: 100,
    value: 75,
  });

  assert.match(progress, /width:65%/);
  assert.doesNotMatch(progress, /data-presenton-infographic-surface/);
  assert.match(gauge, /<svg/);
  assert.doesNotMatch(gauge, /data-presenton-infographic-surface/);
});
