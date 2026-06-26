import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { baseDir, getCacheDir, resourceBaseDir } from "./constants";
import { safeLog } from "./safe-console";

const CACHE_LAYOUT_VERSION = "2";

type ExportSpawnTarget = {
  scriptPath: string;
  converterPath: string;
};

/** MSIX installs live under Program Files\\WindowsApps and block dlopen on packaged .node files. */
export function isWindowsStoreInstall(): boolean {
  if (process.platform !== "win32") {
    return false;
  }
  const markers = [baseDir, process.execPath, path.dirname(process.execPath)];
  return markers.some((candidate) => /\\windowsapps\\/i.test(candidate));
}

function getExportRuntimeVersion(): string {
  try {
    const packageJsonPath = path.join(baseDir, "package.json");
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as {
      exportVersion?: string;
      version?: string;
    };
    return pkg.exportVersion?.trim() || pkg.version?.trim() || "unknown";
  } catch {
    return "unknown";
  }
}

function getMsixExportCacheRoot(exportRuntimeVersion: string): string {
  return path.join(
    getCacheDir(),
    "msix-export-runtime",
    CACHE_LAYOUT_VERSION,
    exportRuntimeVersion
  );
}

function sharpPackagesForPlatform(): string[] {
  const arch = process.arch;
  if (process.platform === "win32") {
    if (arch === "arm64") {
      return [
        "sharp",
        "@img/sharp-win32-arm64",
        "@img/colour",
        "detect-libc",
        "semver",
      ];
    }
    return [
      "sharp",
      "@img/sharp-win32-x64",
      "@img/colour",
      "detect-libc",
      "semver",
    ];
  }
  if (process.platform === "darwin") {
    return arch === "arm64"
      ? ["sharp", "@img/sharp-darwin-arm64", "@img/colour", "detect-libc", "semver"]
      : ["sharp", "@img/sharp-darwin-x64", "@img/colour", "detect-libc", "semver"];
  }
  return ["sharp", "@img/sharp-linux-x64", "@img/colour", "detect-libc", "semver"];
}

function resolvePackageSourceDir(sourceModulesRoot: string, packageName: string): string {
  if (packageName.startsWith("@")) {
    const [scope, name] = packageName.split("/");
    return path.join(sourceModulesRoot, scope, name);
  }
  return path.join(sourceModulesRoot, packageName);
}

function resolvePackageDestDir(destModulesRoot: string, packageName: string): string {
  return resolvePackageSourceDir(destModulesRoot, packageName);
}

function assertSourcePackagesAvailable(sourceModulesRoot: string): void {
  const missingPackages = sharpPackagesForPlatform().filter((packageName) => {
    const sourceDir = resolvePackageSourceDir(sourceModulesRoot, packageName);
    return !fs.existsSync(path.join(sourceDir, "package.json"));
  });

  if (missingPackages.length > 0) {
    throw new Error(
      [
        "Export dependencies are missing from the unpacked app bundle.",
        `Missing: ${missingPackages.join(", ")}`,
        `Expected under: ${sourceModulesRoot}`,
        "Rebuild the APPX after unpacking sharp dependencies from app.asar.",
      ].join(" ")
    );
  }
}

async function fileFingerprint(filePath: string): Promise<string> {
  const stat = await fs.promises.stat(filePath);
  return `${stat.size}:${stat.mtimeMs}`;
}

async function buildSourceFingerprint(exportRoot: string, sourceModulesRoot: string): Promise<string> {
  const hash = createHash("sha256");
  const indexPath = path.join(exportRoot, "index.js");
  hash.update(await fileFingerprint(indexPath));

  for (const packageName of sharpPackagesForPlatform()) {
    const packagePath = resolvePackageSourceDir(sourceModulesRoot, packageName);
    hash.update(packageName);
    hash.update(await fileFingerprint(path.join(packagePath, "package.json")));
    if (packageName.startsWith("@img/sharp-")) {
      const libDir = path.join(packagePath, "lib");
      const entries = await fs.promises.readdir(libDir);
      const nodeBinary = entries.find((entry) => entry.endsWith(".node"));
      if (nodeBinary) {
        hash.update(await fileFingerprint(path.join(libDir, nodeBinary)));
      }
    }
  }

  const pyDir = path.join(exportRoot, "py");
  try {
    const pyEntries = await fs.promises.readdir(pyDir);
    for (const entry of pyEntries) {
      if (!/^convert/i.test(entry)) {
        continue;
      }
      hash.update(await fileFingerprint(path.join(pyDir, entry)));
    }
  } catch {
    // Converter binaries are optional for fingerprinting.
  }

  return hash.digest("hex");
}

