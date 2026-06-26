/**
 * Download presenton-export release into repo-root `presentation-export/`.
 * Same release host as Electron (`electron/scripts/sync-export-runtime.cjs`); Docker uses this at build time.
 *
 * Version resolution (first match):
 *   1. EXPORT_RUNTIME_VERSION env
 *   2. package.json → presentationExportVersion
 *
 * CLI: --force  re-download even if valid runtime already exists
 *       --check-only  verify index.cjs + converter exist and exit 0/1
 *
 * On every run (including --check-only), index.cjs is overwritten from index.js
 * so the CommonJS entrypoint never drifts from the bundled ESM build.
 */
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const { execFileSync } = require("child_process");

const repoRoot = path.join(__dirname, "..");
const targetRoot = path.join(repoRoot, "presentation-export");
const targetPyDir = path.join(targetRoot, "py");
const targetIndexJs = path.join(targetRoot, "index.js");
const targetIndexCjs = path.join(targetRoot, "index.cjs");
const packageJsonFile = path.join(repoRoot, "package.json");
const cacheDir = path.join(repoRoot, ".cache", "presentation-export");
const exportRepoBase =
  "https://github.com/presenton/presenton-export/releases/download";

const cliArgs = new Set(process.argv.slice(2));
const forceDownload = cliArgs.has("--force");
const checkOnly = cliArgs.has("--check-only");

function resolveLinuxAssetName() {
  const arch = (
    process.env.EXPORT_RUNTIME_ARCH ||
    process.env.TARGETARCH ||
    process.arch
  ).toLowerCase();

  if (arch === "amd64" || arch === "x64") {
    return "export-Linux-X64.zip";
  }
  if (arch === "arm64" || arch === "aarch64") {
    return "export-Linux-ARM64.zip";
  }

  throw new Error(`Unsupported Linux export arch: ${arch}`);
}

const linuxAssetName = resolveLinuxAssetName();

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readPinnedVersion() {
  if (!fs.existsSync(packageJsonFile)) {
    throw new Error(
      `Missing ${path.relative(repoRoot, packageJsonFile)}. Add \"presentationExportVersion\": \"vX.Y.Z\".`
    );
  }
  const raw = JSON.parse(fs.readFileSync(packageJsonFile, "utf8"));
  const v = (raw.presentationExportVersion || "").trim();
  if (!v) {
    throw new Error(
      `${path.relative(repoRoot, packageJsonFile)} must set \"presentationExportVersion\" (e.g. \"v0.2.0\").`
    );
  }
  return v;
}

async function getTargetVersion() {
  const fromEnv = (process.env.EXPORT_RUNTIME_VERSION || "").trim();
  if (fromEnv) {
    return fromEnv === "latest" ? await resolveLatestTag() : fromEnv;
  }
  const pinned = readPinnedVersion();
  if (pinned === "latest") {
    return await resolveLatestTag();
  }
  return pinned;
}

function requestJson(url, redirects = 5) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https:") ? https : http;
    const req = client.get(
      url,
      {
        headers: {
          "User-Agent": "presenton-presentation-export-sync",
          Accept: "application/vnd.github+json",
        },
      },
      (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          if (redirects <= 0) {
            reject(new Error(`Too many redirects for JSON request: ${url}`));
            return;
          }
          requestJson(res.headers.location, redirects - 1).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`Failed to fetch ${url}. HTTP ${res.statusCode}`));
          return;
        }
        let payload = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          payload += chunk;
        });
        res.on("end", () => {
          try {
            resolve(JSON.parse(payload));
          } catch (e) {
            reject(new Error(`Invalid JSON from ${url}: ${e.message}`));
          }
        });
      }
    );
    req.on("error", reject);
  });
}

async function resolveLatestTag() {
  const apiUrl =
    "https://api.github.com/repos/presenton/presenton-export/releases/latest";
  const latest = await requestJson(apiUrl);
  if (!latest.tag_name) {
    throw new Error(`Could not resolve latest tag from ${apiUrl}`);
  }
  return latest.tag_name;
}

function chmodIfPossible(filePath) {
  if (process.platform !== "win32") {
    fs.chmodSync(filePath, 0o755);
  }
}

function ensureCurrentConverterLink(converterPath) {
  const currentPath = path.join(targetPyDir, "convert-linux-current");
  fs.rmSync(currentPath, { force: true });

  if (process.platform === "win32") {
    fs.copyFileSync(converterPath, currentPath);
    return currentPath;
  }

  fs.symlinkSync(path.basename(converterPath), currentPath);
  return currentPath;
}

function getConverterCandidates(baseDir = targetPyDir) {
  if (linuxAssetName === "export-Linux-ARM64.zip") {
    return [
      path.join(baseDir, "convert-linux-arm64"),
      path.join(baseDir, "convert"),
    ];
  }

  return [
    path.join(baseDir, "convert-linux-x64"),
    path.join(baseDir, "convert-linux-amd64"),
    path.join(baseDir, "convert"),
  ];
}

function hasRuntimeBundle(baseDir) {
  const indexPath = path.join(baseDir, "index.js");
  if (!fs.existsSync(indexPath)) {
    return false;
  }

  const pyCandidates = getConverterCandidates(path.join(baseDir, "py"));
  const rootCandidates = getConverterCandidates(baseDir);
  return [...pyCandidates, ...rootCandidates].some((candidate) =>
    fs.existsSync(candidate)
  );
}

function moveFileAtomic(src, dest) {
  try {
    fs.renameSync(src, dest);
  } catch {
    fs.copyFileSync(src, dest);
    fs.rmSync(src, { force: true });
  }
}

