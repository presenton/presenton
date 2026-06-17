#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const repoRoot = path.resolve(__dirname, "..");
const appDistDir = path.join(repoRoot, "app_dist");

const rootBuildFiles = ["build.js"].map((file) => path.join(repoRoot, file));

const scriptsDir = path.join(repoRoot, "scripts");
const scriptBuildFiles = walkFiles(
  scriptsDir,
  (file) => file.endsWith(".cjs") || file.endsWith(".js"),
);

function walkFiles(dir, predicate, results = []) {
  if (!fs.existsSync(dir)) {
    return results;
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, predicate, results);
    } else if (predicate(fullPath)) {
      results.push(fullPath);
    }
  }

  return results;
}

const generatedMainFiles = walkFiles(appDistDir, (file) => file.endsWith(".js"));

if (generatedMainFiles.length === 0) {
  console.error(
    "No generated Electron main files found in app_dist. Run `npm run build:ts` first.",
  );
  process.exit(1);
}

const files = [
  ...generatedMainFiles,
  ...rootBuildFiles.filter((file) => fs.existsSync(file)),
  ...scriptBuildFiles,
];

const program = ts.createProgram(files, {
  allowJs: true,
  checkJs: true,
  noEmit: true,
  skipLibCheck: true,
  strict: false,
  noImplicitAny: false,
  module: ts.ModuleKind.CommonJS,
  moduleResolution: ts.ModuleResolutionKind.Node10,
  target: ts.ScriptTarget.ES2020,
});

const undefinedNameDiagnostics = ts
  .getPreEmitDiagnostics(program)
  .filter((diagnostic) => diagnostic.code === 2304);

if (undefinedNameDiagnostics.length > 0) {
  const host = {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => repoRoot,
    getNewLine: () => "\n",
  };

  console.error(
    ts.formatDiagnosticsWithColorAndContext(undefinedNameDiagnostics, host),
  );
  process.exit(1);
}

console.log(`No undefined names found in ${files.length} Electron main JS files.`);
