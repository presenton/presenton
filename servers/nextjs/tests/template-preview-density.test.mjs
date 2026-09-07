import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { build } from "esbuild";

let densityUtils;
let temporaryDirectory;

test.before(async () => {
  temporaryDirectory = await mkdtemp(
    path.join(tmpdir(), "presenton-template-density-"),
  );
  const outputFile = path.join(temporaryDirectory, "density-utils.mjs");

  await build({
    entryPoints: [
      path.resolve(
        "app/(presentation-generator)/template-preview/components/editor/templatePreviewUtils.ts",
      ),
    ],
    outfile: outputFile,
    bundle: true,
    platform: "node",
    format: "esm",
    tsconfig: path.resolve("tsconfig.json"),
    logLevel: "silent",
  });

  densityUtils = await import(
    `${pathToFileURL(outputFile).href}?cache=${Date.now()}`
  );
});

test.after(async () => {
  if (temporaryDirectory) {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

function editableText(name, text = "Original text") {
  return {
    type: "text",
    name,
    decorative: false,
    min_length: 4,
    max_length: 40,
    runs: [{ text }],
  };
}

function repeatedCard(index, fieldName = `title_${index}`) {
  return {
    type: "group",
    name: `card_${index}`,
    children: [editableText(fieldName, `Card ${index}`)],
  };
}

function roadmapNode(index) {
  return {
    type: "flex",
    name: `process_node_${index}`,
    direction: "column",
    children: [
      {
        type: "group",
        name: "node_badge_icon",
        children: [
          {
            type: "image",
            name: "node_badge",
            decorative: true,
            data: "badge.svg",
          },
          {
            type: "image",
            name: "node_icon",
            decorative: false,
            is_icon: true,
            data: `icon-${index}.svg`,
          },
        ],
      },
      editableText("node_heading", `Step ${index}`),
      editableText("node_description", "Step description"),
    ],
  };
}

function metricsWithLayoutOnlyWrapperDifferences() {
  const metricText = (name, text) => ({
    type: "text",
    name,
    decorative: false,
    min_length: 1,
    max_length: 60,
    runs: [{ text }],
  });
  const contentChildren = (value, heading, description) => [
    metricText("metric_value", value),
    {
      type: "flex",
      name: "metric_text_stack",
      direction: "column",
      children: [
        metricText("metric_heading", heading),
        metricText("metric_description", description),
      ],
    },
  ];
  const divider = {
    type: "vector",
    decorative: true,
    points: [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
    ],
  };

  return {
    type: "group",
    name: "metric_items",
    children: [
      {
        type: "flex",
        name: "metric_item_1",
        direction: "row",
        children: contentChildren(
          "68%",
          "Mobile-first",
          "Primarily uses mobile",
        ),
      },
      {
        type: "flex",
        name: "metric_item_2",
        direction: "column",
        children: [
          divider,
          {
            type: "flex",
            name: "metric_content",
            direction: "row",
            children: contentChildren(
              "74%",
              "Research",
              "Compares products",
            ),
          },
        ],
      },
      {
        type: "flex",
        name: "metric_item_3",
        direction: "column",
        children: [
          divider,
          {
            type: "group",
            name: "metric_content",
            children: contentChildren(
              "32%",
              "Engagement",
              "Prefers personalized content",
            ),
          },
        ],
      },
    ],
  };
}

test("uses schema min, midpoint, and max counts for text-list arrays", () => {
  const layout = {
    elements: [
      {
        type: "text-list",
        name: "key_points",
        decorative: false,
        min_items: 2,
        max_items: 4,
        min_item_length: 4,
        max_item_length: 30,
        items: [
          [{ text: "One" }],
          [{ text: "Two" }],
          [{ text: "Three" }],
          [{ text: "Four" }],
        ],
      },
    ],
  };

  for (const [density, expectedCount] of [
    ["Low", 2],
    ["Medium", 3],
    ["High", 4],
  ]) {
    const preview = densityUtils.applyTemplateContentDensity(layout, density);
    assert.equal(preview.elements[0].items.length, expectedCount);
  }
});

test("infers table text limits and applies row and column density", () => {
  const layout = {
    elements: [
      {
        type: "table",
        name: "metrics",
        decorative: false,
        min_columns: 1,
        max_columns: 3,
        min_rows: 1,
        max_rows: 3,
        size: { width: 600, height: 300 },
        columns: [
          { runs: [{ text: "Metric", font: { size: 14 } }] },
          { runs: [{ text: "Value", font: { size: 14 } }] },
        ],
        rows: [
          [
            { runs: [{ text: "Activation", font: { size: 14 } }] },
            { runs: [{ text: "71%", font: { size: 14 } }] },
          ],
          [
            { runs: [{ text: "Retention", font: { size: 14 } }] },
            { runs: [{ text: "58%", font: { size: 14 } }] },
          ],
        ],
      },
    ],
  };

  assert.equal(densityUtils.hasLayoutContentDensityTargets(layout), true);

  const previews = ["Low", "Medium", "High"].map((density) =>
    densityUtils.applyTemplateContentDensity(layout, density),
  );
  assert.deepEqual(
    previews.map((preview) => preview.elements[0].columns.length),
    [1, 2, 3],
  );
  assert.deepEqual(
    previews.map((preview) => preview.elements[0].rows.length),
    [1, 2, 3],
  );
  for (const preview of previews) {
    const table = preview.elements[0];
    assert.equal(
      table.rows.every((row) => row.length === table.columns.length),
      true,
    );
  }

  const headerLengths = previews.map(
    (preview) => preview.elements[0].columns[0].runs[0].text.length,
  );
  const cellLengths = previews.map(
    (preview) => preview.elements[0].rows[0][0].runs[0].text.length,
  );
  assert.equal(headerLengths[0] < headerLengths[2], true);
  assert.equal(cellLengths[0] < cellLengths[2], true);
});

test("uses min_children and max_children for repeatable flex arrays", () => {
  const layout = {
    components: [
      {
        id: "cards",
        elements: [
          {
            type: "flex",
            name: "cards",
            min_children: 2,
            max_children: 4,
            children: [1, 2, 3, 4].map((index) => repeatedCard(index)),
          },
        ],
      },
    ],
  };

  for (const [density, expectedCount] of [
    ["Low", 2],
    ["Medium", 3],
    ["High", 4],
  ]) {
    const preview = densityUtils.applyTemplateContentDensity(layout, density);
    assert.equal(
      preview.components[0].elements[0].children.length,
      expectedCount,
    );
  }
});

test("centers reduced repeated group arrays like the backend hydrator", () => {
  const layout = {
    components: [
      {
        id: "metrics",
        elements: [
          {
            type: "group",
            name: "metrics",
            children: [1, 2, 3, 4].map((index) => repeatedCard(index)),
          },
        ],
      },
    ],
  };

  const low = densityUtils.applyTemplateContentDensity(layout, "Low");
  assert.deepEqual(
    low.components[0].elements[0].children.map((child) => child.name),
    ["card_2", "card_3"],
  );

  const medium = densityUtils.applyTemplateContentDensity(layout, "Medium");
  assert.deepEqual(
    medium.components[0].elements[0].children.map((child) => child.name),
    ["card_1", "card_2", "card_3"],
  );
});

test("supports roadmap arrays made from structurally equivalent flex children", () => {
  const layout = {
    components: [
      {
        id: "roadmap",
        elements: [
          {
            type: "group",
            name: "process_nodes",
            children: [1, 2, 3, 4, 5, 6].map(roadmapNode),
          },
        ],
      },
    ],
  };

  assert.equal(densityUtils.hasLayoutContentDensityTargets(layout), true);
  for (const [density, expectedCount] of [
    ["Low", 3],
    ["Medium", 5],
    ["High", 6],
  ]) {
    const preview = densityUtils.applyTemplateContentDensity(layout, density);
    const processNodes = preview.components[0].elements[0].children;
    assert.equal(processNodes.length, expectedCount);
    assert.deepEqual(
      processNodes[0].children.map((child) => child.name),
      ["node_badge_icon", "node_heading", "node_description"],
    );
  }

  const low = densityUtils.applyTemplateContentDensity(layout, "Low");
  assert.deepEqual(
    low.components[0].elements[0].children.map(
      (node) => node.children[0].children[1].data,
    ),
    ["icon-2.svg", "icon-3.svg", "icon-4.svg"],
  );
});

test("resizes equivalent direct text, chart, and table children", () => {
  const repeatedGroup = (name, children) => ({
    type: "group",
    name,
    children,
  });
  const layout = {
    components: [
      {
        id: "labels",
        elements: [
          repeatedGroup(
            "labels",
            [1, 2, 3, 4].map((index) =>
              editableText(`label_${index}`, `Label ${index}`),
            ),
          ),
        ],
      },
      {
        id: "charts",
        elements: [
          repeatedGroup(
            "charts",
            [1, 2, 3, 4].map((index) => ({
              type: "chart",
              name: `chart_${index}`,
              decorative: false,
              chart_type: index % 2 === 0 ? "line" : "bar",
              categories: [`Q${index}`],
              series: [{ name: "Value", values: [index] }],
            })),
          ),
        ],
      },
      {
        id: "tables",
        elements: [
          repeatedGroup(
            "tables",
            [1, 2, 3, 4].map((index) => ({
              type: "table",
              name: `table_${index}`,
              decorative: false,
              min_columns: 1,
              max_columns: 2,
              min_rows: 1,
              max_rows: 2,
              columns: [{ runs: [{ text: "Metric" }] }],
              rows: [[{ runs: [{ text: `Row ${index}` }] }]],
            })),
          ),
        ],
      },
    ],
  };

  for (const [density, expectedCount] of [
    ["Low", 2],
    ["Medium", 3],
    ["High", 4],
  ]) {
    const preview = densityUtils.applyTemplateContentDensity(layout, density);
    assert.deepEqual(
      preview.components.map(
        (component) => component.elements[0].children.length,
      ),
      [expectedCount, expectedCount, expectedCount],
    );
  }

  const low = densityUtils.applyTemplateContentDensity(layout, "Low");
  assert.deepEqual(
    low.components[0].elements[0].children.map((child) => child.name),
    ["label_2", "label_3"],
  );
  assert.deepEqual(
    low.components[1].elements[0].children.map((child) => child.chart_type),
    ["line", "bar"],
  );
  assert.deepEqual(
    low.components[2].elements[0].children.map(
      (child) => child.rows[0][0].runs[0].text,
    ),
    ["Row 2", "Row 3"],
  );
});

test("ignores safe layout-only wrapper differences in repeated metrics", () => {
  const layout = {
    components: [
      {
        id: "metrics_panel",
        elements: [metricsWithLayoutOnlyWrapperDifferences()],
      },
    ],
  };

  for (const [density, expectedCount] of [
    ["Low", 1],
    ["Medium", 2],
    ["High", 3],
  ]) {
    const preview = densityUtils.applyTemplateContentDensity(layout, density);
    assert.equal(
      preview.components[0].elements[0].children.length,
      expectedCount,
    );
  }

  const low = densityUtils.applyTemplateContentDensity(layout, "Low");
  const selectedItem = low.components[0].elements[0].children[0];
  assert.equal(selectedItem.name, "metric_item_2");
  assert.equal(selectedItem.children[0].type, "vector");

  const editableLeafNames = [];
  const collectEditableLeafNames = (element) => {
    if (element.decorative === false && element.name) {
      editableLeafNames.push(element.name);
    }
    for (const child of element.children ?? []) {
      collectEditableLeafNames(child);
    }
  };
  collectEditableLeafNames(selectedItem);
  assert.deepEqual(editableLeafNames, [
    "metric_value",
    "metric_heading",
    "metric_description",
  ]);
});

test("applies inferred half-to-full limits to repeated top-level groups", () => {
  const layout = {
    components: [
      {
        id: "metrics",
        elements: [1, 2, 3, 4].map((index) => repeatedCard(index)),
      },
    ],
  };

  const low = densityUtils.applyTemplateContentDensity(layout, "Low");
  assert.deepEqual(
    low.components[0].elements.map((element) => element.name),
    ["card_2", "card_3"],
  );
});

test("does not resize structurally incompatible flex children", () => {
  const layout = {
    components: [
      {
        id: "mixed",
        elements: [
          {
            type: "flex",
            name: "mixed",
            min_children: 1,
            max_children: 2,
            children: [
              repeatedCard(1, "title_1"),
              repeatedCard(2, "description_2"),
            ],
          },
        ],
      },
    ],
  };

  const low = densityUtils.applyTemplateContentDensity(layout, "Low");
  assert.equal(low.components[0].elements[0].children.length, 2);
});

test("expands a one-item schema array and normalizes repeated names", () => {
  const layout = {
    components: [
      {
        id: "cards",
        elements: [
          {
            type: "grid",
            name: "cards",
            min_children: 1,
            max_children: 3,
            children: [repeatedCard(1)],
          },
        ],
      },
    ],
  };

  const high = densityUtils.applyTemplateContentDensity(layout, "High");
  const children = high.components[0].elements[0].children;
  assert.deepEqual(
    children.map((child) => child.name),
    ["card_1", "card_2", "card_3"],
  );
  assert.deepEqual(
    children.map((child) => child.children[0].name),
    ["title_1", "title_2", "title_3"],
  );
});

test("recognizes repeatable non-text arrays as density targets", () => {
  const layout = {
    components: [
      {
        id: "logos",
        elements: [
          {
            type: "flex",
            name: "logos",
            min_children: 1,
            max_children: 3,
            children: [
              {
                type: "image",
                name: "logo_1",
                decorative: false,
                is_icon: false,
                data: "logo.png",
              },
            ],
          },
        ],
      },
    ],
  };

  assert.equal(densityUtils.hasLayoutContentDensityTargets(layout), true);
  const high = densityUtils.applyTemplateContentDensity(layout, "High");
  assert.equal(high.components[0].elements[0].children.length, 3);
});
