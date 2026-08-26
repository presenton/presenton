import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const pdfMakerPagePath = path.resolve(
  "app/(export)/pdf-maker/PdfMakerPage.tsx",
);

test("keeps PPTX export slides aligned to the viewport origin", async () => {
  const source = await readFile(pdfMakerPagePath, "utf8");

  assert.match(source, /align-items:\s*flex-start\s*!important/);
  assert.match(
    source,
    /id="presentation-slides-wrapper"[\s\S]*?className="[^"]*\bitems-start\b[^"]*"/,
  );
  assert.doesNotMatch(source, /align-items:\s*center\s*!important/);
});
