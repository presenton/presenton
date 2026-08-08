import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { convertPresentationTemplate } from "./convert-presentation-template.mjs";

function component(id, data, extra = {}) {
  return {
    id,
    description: `${id} description`,
    position: { x: 0, y: 0 },
    size: { width: 100, height: 100 },
    elements: [
      {
        type: "image",
        data,
        decorative: true,
        is_icon: false,
      },
    ],
    ...extra,
  };
}

test("converts presentation UI edits into bundled layouts and merged variants", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "presentation-template-converter-"));
  const appData = path.join(root, "app_data");
  const inputDirectory = path.join(root, "templates", "dynamic");
  const input = path.join(inputDirectory, "presentation.json");
  const output = path.join(inputDirectory, "template.json");
  await mkdir(path.join(appData, "images"), { recursive: true });
  await mkdir(path.join(appData, "fonts"), { recursive: true });
  await mkdir(inputDirectory, { recursive: true });
  await writeFile(path.join(appData, "images", "updated.png"), "updated");
  await writeFile(path.join(appData, "images", "untouched.png"), "untouched");
  await writeFile(path.join(appData, "images", "added.png"), "added");
  await writeFile(path.join(appData, "images", "thumbnail.png"), "thumbnail");
  await writeFile(path.join(appData, "fonts", "custom.ttf"), "font");

  const originalHero = component("hero", "/app_data/images/original.png");
  const originalRemoved = component("removed", "/app_data/images/removed.png");
  const untouched = component("untouched", "/app_data/images/untouched.png");
  const updatedHero = component("hero", "/app_data/images/updated.png", {
    position: { x: 25, y: 30 },
  });
  const added = component("added", "/app_data/images/added.png");

  await writeFile(
    input,
    JSON.stringify({
      id: "presentation-id",
      layout: {
        layouts: [
          {
            id: "edited-layout",
            description: "Original layout",
            components: [originalHero, originalRemoved],
          },
          {
            id: "unused-layout",
            description: "Unused layout",
            components: [untouched],
          },
        ],
      },
      merged_components: {
        components: [
          {
            id: "hero-group",
            description: "Hero variants",
            variants: [originalHero, untouched],
          },
          {
            id: "removed",
            description: "Removed variants",
            variants: [originalRemoved],
          },
        ],
      },
      slides: [
        {
          layout: "edited-layout",
          ui: {
            id: "edited-layout",
            description: "Updated layout",
            components: [updatedHero, added],
          },
        },
      ],
      fonts: { Custom: "/app_data/fonts/custom.ttf" },
      thumbnail: "/app_data/images/thumbnail.png",
    }),
  );

  const result = await convertPresentationTemplate({
    input,
    output,
    appData,
    name: "Dynamic",
  });
  const converted = JSON.parse(await readFile(output, "utf8"));

  assert.deepEqual(Object.keys(converted), [
    "id",
    "name",
    "description",
    "thumbnail",
    "merged_components",
    "layouts",
    "fonts",
  ]);
  assert.equal(converted.name, "Dynamic");
  assert.equal(converted.layouts.length, 2);
  assert.equal(converted.layouts[0].description, "Updated layout");
  assert.equal(converted.layouts[0].components[0].position.x, 25);
  assert.equal(converted.layouts[0].components[0].elements[0].data, "static/updated.png");
  assert.equal(converted.layouts[1].components[0].elements[0].data, "static/untouched.png");

  const variants = converted.merged_components.flatMap((group) => group.variants);
  assert.equal(variants.some((variant) => variant.id === "removed"), false);
  assert.equal(
    variants.find((variant) => variant.id === "hero").elements[0].data,
    "static/updated.png",
  );
  assert.equal(
    variants.find((variant) => variant.id === "added").elements[0].data,
    "static/added.png",
  );
  assert.equal(converted.thumbnail, "static/thumbnail.png");
  assert.equal(converted.fonts.Custom, "static/custom.ttf");
  assert.equal(result.updatedLayoutCount, 1);
  assert.equal(result.updatedVariantCount, 1);
  assert.equal(result.removedVariantCount, 1);
  assert.equal(result.addedVariantCount, 1);
  assert.equal(result.assetCount, 5);
});

test("fails when an original layout component cannot be mapped to merged_components", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "presentation-template-invalid-"));
  const input = path.join(root, "presentation.json");
  const output = path.join(root, "template.json");
  const original = component("missing", "/static/images/replaceable_template_image.png");
  await writeFile(
    input,
    JSON.stringify({
      layout: { layouts: [{ id: "layout", components: [original] }] },
      merged_components: { components: [] },
      slides: [{ layout: "layout", ui: { id: "layout", components: [original] } }],
    }),
  );

  await assert.rejects(
    convertPresentationTemplate({ input, output, appData: path.join(root, "app_data") }),
    /was not found in merged_components/,
  );
  await assert.rejects(readFile(output), /ENOENT/);
});
