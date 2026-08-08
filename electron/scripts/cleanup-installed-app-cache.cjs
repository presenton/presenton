#!/usr/bin/env node
const fs = require("fs");
const os = require("os");
const path = require("path");

const packageJson = require("../package.json");

const APP_DIRECTORY_NAME = packageJson.productName || "Presenton Open Source";
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const includePuppeteer = args.has("--include-puppeteer");
const verbose = args.has("--verbose");

function log(message) {
  console.log(`[cleanup:installed-app-cache] ${message}`);
}

function warn(message) {
  console.warn(`[cleanup:installed-app-cache] ${message}`);
}

function getHomeDir() {
  return os.homedir?.() || process.env.HOME || process.env.USERPROFILE || null;
}

function unique(values) {
  return [...new Set(values.filter(Boolean).map((value) => path.resolve(value)))];
}

function existingPaths(paths) {
  return paths.filter((targetPath) => {
    try {
      fs.lstatSync(targetPath);
      return true;
    } catch {
      return false;
    }
  });
}

function appDataBaseDirs() {
  const home = getHomeDir();

  if (process.platform === "win32") {
    return unique([
      process.env.APPDATA,
      process.env.LOCALAPPDATA,
      home ? path.join(home, "AppData", "Roaming") : null,
    ]);
  }

  if (process.platform === "darwin") {
    return unique([home ? path.join(home, "Library", "Application Support") : null]);
  }

  return unique([
    process.env.XDG_CONFIG_HOME,
    home ? path.join(home, ".config") : null,
  ]);
}

function tempRootDirs() {
  const home = getHomeDir();

  return unique([
    (() => {
      try {
        return os.tmpdir();
      } catch {
        return null;
      }
    })(),
    process.platform === "win32" ? process.env.LOCALAPPDATA : null,
    home ? path.join(home, ".cache") : null,
    process.platform === "win32" ? null : "/tmp",
  ]);
}

function appUserDataDirs() {
  return unique(appDataBaseDirs().map((baseDir) => path.join(baseDir, APP_DIRECTORY_NAME)));
}

function appTempDirs(userDataDirs) {
  return unique([
    ...tempRootDirs().map((tempRoot) => path.join(tempRoot, "presenton")),
    ...userDataDirs.map((userDataDir) => path.join(userDataDir, "temp")),
  ]);
}

function candidateCleanupPaths() {
  const userDataDirs = appUserDataDirs();
  const tempDirs = appTempDirs(userDataDirs);
  const home = getHomeDir();

  const targets = [
    ...userDataDirs.flatMap((userDataDir) => [
      path.join(userDataDir, "Cache"),
      path.join(userDataDir, "GPUCache"),
      path.join(userDataDir, "Crashpad"),
      path.join(userDataDir, "Code Cache"),
      path.join(userDataDir, "Recovered Chromium Cache"),
      path.join(userDataDir, "Shared Dictionary"),
      path.join(userDataDir, "chromium-cache-recovery.json"),
    ]),
    ...tempDirs.flatMap((tempDir) => [
      tempDir,
      path.join(tempDir, "Cache"),
      path.join(tempDir, "Crashpad"),
      path.join(tempDir, "GPUCache"),
    ]),
  ];

  if (includePuppeteer && home) {
    targets.push(path.join(home, ".cache", "puppeteer"));
  }

  return unique(targets);
}

function removePath(targetPath) {
  if (dryRun) {
    log(`Would remove ${targetPath}`);
    return true;
  }

  fs.rmSync(targetPath, { recursive: true, force: true });
  log(`Removed ${targetPath}`);
  return true;
}

function main() {
  if (args.has("--help") || args.has("-h")) {
    console.log(`Usage: node scripts/cleanup-installed-app-cache.cjs [--dry-run] [--include-puppeteer] [--verbose]

Removes Presenton installed-app cache leftovers without touching user settings or exports.

Options:
  --dry-run             Show what would be removed without deleting anything
  --include-puppeteer   Also remove ~/.cache/puppeteer (shared browser cache; off by default)
  --verbose             Print skipped candidate paths`);
    return;
  }

  const candidates = candidateCleanupPaths();
  const existing = existingPaths(candidates);
  const existingSet = new Set(existing);

  if (verbose) {
    for (const candidate of candidates) {
      if (!existingSet.has(candidate)) {
        log(`Skipping missing path ${candidate}`);
      }
    }
  }

  if (existing.length === 0) {
    log("No installed-app cache leftovers found.");
    return;
  }

  let removedCount = 0;
  for (const targetPath of existing) {
    try {
      if (removePath(targetPath)) {
        removedCount += 1;
      }
    } catch (error) {
      warn(`Failed to remove ${targetPath}: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    }
  }

  const action = dryRun ? "Matched" : "Removed";
  log(`${action} ${removedCount} path${removedCount === 1 ? '' : 's'}.`);
}

main();
