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
  "vertical_funnel",
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

test("renders vertical funnel bands proportionally to stage percentages", () => {
  const html = renderer.templateV2UiToHtml({
    elements: [
      {
        type: "infographic",
        position: { x: 0, y: 0 },
        size: { width: 720, height: 480 },
        data: {
          type: "vertical_funnel",
          items: [
            { value: 100, heading: "Awareness" },
            { value: 50, heading: "Interest" },
            { value: 25, heading: "Conversion" },
          ],
        },
        colors: ["#EFF4EA", "#285B20", "#73926B", "#B7C8B2"],
      },
    ],
    components: [],
  });

  assert.match(html, /points="210,38 510,38 435,172\.6+ 285,172\.6+"/);
  assert.match(html, /points="285,172\.6+ 435,172\.6+ 397\.5,307\.3+ 322\.5,307\.3+"/);
  assert.match(html, />100%<\/div>/);
  assert.match(html, />50%<\/div>/);
  assert.match(html, />25%<\/div>/);
});

test("preserves infographic item offsets and image edits in export HTML", () => {
  const movedGroup = renderInfographic("stair_step_blocks", {
    items: [
      {
        heading: "Foundation",
        __presenton_offset: { x: 14, y: -9 },
      },
    ],
  });
  assert.match(movedGroup, /data-presenton-infographic-item="true"/);
  assert.match(movedGroup, /transform:translate\(14px,-9px\)/);

  const movedGanttRow = renderInfographic("gantt", {
    columns: [{ label: "Q1" }],
    rows: [
      {
        label: "Research",
        items: [],
        __presenton_offset: { x: 8, y: 4 },
      },
    ],
  });
  assert.match(movedGanttRow, /transform:translate\(8px,4px\)/);

  const editedImage = renderInfographic("radial_cycle", {
    center_image: "https://example.com/center.png",
    center_image_settings: {
      fit: "contain",
      focus_x: 25,
      focus_y: 75,
      crop_scale: 1.5,
      flip_h: true,
      opacity: 0.6,
      border_radius: 18,
    },
  });
  assert.match(editedImage, /object-fit:contain/);
  assert.match(editedImage, /object-position:25% 75%/);
  assert.match(editedImage, /scale\(-1\.5,1\.5\)/);
  assert.match(editedImage, /opacity:0\.6/);
  assert.match(editedImage, /border-radius:18px/);
});

test("preserves edited infographic number labels and restores blank defaults", () => {
  const stair = renderInfographic("stair_step_blocks", {
    items: [{ label: "Custom Step" }, { label: "" }],
  });
  const diagonal = renderInfographic("diagonal_circles", {
    items: [{ label: "D7" }],
  });
  const chevron = renderInfographic("chevron_process", {
    items: [{ label: "C7" }],
  });
  const impact = renderInfographic("impact_effort_matrix", {
    items: [{ label: "I7" }],
  });

  assert.match(stair, /Custom Step/);
  assert.match(stair, /Step 02/);
  assert.match(diagonal, /D7/);
  assert.match(chevron, /C7/);
  assert.match(impact, /I7/);
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
  assert.equal([...gauge.matchAll(/<path\b/g)].length, 2);
  assert.doesNotMatch(gauge, /<text\b/);
  assert.doesNotMatch(gauge, />75<\//);
  assert.doesNotMatch(gauge, /data-presenton-infographic-surface/);
});
