import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

import { build } from "esbuild";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function resolveNextAlias(importPath) {
  const basePath = path.join(projectRoot, importPath.slice(2));
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    path.join(basePath, "index.ts"),
    path.join(basePath, "index.tsx"),
    path.join(basePath, "index.js"),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? basePath;
}

async function loadValidator() {
  const outDir = await mkdtemp(path.join(tmpdir(), "layout-validator-test-"));
  const outfile = path.join(outDir, "validator.mjs");

  await build({
    entryPoints: [path.join(projectRoot, "lib", "validate-layout-code.ts")],
    outfile,
    bundle: true,
    format: "esm",
    platform: "node",
    sourcemap: false,
    logLevel: "silent",
    plugins: [
      {
        name: "next-alias",
        setup(builder) {
          builder.onResolve({ filter: /^@\// }, (args) => ({
            path: resolveNextAlias(args.path),
          }));
        },
      },
    ],
  });

  return import(pathToFileURL(outfile).href);
}

const validatorPromise = loadValidator();

const validCode = `
import * as z from "zod";

const Schema = z.object({
  title: z.string().max(40).default("Hello"),
});
const layoutId = "valid-layout";
const layoutName = "Valid Layout";
const layoutDescription = "A valid custom layout.";

const dynamicSlideLayout = ({ data }: { data: Partial<z.infer<typeof Schema>> }) => {
  return <div>{data.title}</div>;
};

export { Schema, layoutId, layoutName, layoutDescription, dynamicSlideLayout };
`;

test("accepts valid TSX layout code", async () => {
  const { validateLayoutCode } = await validatorPromise;
  const result = validateLayoutCode(validCode);

  assert.equal(result.layoutId, "valid-layout");
  assert.equal(result.layoutName, "Valid Layout");
  assert.equal(result.layoutDescription, "A valid custom layout.");
  assert.equal(result.layout_code.includes("```"), false);
  assert.equal(typeof result.schemaJSON, "object");
});

test("rejects an invalid token with location", async () => {
  const { LayoutCodeValidationError, validateLayoutCode } = await validatorPromise;

  assert.throws(
    () => validateLayoutCode(validCode.replace('"valid-layout"', "")),
    (error) =>
      error instanceof LayoutCodeValidationError &&
      error.line !== undefined &&
      /Unexpected token|Expression expected/.test(error.message)
  );
});

test("rejects an unexpected closing parenthesis", async () => {
  const { LayoutCodeValidationError, validateLayoutCode } = await validatorPromise;

  assert.throws(
    () => validateLayoutCode(`${validCode}\nconst extra = );`),
    (error) =>
      error instanceof LayoutCodeValidationError &&
      /Unexpected token|Expression expected/.test(error.message)
  );
});

test("rejects malformed JSX tags", async () => {
  const { LayoutCodeValidationError, validateLayoutCode } = await validatorPromise;

  assert.throws(
    () => validateLayoutCode(validCode.replace("<div>{data.title}</div>", "<div><span></div>")),
    (error) =>
      error instanceof LayoutCodeValidationError &&
      /Expected corresponding JSX closing tag/.test(error.message)
  );
});

test("rejects missing Schema", async () => {
  const { LayoutCodeValidationError, validateLayoutCode } = await validatorPromise;
  const code = validCode
    .replace("const Schema = z.object", "const NotSchema = z.object")
    .replace("Schema, ", "");

  assert.throws(
    () => validateLayoutCode(code),
    (error) =>
      error instanceof LayoutCodeValidationError &&
      error.message === "Layout code must declare Schema"
  );
});

test("rejects missing dynamicSlideLayout", async () => {
  const { LayoutCodeValidationError, validateLayoutCode } = await validatorPromise;
  const code = validCode.replaceAll("dynamicSlideLayout", "StaticSlideLayout");

  assert.throws(
    () => validateLayoutCode(code),
    (error) =>
      error instanceof LayoutCodeValidationError &&
      error.message === "Layout code must declare dynamicSlideLayout"
  );
});

test("rejects missing layout metadata", async () => {
  const { LayoutCodeValidationError, validateLayoutCode } = await validatorPromise;
  const code = validCode
    .replace('const layoutName = "Valid Layout";', "")
    .replace("layoutName, ", "");

  assert.throws(
    () => validateLayoutCode(code),
    (error) =>
      error instanceof LayoutCodeValidationError &&
      error.message === "Layout code must declare layoutName"
  );
});

test("strips fenced code before validation", async () => {
  const { validateLayoutCode } = await validatorPromise;
  const result = validateLayoutCode(`\`\`\`tsx\n${validCode}\n\`\`\``);

  assert.equal(result.layoutId, "valid-layout");
  assert.equal(result.layout_code.startsWith("```"), false);
  assert.equal(result.layout_code.endsWith("```"), false);
});
