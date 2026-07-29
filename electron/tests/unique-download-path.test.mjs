import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { after, before } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const electronRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const require = createRequire(path.join(electronRoot, "package.json"));

let tempDirectory;
let uniqueDownloadPath;

before(async () => {
  tempDirectory = await mkdtemp(
    path.join(os.tmpdir(), "presenton-unique-download-"),
  );
  const outfile = path.join(tempDirectory, "unique-download-path.mjs");

  let build;
  try {
    ({ build } = require("esbuild"));
  } catch {
    const nextEsbuild = path.resolve(
      electronRoot,
      "../servers/nextjs/node_modules/esbuild",
    );
    ({ build } = createRequire(path.join(nextEsbuild, "package.json"))(
      nextEsbuild,
    ));
  }

  await build({
    entryPoints: [
      path.join(electronRoot, "app/utils/unique-download-path.ts"),
    ],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile,
    logLevel: "silent",
  });

  uniqueDownloadPath = await import(pathToFileURL(outfile).href);
});

after(async () => {
  if (tempDirectory) {
    await rm(tempDirectory, { recursive: true, force: true });
  }
});

test("builds numbered candidates for collisions", () => {
  assert.equal(
    uniqueDownloadPath.buildCandidateDownloadPath("/tmp", "deck.pdf", 0),
    path.join("/tmp", "deck.pdf"),
  );
  assert.equal(
    uniqueDownloadPath.buildCandidateDownloadPath("/tmp", "deck.pdf", 1),
    path.join("/tmp", "deck (1).pdf"),
  );
  assert.equal(
    uniqueDownloadPath.buildCandidateDownloadPath("/tmp", "deck.pdf", 2),
    path.join("/tmp", "deck (2).pdf"),
  );
});

test("moves export beside an existing same-named file without overwrite", async () => {
  const downloads = path.join(tempDirectory, "Downloads");
  const existing = path.join(downloads, "Quarterly Review.pdf");
  const source = path.join(tempDirectory, "export-output.pdf");

  await writeFile(source, "new-export-bytes", "utf8");
  await mkdir(downloads, { recursive: true });
  await writeFile(existing, "original-bytes", "utf8");

  const destination = await uniqueDownloadPath.moveExportToDownloads(
    source,
    downloads,
    "Quarterly Review.pdf",
  );

  assert.equal(destination, path.join(downloads, "Quarterly Review (1).pdf"));
  assert.equal(await readFile(existing, "utf8"), "original-bytes");
  assert.equal(await readFile(destination, "utf8"), "new-export-bytes");
});

test("uses the original name when the destination is free", async () => {
  const downloads = path.join(tempDirectory, "Downloads-free");
  const source = path.join(tempDirectory, "fresh-export.pdf");
  await writeFile(source, "fresh", "utf8");

  const destination = await uniqueDownloadPath.moveExportToDownloads(
    source,
    downloads,
    "fresh.pdf",
  );

  assert.equal(destination, path.join(downloads, "fresh.pdf"));
  assert.equal(await readFile(destination, "utf8"), "fresh");
});