async function readCacheFingerprint(cacheRoot: string): Promise<string | null> {
  const stampPath = path.join(cacheRoot, ".source-fingerprint");
  try {
    return (await fs.promises.readFile(stampPath, "utf8")).trim() || null;
  } catch {
    return null;
  }
}

async function copyPath(source: string, destination: string): Promise<void> {
  await fs.promises.mkdir(path.dirname(destination), { recursive: true });
  await fs.promises.cp(source, destination, { recursive: true, force: true });
}

async function materializeMsixExportRuntime(
  exportRoot: string,
  sourceModulesRoot: string,
  cacheRoot: string
): Promise<void> {
  safeLog("[Export] Preparing MSIX export runtime in user cache:", cacheRoot);
  await fs.promises.rm(cacheRoot, { recursive: true, force: true });
  await fs.promises.mkdir(cacheRoot, { recursive: true });

  await copyPath(path.join(exportRoot, "index.js"), path.join(cacheRoot, "index.js"));

  const pyDir = path.join(exportRoot, "py");
  if (fs.existsSync(pyDir)) {
    await copyPath(pyDir, path.join(cacheRoot, "py"));
  }

  const destModulesRoot = path.join(cacheRoot, "node_modules");
  for (const packageName of sharpPackagesForPlatform()) {
    const sourceDir = resolvePackageSourceDir(sourceModulesRoot, packageName);
    const destDir = resolvePackageDestDir(destModulesRoot, packageName);
    if (!fs.existsSync(sourceDir)) {
      throw new Error(`Export dependency missing from app bundle: ${packageName} (${sourceDir})`);
    }
    await copyPath(sourceDir, destDir);
  }

  const fingerprint = await buildSourceFingerprint(exportRoot, sourceModulesRoot);
  await fs.promises.writeFile(path.join(cacheRoot, ".source-fingerprint"), fingerprint, "utf8");
  safeLog("[Export] MSIX export runtime ready.");
}

async function resolveConverterPathFromExportRoot(exportRoot: string): Promise<string> {
  const pyDir = path.join(exportRoot, "py");
  const extension = process.platform === "win32" ? ".exe" : "";
  const converterCandidates = [
    path.join(pyDir, `convert-${process.platform}-${process.arch}${extension}`),
    path.join(pyDir, `convert-${process.platform}${extension}`),
    ...(process.platform === "win32"
      ? [path.join(pyDir, "convert.exe"), path.join(pyDir, "convert")]
      : [path.join(pyDir, "convert")]),
  ];

  for (const candidate of converterCandidates) {
    try {
      await fs.promises.access(candidate, fs.constants.F_OK);
      return candidate;
    } catch {
      continue;
    }
  }

  throw new Error(
    [
      "No converter binary found for export.",
      "Expected one of:",
      ...converterCandidates.map((candidate) => `  - ${candidate}`),
    ].join("\n")
  );
}

/**
 * For Microsoft Store (MSIX) installs, copy export JS + sharp native addons to a writable
 * directory so Node can dlopen them. Returns the original paths elsewhere.
 */
export async function resolveExportSpawnTarget(
  packagedExportRoot: string,
  packagedScriptPath: string,
  resolvePackagedConverterPath: (exportRoot: string) => Promise<string>
): Promise<ExportSpawnTarget> {
  if (!isWindowsStoreInstall()) {
    return {
      scriptPath: packagedScriptPath,
      converterPath: await resolvePackagedConverterPath(packagedExportRoot),
    };
  }

  const exportRuntimeVersion = getExportRuntimeVersion();
  const cacheRoot = getMsixExportCacheRoot(exportRuntimeVersion);
  const cachedScriptPath = path.join(cacheRoot, "index.js");
  const sourceModulesRoot = path.join(resourceBaseDir, "node_modules");
  assertSourcePackagesAvailable(sourceModulesRoot);

  const expectedFingerprint = await buildSourceFingerprint(packagedExportRoot, sourceModulesRoot);
  const cachedFingerprint = await readCacheFingerprint(cacheRoot);
  const cacheIsCurrent =
    cachedFingerprint === expectedFingerprint && fs.existsSync(cachedScriptPath);

  if (!cacheIsCurrent) {
    await materializeMsixExportRuntime(packagedExportRoot, sourceModulesRoot, cacheRoot);
  }

  return {
    scriptPath: cachedScriptPath,
    converterPath: await resolveConverterPathFromExportRoot(cacheRoot),
  };
}
