import assert from "node:assert/strict";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const require = createRequire(import.meta.url);
const { clearDirectoryContents } = require("./sync-presentation-export.cjs");

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(repoRoot, relativePath), "utf8"));
}

test("application versions stay aligned", async () => {
  const [rootPackage, rootLock] = await Promise.all([
    readJson("package.json"),
    readJson("package-lock.json"),
  ]);

  assert.equal(rootLock.version, rootPackage.version);
  assert.equal(rootLock.packages[""].version, rootPackage.version);
});

test("Docker uses the pinned presentation export", async () => {
  const [dockerfile, dockerfileDev, dockerCompose] = await Promise.all([
    readFile(path.join(repoRoot, "Dockerfile"), "utf8"),
    readFile(path.join(repoRoot, "Dockerfile.dev"), "utf8"),
    readFile(path.join(repoRoot, "docker-compose.yml"), "utf8"),
  ]);

  assert.match(dockerfile, /COPY package\.json \/app\//);
  assert.match(
    dockerfile,
    /sync-presentation-export\.cjs --force/,
  );
  assert.match(dockerfileDev, /COPY package\.json package-lock\.json \/app\//);
  assert.match(
    dockerfileDev,
    /sync-presentation-export\.cjs --force/,
  );
  assert.equal(
    (
      dockerCompose.match(
        /presenton_presentation_export:\/app\/presentation-export/g,
      ) || []
    ).length,
    2,
  );
  assert.match(
    dockerCompose,
    /\nvolumes:\n(?:  .+\n)*  presenton_presentation_export:\n/,
  );
});

test("presentation export sync preserves a mounted runtime root", async (t) => {
  const runtimeRoot = await mkdtemp(
    path.join(os.tmpdir(), "presenton-export-runtime-"),
  );
  t.after(() => rm(runtimeRoot, { recursive: true, force: true }));
  await mkdir(path.join(runtimeRoot, "node_modules", "stale"), {
    recursive: true,
  });
  await writeFile(path.join(runtimeRoot, "runner.mjs"), "stale");
  await writeFile(
    path.join(runtimeRoot, "node_modules", "stale", "package.json"),
    "{}",
  );

  clearDirectoryContents(runtimeRoot);

  await access(runtimeRoot);
  assert.deepEqual(await readdir(runtimeRoot), []);
});
