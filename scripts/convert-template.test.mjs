import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { convertTemplate } from "./convert-template.mjs";

test("converts an exported template to the bundled default-template shape", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "template-converter-"));
  const appData = path.join(root, "app_data");
  const inputDirectory = path.join(root, "templates", "modern");
  const input = path.join(inputDirectory, "source.json");
  const output = path.join(inputDirectory, "template.json");
  const decorativeImage = path.join(
    appData,
    "pptx-to-json",
    "session",
    "images",
    "decoration.png",
  );
  const preview = path.join(appData, "uploads", "template-previews", "id", "slide_1.png");
  const staticDirectory = path.join(inputDirectory, "static");
  await mkdir(path.dirname(decorativeImage), { recursive: true });
  await mkdir(path.dirname(preview), { recursive: true });
  await mkdir(staticDirectory, { recursive: true });
  await writeFile(decorativeImage, "decorative image bytes");
  await writeFile(
    path.join(path.dirname(decorativeImage), "decorative-icon.svg"),
    "decorative icon bytes",
  );
  await writeFile(preview, "preview bytes");
  await writeFile(path.join(staticDirectory, "stale.png"), "stale bytes");
  await writeFile(
    input,
    JSON.stringify({
      id: "modern",
      name: "Modern",
      description: null,
      created_at: "remove only this top-level key",
      merged_components: {
        components: [{ id: "merged", metadata: { created_at: "keep nested" } }],
      },
      layouts: {
        layouts: [
          {
            id: "cover",
            custom_key: "keep me",
            components: [
              {
                elements: [
                  {
                    type: "image",
                    data: "/app_data/pptx-to-json/session/images/editable.png",
                    decorative: false,
                    is_icon: false,
                    custom_image_key: true,
                  },
                  {
                    type: "image",
                    data: "/app_data/pptx-to-json/session/images/decorative-icon.svg",
                    decorative: true,
                    is_icon: true,
                  },
                  {
                    type: "image",
                    data: "/app_data/pptx-to-json/session/images/editable-icon.svg",
                    decorative: false,
                    is_icon: true,
                  },
                  {
                    type: "image",
                    data: "/app_data/pptx-to-json/session/images/decoration.png",
                    decorative: true,
                    is_icon: false,
                  },
                ],
              },
            ],
          },
        ],
      },
      assets: {
        fonts: { Montserrat: "https://fonts.example/montserrat.css" },
        images: ["/app_data/unused.png"],
        slide_image_urls: [
          "http://127.0.0.1:8000/app_data/uploads/template-previews/id/slide_1.png",
        ],
      },
    }),
  );

  const result = await convertTemplate({ input, output, appData });
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
  assert.equal(converted.description, "");
  assert.equal(converted.thumbnail, "static/thumbnail.png");
  assert.equal(converted.merged_components[0].metadata.created_at, "keep nested");
  assert.equal(converted.layouts[0].custom_key, "keep me");
  assert.equal(converted.layouts[0].components[0].elements[0].custom_image_key, true);
  assert.equal(
    converted.layouts[0].components[0].elements[0].data,
    "/static/images/replaceable_template_image.png",
  );
  assert.equal(
    converted.layouts[0].components[0].elements[1].data,
    "static/decorative-icon.svg",
  );
  assert.equal(
    converted.layouts[0].components[0].elements[2].data,
    "/static/icons/placeholder.svg",
  );
  assert.equal(
    converted.layouts[0].components[0].elements[3].data,
    "static/decoration.png",
  );
  assert.deepEqual(converted.fonts, {
    Montserrat: "https://fonts.example/montserrat.css",
  });
  assert.equal(
    await readFile(path.join(staticDirectory, "decoration.png"), "utf8"),
    "decorative image bytes",
  );
  assert.equal(
    await readFile(path.join(staticDirectory, "decorative-icon.svg"), "utf8"),
    "decorative icon bytes",
  );
  assert.equal(
    await readFile(path.join(staticDirectory, "thumbnail.png"), "utf8"),
    "preview bytes",
  );
  await assert.rejects(readFile(path.join(staticDirectory, "stale.png")), /ENOENT/);
  await assert.rejects(
    readFile(path.join(staticDirectory, "icons", "placeholder.svg")),
    /ENOENT/,
  );
  assert.equal(result.assetCount, 3);
});

test("fails before writing output when a retained asset is missing", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "template-converter-missing-"));
  const input = path.join(root, "source.json");
  const output = path.join(root, "output", "template.json");
  await writeFile(
    input,
    JSON.stringify({
      id: "missing",
      name: "Missing",
      layouts: [
        {
          components: [
            {
              elements: [
                {
                  type: "image",
                  data: "/app_data/no.png",
                  decorative: true,
                  is_icon: false,
                },
              ],
            },
          ],
        },
      ],
      merged_components: [],
      assets: { fonts: {} },
    }),
  );

  await assert.rejects(
    convertTemplate({ input, output, appData: path.join(root, "app_data") }),
    /Referenced asset does not exist/,
  );
  await assert.rejects(readFile(output), /ENOENT/);
});
