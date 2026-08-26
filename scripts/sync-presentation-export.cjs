/**
 * Install the architecture-independent @presenton/export-core open-source
 * release into repo-root `presentation-export/`.
 *
 * CLI: --force       reinstall even when the pinned package is already valid
 *      --check-only  verify the installed package and runner
 *      --allow-version-override  honor EXPORT_RUNTIME_VERSION
 */
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const { execFileSync } = require("child_process");

const repoRoot = path.join(__dirname, "..");
const targetRoot = path.join(repoRoot, "presentation-export");
const targetRunner = path.join(targetRoot, "runner.mjs");
const installedPackageJson = path.join(
  targetRoot,
  "node_modules",
  "@presenton",
  "export-core",
  "package.json",
);
const sourceRunner = path.join(repoRoot, "scripts", "run-presentation-export.mjs");
const versionManifestPath = path.join(targetRoot, "presenton-export-version.json");
const packageJsonFile = path.join(repoRoot, "package.json");
const cacheDir = path.join(repoRoot, ".cache", "presentation-export");
const exportRepoBase =
  "https://github.com/presenton/presenton-export/releases/download";

const cliArgs = new Set(process.argv.slice(2));
const forceInstall = cliArgs.has("--force");
const checkOnly = cliArgs.has("--check-only");
const allowVersionOverride = cliArgs.has("--allow-version-override");

function normalizeVersion(version) {
  const value = String(version || "").trim();
  return value.startsWith("v") ? value.slice(1) : value;
}

function readPinnedVersion() {
  const raw = JSON.parse(fs.readFileSync(packageJsonFile, "utf8"));
  const version = String(raw.presentationExportVersion || "").trim();
  if (!version) {
    throw new Error('package.json must set "presentationExportVersion".');
  }
  return version;
}

async function getTargetVersion() {
  const override = String(process.env.EXPORT_RUNTIME_VERSION || "").trim();
  const requested = allowVersionOverride && override ? override : readPinnedVersion();
  return requested === "latest" ? resolveLatestTag() : requested;
}

function assetNameForVersion(version) {
  return `presenton-export-core-opensource-${normalizeVersion(version)}.tgz`;
}

function requestClient(url) {
  return url.startsWith("https:") ? https : http;
}

function requestJson(url, redirects = 5) {
  return new Promise((resolve, reject) => {
    const req = requestClient(url).get(
      url,
      {
        headers: {
          "User-Agent": "presenton-presentation-export-sync",
          Accept: "application/vnd.github+json",
        },
      },
      (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          if (redirects <= 0) return reject(new Error(`Too many redirects: ${url}`));
          requestJson(res.headers.location, redirects - 1).then(resolve, reject);
          return;
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`Failed to fetch ${url}. HTTP ${res.statusCode}`));
          return;
        }
        let payload = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (payload += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(payload));
          } catch (error) {
            reject(new Error(`Invalid JSON from ${url}: ${error.message}`));
          }
        });
      },
    );
    req.on("error", reject);
  });
}

async function resolveLatestTag() {
  const latest = await requestJson(
    "https://api.github.com/repos/presenton/presenton-export/releases/latest",
  );
  if (!latest.tag_name) throw new Error("Latest export release has no tag_name.");
  return latest.tag_name;
}

function downloadFile(url, outputPath, redirects = 5) {
  return new Promise((resolve, reject) => {
    const req = requestClient(url).get(
      url,
      {
        headers: {
          "User-Agent": "presenton-presentation-export-sync",
          Accept: "application/octet-stream",
        },
      },
      (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          if (redirects <= 0) return reject(new Error(`Too many redirects: ${url}`));
          downloadFile(res.headers.location, outputPath, redirects - 1).then(resolve, reject);
          return;
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`Failed to download ${url}. HTTP ${res.statusCode}`));
          return;
        }
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        const stream = fs.createWriteStream(outputPath);
        res.pipe(stream);
        stream.on("finish", () => stream.close(resolve));
        stream.on("error", reject);
      },
    );
    req.on("error", reject);
  });
}

