import { parse } from "@babel/parser";
import { build } from "esbuild";
import { existsSync } from "node:fs";
import { readdir, readFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const templatesRoot = path.join(projectRoot, "app", "presentation-templates");

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
  const outDir = await mkdtemp(path.join(tmpdir(), "layout-validator-check-"));
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

async function collectTsxFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectTsxFiles(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith(".tsx")) {
      files.push(fullPath);
    }
  }
  return files;
}

function parseSyntax(source, file) {
  try {
    parse(source, {
      plugins: ["jsx", "typescript"],
      sourceType: "module",
    });
    return null;
  } catch (error) {
    const loc = error?.loc;
    const location = loc ? `${loc.line}:${loc.column + 1}` : "unknown";
    return `${file}:${location} ${error.message}`;
  }
}

function shouldRunCustomContract(source, file) {
  const relative = path.relative(projectRoot, file);
  return (
    relative.startsWith(path.join("app", "custom-templates")) &&
    source.includes("dynamicSlideLayout") &&
    source.includes("Schema") &&
    source.includes("layoutId") &&
    source.includes("layoutName") &&
    source.includes("layoutDescription")
  );
}

const { validateLayoutCode } = await loadValidator();
const files = await collectTsxFiles(templatesRoot);
const failures = [];
let contractChecked = 0;
let syntaxChecked = 0;

for (const file of files) {
  const source = await readFile(file, "utf8");
  const relative = path.relative(projectRoot, file);
  syntaxChecked += 1;

  const syntaxFailure = parseSyntax(source, relative);
  if (syntaxFailure) {
    failures.push(syntaxFailure);
    continue;
  }

  if (!shouldRunCustomContract(source, file)) {
    continue;
  }

  try {
    validateLayoutCode(source);
    contractChecked += 1;
  } catch (error) {
    const location = error.line ? `${error.line}:${error.column ?? 1}` : "unknown";
    failures.push(`${relative}:${location} ${error.message}`);
  }
}

if (failures.length > 0) {
  console.error("Layout code check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  `Layout code check passed: ${syntaxChecked} TSX files parsed, ${contractChecked} custom-compatible layouts validated.`
);
