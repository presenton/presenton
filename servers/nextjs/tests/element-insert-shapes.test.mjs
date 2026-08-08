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

async function importInsertElements() {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "shape-inserts-"));
  const outfile = path.join(tempDirectory, "insert-elements.mjs");
  await build({
    absWorkingDir: projectRoot,
    bundle: true,
    entryPoints: ["components/slide-editor/insert/insert-elements.ts"],
    format: "esm",
    outfile,
    platform: "node",
    tsconfig: path.join(projectRoot, "tsconfig.json"),
  });
  return import(pathToFileURL(outfile).href);
}

test("every palette item creates one editable vector", async () => {
  const { ELEMENT_INSERT_GROUPS, createElementInsertElements } =
    await importInsertElements();
  const items = ELEMENT_INSERT_GROUPS.flatMap((group) => group.items);

  assert.ok(items.length >= 35, "the expanded palette should stay comprehensive");
  assert.equal(
    new Set(items.map((item) => item.id)).size,
    items.length,
    "shape ids must be unique",
  );
  const strokeOnlyIds = new Set(
    ELEMENT_INSERT_GROUPS.find((group) => group.label === "Lines & Arrows")
      ?.items.filter(
        (item) =>
          item.id === "vector-line" || item.id.startsWith("vector-line-arrow"),
      )
      .map((item) => item.id) ?? [],
  );

  for (const item of items) {
    const elements = createElementInsertElements(item.id);
    assert.equal(elements.length, 1, `${item.id} should create one element`);

    const [element] = elements;
    assert.equal(element.type, "vector", `${item.id} should remain editable`);
    if (strokeOnlyIds.has(item.id)) {
      assert.equal(element.closed, false, `${item.id} should be an open vector`);
      assert.equal(element.fill, undefined, `${item.id} should be stroke-only`);
      assert.ok(element.stroke?.color, `${item.id} should have a stroke`);
      assert.ok(element.points.length >= 2, `${item.id} needs a vector path`);
    } else {
      assert.equal(element.closed, true, `${item.id} should be a closed shape`);
      assert.ok(element.fill?.color, `${item.id} should be fillable`);
      assert.ok(element.points.length >= 3, `${item.id} needs a closed outline`);
    }
    assert.ok(
      element.points.every(
        (point) => Number.isFinite(point.x) && Number.isFinite(point.y),
      ),
      `${item.id} should contain finite coordinates`,
    );
    if (element.corner_radii) {
      assert.equal(
        element.corner_radii.length,
        element.points.length,
        `${item.id} corner radii should match its points`,
      );
    }
  }
});

test("block arrow palette items are solid shapes", async () => {
  const { ELEMENT_INSERT_GROUPS, createElementInsertElements } =
    await importInsertElements();
  const arrowGroup = ELEMENT_INSERT_GROUPS.find(
    (group) => group.label === "Block Arrows",
  );

  assert.ok(arrowGroup);
  assert.ok(arrowGroup.items.length >= 8);
  for (const item of arrowGroup.items) {
    const [arrow] = createElementInsertElements(item.id);
    assert.equal(arrow.type, "vector");
    assert.equal(arrow.closed, true);
    assert.ok(arrow.fill?.color);
    assert.ok(arrow.points.length >= 3);
  }
});

test("line and arrowhead presets contain no arrow shafts", async () => {
  const { ELEMENT_INSERT_GROUPS, createElementInsertElements } =
    await importInsertElements();
  const lineGroup = ELEMENT_INSERT_GROUPS.find(
    (group) => group.label === "Lines & Arrows",
  );

  assert.deepEqual(
    lineGroup?.items.map((item) => item.id),
    [
      "vector-line",
      "vector-line-arrow",
      "vector-line-arrow-left",
      "vector-line-arrow-up",
      "vector-line-arrow-down",
      "vector-arrowhead-filled-right",
      "vector-arrowhead-filled-left",
      "vector-arrowhead-filled-up",
      "vector-arrowhead-filled-down",
    ],
  );
  for (const item of lineGroup.items.filter(
    (item) =>
      item.id === "vector-line" || item.id.startsWith("vector-line-arrow"),
  )) {
    const [element] = createElementInsertElements(item.id);
    assert.equal(element.type, "vector");
    assert.equal(element.closed, false);
    assert.equal(element.fill, undefined);
    assert.ok(element.stroke?.color);
  }

  for (const item of lineGroup.items.filter((item) =>
    item.id.startsWith("vector-arrowhead-filled"),
  )) {
    const [element] = createElementInsertElements(item.id);
    assert.equal(element.type, "vector");
    assert.equal(element.closed, true);
    assert.ok(element.fill?.color);
    assert.equal(element.points.length, 3);
  }

  const [line] = createElementInsertElements("vector-line");
  const [arrow] = createElementInsertElements("vector-line-arrow");
  assert.equal(line.points.length, 2);
  assert.deepEqual(arrow.points, [
    { x: 246, y: 154 },
    { x: 430, y: 248 },
    { x: 246, y: 342 },
  ]);
});