function normalizeRuntimeLayout() {
  if (!fs.existsSync(targetRoot)) {
    return;
  }

  ensureDir(targetPyDir);

  const rootCandidates = getConverterCandidates(targetRoot);
  for (const sourcePath of rootCandidates) {
    if (!fs.existsSync(sourcePath)) {
      continue;
    }

    const destinationPath = path.join(targetPyDir, path.basename(sourcePath));
    if (!fs.existsSync(destinationPath)) {
      moveFileAtomic(sourcePath, destinationPath);
    }
  }
}

function ensureCommonJsEntrypoint() {
  if (!fs.existsSync(targetIndexJs)) {
    return { ok: false, reason: `Missing runtime bundle: ${targetIndexJs}` };
  }

  try {
    fs.copyFileSync(targetIndexJs, targetIndexCjs);
    return { ok: true, entrypointPath: targetIndexCjs };
  } catch (err) {
    return {
      ok: false,
      reason: `Failed to create CommonJS entrypoint ${targetIndexCjs}: ${err.message}`,
    };
  }
}

function validateExistingRuntime() {
  normalizeRuntimeLayout();

  const entrypoint = ensureCommonJsEntrypoint();
  if (!entrypoint.ok) {
    return { ok: false, reason: entrypoint.reason };
  }

  const candidates = getConverterCandidates();
  const converterPath = candidates.find((c) => fs.existsSync(c));
  if (!converterPath) {
    return {
      ok: false,
      reason: `No Linux converter binary under ${targetPyDir} or ${targetRoot}.`,
    };
  }
  chmodIfPossible(converterPath);
  const currentConverterPath = ensureCurrentConverterLink(converterPath);
  return {
    ok: true,
    entrypointPath: entrypoint.entrypointPath,
    converterPath,
    currentConverterPath,
  };
}

function downloadFile(url, outputPath, redirects = 5) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https:") ? https : http;
    const req = client.get(
      url,
      {
        headers: {
          "User-Agent": "presenton-presentation-export-sync",
          Accept: "application/octet-stream",
        },
      },
      (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          if (redirects <= 0) {
            reject(new Error(`Too many redirects while downloading ${url}`));
            return;
          }
          downloadFile(res.headers.location, outputPath, redirects - 1)
            .then(resolve)
            .catch(reject);
          return;
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`Failed to download ${url}. HTTP ${res.statusCode}`));
          return;
        }
        ensureDir(path.dirname(outputPath));
        const fileStream = fs.createWriteStream(outputPath);
        res.pipe(fileStream);
        fileStream.on("finish", () => {
          fileStream.close(resolve);
        });
        fileStream.on("error", reject);
      }
    );
    req.on("error", reject);
  });
}

function unzipArchive(zipPath, destDir) {
  ensureDir(destDir);
  execFileSync("unzip", ["-o", zipPath, "-d", destDir], { stdio: "inherit" });
}

function resolveExtractedRoot(extractDir) {
  if (hasRuntimeBundle(extractDir)) {
    return extractDir;
  }

  const children = fs.readdirSync(extractDir, { withFileTypes: true });
  for (const entry of children) {
    if (!entry.isDirectory()) continue;
    const candidate = path.join(extractDir, entry.name);
    if (hasRuntimeBundle(candidate)) {
      return candidate;
    }
  }
  throw new Error(`Unable to locate export runtime root under ${extractDir}`);
}

async function downloadAndInstallRuntime() {
  const tag = await getTargetVersion();
  const downloadUrl = `${exportRepoBase}/${tag}/${linuxAssetName}`;

  ensureDir(cacheDir);
  const zipPath = path.join(cacheDir, linuxAssetName);
  const extractDir = path.join(cacheDir, `extract-${Date.now()}`);

  console.log(`[presentation-export] Downloading ${downloadUrl}`);
  await downloadFile(downloadUrl, zipPath);

  console.log(`[presentation-export] Extracting ${zipPath}`);
  unzipArchive(zipPath, extractDir);

  const sourceRoot = resolveExtractedRoot(extractDir);
  fs.rmSync(targetRoot, { recursive: true, force: true });
  ensureDir(targetRoot);
  fs.cpSync(sourceRoot, targetRoot, { recursive: true, force: true });

  fs.rmSync(extractDir, { recursive: true, force: true });

  return { tag, downloadUrl };
}

async function main() {
  const existing = validateExistingRuntime();

  if (checkOnly) {
    if (!existing.ok) {
      throw new Error(existing.reason);
    }
    console.log("[presentation-export] OK");
    console.log(`  - ${existing.entrypointPath}`);
    console.log(`  - ${existing.converterPath}`);
    console.log(`  - ${existing.currentConverterPath}`);
    return;
  }

  if (existing.ok && !forceDownload) {
    console.log("[presentation-export] Using existing runtime:");
    console.log(`  - ${existing.entrypointPath}`);
    console.log(`  - ${existing.converterPath}`);
    console.log(`  - ${existing.currentConverterPath}`);
    return;
  }

  const { tag, downloadUrl } = await downloadAndInstallRuntime();
  const installed = validateExistingRuntime();
  if (!installed.ok) {
    throw new Error(installed.reason);
  }

  console.log("[presentation-export] Synced successfully:");
  console.log(`  - release: ${tag}`);
  console.log(`  - url: ${downloadUrl}`);
  console.log(`  - ${installed.entrypointPath}`);
  console.log(`  - ${installed.converterPath}`);
  console.log(`  - ${installed.currentConverterPath}`);
}

main().catch((err) => {
  console.error(`[presentation-export] ${err.message}`);
  process.exit(1);
});