function validateExistingRuntime(expectedVersion) {
  if (!fs.existsSync(targetRunner)) {
    return { ok: false, reason: `Missing export runner: ${targetRunner}` };
  }
  if (!fs.existsSync(installedPackageJson)) {
    return { ok: false, reason: `Missing export package: ${installedPackageJson}` };
  }
  if (!fs.existsSync(versionManifestPath)) {
    return { ok: false, reason: `Missing export version manifest: ${versionManifestPath}` };
  }
  try {
    const installedPackage = JSON.parse(fs.readFileSync(installedPackageJson, "utf8"));
    const manifest = JSON.parse(fs.readFileSync(versionManifestPath, "utf8"));
    if (installedPackage.version !== normalizeVersion(expectedVersion)) {
      return {
        ok: false,
        reason: `Expected export-core ${normalizeVersion(expectedVersion)}, found ${installedPackage.version}.`,
      };
    }
    if (manifest.package !== assetNameForVersion(expectedVersion)) {
      return {
        ok: false,
        reason: `Expected ${assetNameForVersion(expectedVersion)}, found ${manifest.package || "an unknown package"}.`,
      };
    }
    return { ok: true, packageVersion: installedPackage.version };
  } catch (error) {
    return { ok: false, reason: `Invalid installed export package: ${error.message}` };
  }
}

function installRuntime(version, archivePath) {
  fs.rmSync(targetRoot, { recursive: true, force: true });
  fs.mkdirSync(targetRoot, { recursive: true });
  fs.copyFileSync(sourceRunner, targetRunner);
  fs.writeFileSync(
    path.join(targetRoot, "package.json"),
    `${JSON.stringify(
      {
        private: true,
        type: "module",
        dependencies: { "@presenton/export-core": `file:${archivePath}` },
      },
      null,
      2,
    )}\n`,
  );
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  execFileSync(
    npm,
    [
      "install",
      "--omit=dev",
      "--ignore-scripts",
      "--no-package-lock",
      "--no-fund",
      "--no-audit",
      "--cache",
      path.join(cacheDir, "npm"),
    ],
    { cwd: targetRoot, stdio: "inherit" },
  );
  fs.writeFileSync(
    versionManifestPath,
    `${JSON.stringify(
      { version, package: assetNameForVersion(version) },
      null,
      2,
    )}\n`,
  );
}

async function main() {
  const version = await getTargetVersion();
  const existing = validateExistingRuntime(version);
  if (checkOnly) {
    if (!existing.ok) throw new Error(existing.reason);
    console.log(`[presentation-export] OK (${existing.packageVersion})`);
    return;
  }
  if (existing.ok && !forceInstall) {
    console.log(`[presentation-export] Using export-core ${existing.packageVersion}`);
    return;
  }

  const assetName = assetNameForVersion(version);
  const archivePath = path.join(cacheDir, assetName);
  const downloadUrl = `${exportRepoBase}/${version}/${assetName}`;
  fs.mkdirSync(cacheDir, { recursive: true });
  const localArchive = String(process.env.EXPORT_CORE_ARCHIVE || "").trim();
  if (localArchive) {
    if (!fs.existsSync(localArchive)) {
      throw new Error(`EXPORT_CORE_ARCHIVE does not exist: ${localArchive}`);
    }
    console.log(`[presentation-export] Using local package ${localArchive}`);
    fs.copyFileSync(localArchive, archivePath);
  } else {
    console.log(`[presentation-export] Downloading ${downloadUrl}`);
    await downloadFile(downloadUrl, archivePath);
  }
  installRuntime(version, archivePath);

  const installed = validateExistingRuntime(version);
  if (!installed.ok) throw new Error(installed.reason);
  console.log(`[presentation-export] Installed export-core ${installed.packageVersion}`);
}

main().catch((error) => {
  console.error(`[presentation-export] ${error.message}`);
  process.exit(1);
});
