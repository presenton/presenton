import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { baseDir, getCacheDir } from "./constants";
import { safeLog } from "./safe-console";

const CACHE_LAYOUT_VERSION = "3";

type ExportSpawnTarget = {
  scriptPath: string;
};

/** MSIX installs live under Program Files\WindowsApps and block native addons. */
export function isWindowsStoreInstall(): boolean {
  if (process.platform !== "win32") return false;
  return [baseDir, process.execPath, path.dirname(process.execPath)].some((candidate) =>
    /\\windowsapps\\/i.test(candidate),
  );
}

function getExportRuntimeVersion(): string {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(baseDir, "package.json"), "utf8")) as {
      exportVersion?: string;
      version?: string;
    };
    return pkg.exportVersion?.trim() || pkg.version?.trim() || "unknown";
  } catch {
    return "unknown";
  }
}

function getCacheRoot(): string {
  return path.join(
    getCacheDir(),
    "msix-export-runtime",
    CACHE_LAYOUT_VERSION,
    getExportRuntimeVersion(),
  );
}

async function sourceFingerprint(exportRoot: string): Promise<string> {
  const hash = createHash("sha256");
  const trackedFiles = [
    "runner.mjs",
    "presenton-export-version.json",
    path.join("node_modules", "@presenton", "export-core", "package.json"),
    path.join("node_modules", "@presenton", "export-core", "dist", "index.js"),
  ];
  for (const relativePath of trackedFiles) {
    const filePath = path.join(exportRoot, relativePath);
    const stat = await fs.promises.stat(filePath);
    hash.update(relativePath);
    hash.update(`${stat.size}:${stat.mtimeMs}`);
  }
  return hash.digest("hex");
}

async function readFingerprint(cacheRoot: string): Promise<string | null> {
  try {
    return (await fs.promises.readFile(path.join(cacheRoot, ".source-fingerprint"), "utf8")).trim();
  } catch {
    return null;
  }
}

export async function resolveExportRuntimeRoot(packagedExportRoot: string): Promise<string> {
  if (!isWindowsStoreInstall()) return packagedExportRoot;

  const cacheRoot = getCacheRoot();
  const fingerprint = await sourceFingerprint(packagedExportRoot);
  const cachedFingerprint = await readFingerprint(cacheRoot);
  const cachedRunner = path.join(cacheRoot, "runner.mjs");
  if (fingerprint === cachedFingerprint && fs.existsSync(cachedRunner)) {
    return cacheRoot;
  }

  safeLog("[Export] Preparing MSIX export-core runtime in user cache:", cacheRoot);
  await fs.promises.rm(cacheRoot, { recursive: true, force: true });
  await fs.promises.mkdir(path.dirname(cacheRoot), { recursive: true });
  await fs.promises.cp(packagedExportRoot, cacheRoot, {
    recursive: true,
    force: true,
  });
  await fs.promises.writeFile(
    path.join(cacheRoot, ".source-fingerprint"),
    fingerprint,
    "utf8",
  );
  return cacheRoot;
}

export async function resolveExportSpawnTarget(
  packagedExportRoot: string,
  packagedScriptPath: string,
): Promise<ExportSpawnTarget> {
  const exportRoot = await resolveExportRuntimeRoot(packagedExportRoot);
  return {
    scriptPath:
      exportRoot === packagedExportRoot
        ? packagedScriptPath
        : path.join(exportRoot, path.basename(packagedScriptPath)),
  };
}
