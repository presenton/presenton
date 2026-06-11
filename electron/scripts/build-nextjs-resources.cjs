const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const electronRoot = path.join(__dirname, "..");
const nextjsDir = path.join(electronRoot, "..", "servers", "nextjs");
const outDir = path.join(electronRoot, "resources", "nextjs");
const nextBuildDir = path.join(nextjsDir, ".next-build");
const standaloneDir = path.join(nextBuildDir, "standalone");

function rm(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

function cpDir(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
}

console.log("Running Next.js production build (BUILD_TARGET=electron)…");

rm(outDir);
rm(nextBuildDir);

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const build = spawnSync(npmCmd, ["run", "build"], {
  cwd: nextjsDir,
  env: { ...process.env, BUILD_TARGET: "electron" },
  stdio: "inherit",
  // Windows: cmd is required to run npm.cmd; without shell, spawnSync can throw EINVAL.
  shell: process.platform === "win32",
});

if (build.error) {
  console.error(build.error);
  process.exit(1);
}
if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

if (!fs.existsSync(standaloneDir)) {
  console.error("Expected standalone output at:", standaloneDir);
  process.exit(1);
}

fs.mkdirSync(path.join(outDir, ".next-build"), { recursive: true });

for (const name of fs.readdirSync(standaloneDir)) {
  fs.cpSync(
    path.join(standaloneDir, name),
    path.join(outDir, name),
    { recursive: true }
  );
}

// Next.js 16 standalone traces the app under servers/nextjs/; the server process
// runs from that directory, so static assets and public files must live beside
// server.js — not only at the bundle root (older Next versions used a flatter layout).
const nestedStandaloneDir = path.join(outDir, "servers", "nextjs");

const staticSrc = path.join(nextBuildDir, "static");
const staticDestinations = [
  path.join(outDir, ".next-build", "static"),
  path.join(nestedStandaloneDir, ".next-build", "static"),
];
if (fs.existsSync(staticSrc)) {
  for (const staticDest of staticDestinations) {
    cpDir(staticSrc, staticDest);
  }
} else {
  console.error("Expected Next.js static output at:", staticSrc);
  process.exit(1);
}

const publicDir = path.join(nextjsDir, "public");
if (fs.existsSync(publicDir)) {
  cpDir(publicDir, path.join(outDir, "public"));
  if (fs.existsSync(nestedStandaloneDir)) {
    cpDir(publicDir, path.join(nestedStandaloneDir, "public"));
  }
}

const templatesSrc = path.join(nextjsDir, "app", "presentation-templates");
const templatesDest = path.join(outDir, "presentation-templates");
if (fs.existsSync(templatesSrc)) {
  cpDir(templatesSrc, templatesDest);
}

console.log("Next.js bundle copied to:", outDir);
