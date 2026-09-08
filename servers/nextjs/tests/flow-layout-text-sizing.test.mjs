import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { build } from "esbuild";

let flowLayout;
let model;
let temporaryDirectory;

test.before(async () => {
  temporaryDirectory = await mkdtemp(
    path.join(tmpdir(), "presenton-flow-layout-"),
  );
  const outputFile = path.join(temporaryDirectory, "flow-layout.mjs");
  const modelOutputFile = path.join(temporaryDirectory, "model.mjs");

  await build({
    entryPoints: [
      path.resolve("components/slide-editor/layout/flowLayout.ts"),
    ],
    outfile: outputFile,
    bundle: true,
    platform: "node",
    format: "esm",
    tsconfig: path.resolve("tsconfig.json"),
    logLevel: "silent",
  });
  await build({
    entryPoints: [path.resolve("components/slide-editor/model/model.ts")],
    outfile: modelOutputFile,
    bundle: true,
    platform: "node",
    format: "esm",
    tsconfig: path.resolve("tsconfig.json"),
    logLevel: "silent",
  });

  globalThis.document = {
    compatMode: "CSS1Compat",
    createElement() {
      return {
        getContext() {
          return {
            font: "",
            measureText() {
              return { width: 640 };
            },
          };
        },
      };
    },
  };

  flowLayout = await import(
    `${pathToFileURL(outputFile).href}?cache=${Date.now()}`
  );
  model = await import(
    `${pathToFileURL(modelOutputFile).href}?cache=${Date.now()}`
  );
});

test.after(async () => {
  delete globalThis.document;
  if (temporaryDirectory) {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test("sizes auto-width flex text from the rendered font measurement", () => {
  const child = agendaHeading();

  const width = flowLayout.flexBasis(child, "row", 77.5, {
    elementBox: () => ({ x: 0, y: 0, width: 1, height: 1 }),
    elementSize: () => ({ width: 1, height: 1 }),
    isManualPositioned: () => false,
  });

  assert.equal(width, measuredAgendaWidth());
});

test("includes measured auto-width text in intrinsic group bounds", () => {
  const size = model.elementSize({
    type: "group",
    children: [agendaHeading()],
  });

  assert.equal(size.width, measuredAgendaWidth());
});

function agendaHeading() {
  return {
    type: "text",
    font: {
      family: "Akzidenz-Grotesk Heavy",
      size: 69.16,
      bold: true,
      line_height: 0.86,
      letter_spacing: -1.36,
    },
    runs: [{ text: "TARGET AUDIENCE" }],
  };
}

function measuredAgendaWidth() {
  return 640 - 1.36 * ("TARGET AUDIENCE".length - 1);
}
