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
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "math-inserts-"));
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

test("creates distinct editable LaTeX examples from the insert palette", async () => {
  const { createTextInsertElements } = await importInsertElements();
  const examples = {
    equation: String.raw`E = mc^2`,
    "equation-quadratic": String.raw`x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}`,
    "equation-summation": String.raw`\sum_{i=1}^{n} i = \frac{n(n+1)}{2}`,
    "equation-integral": String.raw`\int_{-\infty}^{\infty} e^{-x^2}\,dx = \sqrt{\pi}`,
    "equation-matrix": String.raw`A = \begin{bmatrix} a & b \\ c & d \end{bmatrix}`,
  };

  for (const [id, latex] of Object.entries(examples)) {
    const [element] = createTextInsertElements(id);
    assert.equal(element.type, "math");
    assert.equal(element.latex, latex);
    assert.equal(element.display_mode, true);
    assert.equal(element.decorative, false);
  }
});
