import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import {
  Browser,
  Cache,
  computeExecutablePath,
  detectBrowserPlatform,
  install,
} from "@puppeteer/browsers";
import { baseDir, getCacheDir, resourceBaseDir } from "./constants";
import { isWindowsStoreInstall } from "./export-msix-runtime";
import { safeError, safeLog } from "./safe-console";

function readPackageMetadata(): {
  exportChromiumBuildId?: string;
  exportMacChromiumBuildId?: string;
  exportMacChromiumBuildIds?: Record<string, string>;
} {
  try {
    return JSON.parse(
      fs.readFileSync(path.join(baseDir, "package.json"), "utf8")
    ) as {
      exportChromiumBuildId?: string;
      exportMacChromiumBuildId?: string;
      exportMacChromiumBuildIds?: Record<string, string>;
    };
  } catch {
    return {};
  }
}

function resolveExportBrowserConfig(): { browser: Browser; buildId: string } {
  const packageJson = readPackageMetadata();

  if (process.platform === "darwin") {
    const configured = process.env.EXPORT_MAC_CHROMIUM_BUILD_ID?.trim();
    const platformKey = `${process.platform}-${process.arch}`;
    const packagedBuildId =
      packageJson.exportMacChromiumBuildIds?.[platformKey]?.trim() ||
      packageJson.exportMacChromiumBuildId?.trim();
    const buildId = configured || packagedBuildId;
    if (buildId) {
      return { browser: Browser.CHROMIUM, buildId };
    }

    // Development and partially packaged trees fall back to the checked-in macOS pins.
    return {
      browser: Browser.CHROMIUM,
      buildId: process.arch === "x64" ? "1625072" : "1625085",
    };
  }

  const configured = process.env.EXPORT_CHROME_BUILD_ID?.trim();
  if (configured) {
    return { browser: Browser.CHROME, buildId: configured };
  }

  const packagedBuildId = packageJson.exportChromiumBuildId?.trim();
  return { browser: Browser.CHROME, buildId: packagedBuildId || "149.0.7827.196" };
}

/** Must match the browser revision expected by the bundled presentation-export runtime. */
const EXPORT_BROWSER_CONFIG = resolveExportBrowserConfig();
const EXPORT_BROWSER = EXPORT_BROWSER_CONFIG.browser;
const EXPORT_BROWSER_BUILD_ID = EXPORT_BROWSER_CONFIG.buildId;
const BUNDLED_CHROMIUM_MANIFEST = "presenton-runtime.json";

type BundledChromiumManifest = {
  browser?: string;
  buildId?: string;
  platform?: string;
  nodePlatform?: string;
  arch?: string;
  executable?: string;
};

export type ChromiumInstallProgress = {
  phase: "downloading" | "installing" | "done" | "error";
  percent?: number;
  message?: string;
};

function resolvePuppeteerCacheRoot(): string {
  const configured = process.env.PUPPETEER_CACHE_DIR?.trim();
  if (configured) {
    return path.resolve(configured);
  }
  return path.join(os.homedir(), ".cache", "puppeteer");
}

export function getBundledExportChromiumCacheRoot(): string {
  return path.join(resourceBaseDir, "resources", "chromium");
}

function readBundledChromiumManifest(): BundledChromiumManifest | null {
  const manifestPath = path.join(getBundledExportChromiumCacheRoot(), BUNDLED_CHROMIUM_MANIFEST);
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as BundledChromiumManifest;
    if (manifest.browser && manifest.browser !== EXPORT_BROWSER) {
      return null;
    }
    if (manifest.buildId && manifest.buildId !== EXPORT_BROWSER_BUILD_ID) {
      return null;
    }
    if (manifest.nodePlatform && manifest.nodePlatform !== process.platform) {
      return null;
    }
    if (manifest.arch && manifest.arch !== process.arch) {
      return null;
    }
    if (!manifest.executable) {
      return null;
    }
    return manifest;
  } catch {
    return null;
  }
}

function resolveManifestBundledExportChromiumPath(): string | null {
  const manifest = readBundledChromiumManifest();
  if (!manifest?.executable) {
    return null;
  }
  const executablePath = path.join(getBundledExportChromiumCacheRoot(), manifest.executable);
  return isMaterializedChromiumComplete(executablePath) ? executablePath : null;
}

function resolveExportBrowserInstallOptions(cacheDir = resolvePuppeteerCacheRoot()):
  | { browser: Browser; buildId: string; cacheDir: string; platform: NonNullable<ReturnType<typeof detectBrowserPlatform>> }
  | null {
  const platform = detectBrowserPlatform();
  if (!platform) {
    return null;
  }
  return {
    browser: EXPORT_BROWSER,
    buildId: EXPORT_BROWSER_BUILD_ID,
    cacheDir,
    platform,
  };
}

/** Pre–Chrome-for-Testing cache layouts still present on some machines. */
function getLegacyExecutableRelativePaths(): string[] {
  if (process.platform === "win32") {
    return [
      path.join("chrome-win64", "chrome.exe"),
      path.join("chrome-win32", "chrome.exe"),
    ];
  }
  if (process.platform === "darwin") {
    return [
      path.join("chrome-mac", "Chromium.app", "Contents", "MacOS", "Chromium"),
      path.join("chrome-mac-arm64", "Chromium.app", "Contents", "MacOS", "Chromium"),
      path.join("chrome-mac-x64", "Chromium.app", "Contents", "MacOS", "Chromium"),
    ];
  }
  return [path.join("chrome-linux64", "chrome")];
}

function resolveLegacyInstalledExportChromiumPath(): string | null {
  const chromeBaseDir = path.join(resolvePuppeteerCacheRoot(), "chrome");
  let revisionDirs: string[] = [];
  try {
    revisionDirs = fs
      .readdirSync(chromeBaseDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(chromeBaseDir, entry.name));
  } catch {
    return null;
  }

  const legacyRelativePaths = getLegacyExecutableRelativePaths();
  for (const revisionDir of revisionDirs) {
    const revisionName = path.basename(revisionDir);
    if (
      revisionName !== EXPORT_BROWSER_BUILD_ID &&
      !revisionName.endsWith(`-${EXPORT_BROWSER_BUILD_ID}`)
    ) {
      continue;
    }
    for (const relativePath of legacyRelativePaths) {
      const executablePath = path.join(revisionDir, relativePath);
      if (fs.existsSync(executablePath)) {
        return executablePath;
      }
    }
  }
  return null;
}

export function resolveInstalledExportChromiumPath(): string | null {
  const manifestBundledPath = resolveManifestBundledExportChromiumPath();
  if (manifestBundledPath) {
    return manifestBundledPath;
  }

  const bundledOptions = resolveExportBrowserInstallOptions(getBundledExportChromiumCacheRoot());
  if (bundledOptions) {
    const bundledExpectedPath = computeExecutablePath(bundledOptions);
    if (fs.existsSync(bundledExpectedPath)) {
      return bundledExpectedPath;
    }

    const bundledCache = new Cache(bundledOptions.cacheDir);
    for (const installed of bundledCache.getInstalledBrowsers()) {
      if (installed.browser !== EXPORT_BROWSER || installed.buildId !== bundledOptions.buildId) {
        continue;
      }
      if (fs.existsSync(installed.executablePath)) {
        return installed.executablePath;
      }
    }
  }

  const options = resolveExportBrowserInstallOptions();
  if (options) {
    const expectedPath = computeExecutablePath(options);
    if (fs.existsSync(expectedPath)) {
      return expectedPath;
    }

    const cache = new Cache(options.cacheDir);
    for (const installed of cache.getInstalledBrowsers()) {
      if (installed.browser !== EXPORT_BROWSER || installed.buildId !== options.buildId) {
        continue;
      }
      if (fs.existsSync(installed.executablePath)) {
        return installed.executablePath;
      }
    }
  }

  return resolveLegacyInstalledExportChromiumPath();
}

export function isExportChromiumAvailable(): boolean {
  return Boolean(resolveInstalledExportChromiumPath());
}

function isPathUnderWindowsApps(filePath: string): boolean {
  return /\\windowsapps\\/i.test(filePath);
}

function getMsixChromiumCacheRoot(): string {
  return path.join(getCacheDir(), "msix-export-chromium", EXPORT_BROWSER_BUILD_ID);
}

/**
 * Packaged desktop apps see APPDATA through MSIX virtualization. Browser children
 * break away from that context, so they need the backing LocalCache path instead
 * of the nominal Roaming path returned inside the package.
 */
function resolveMsixBackingPath(virtualPath: string): string {
  if (process.platform !== "win32") {
    return virtualPath;
  }

  const appData = process.env.APPDATA?.trim();
  const localAppData = process.env.LOCALAPPDATA?.trim();
  if (!appData || !localAppData) {
    return virtualPath;
  }

  const relativePath = path.relative(appData, virtualPath);
  if (
    !relativePath ||
    path.isAbsolute(relativePath) ||
    relativePath === ".." ||
    relativePath.startsWith(`..${path.sep}`)
  ) {
    return virtualPath;
  }

  const packagesRoot = path.join(localAppData, "Packages");
  try {
    const packageDirs = fs
      .readdirSync(packagesRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory());
    for (const packageDir of packageDirs) {
      const candidate = path.join(
        packagesRoot,
        packageDir.name,
        "LocalCache",
        "Roaming",
        relativePath
      );
      if (isMaterializedChromiumComplete(candidate)) {
        safeLog(`[Chromium] Resolved MSIX backing path: ${candidate}`);
        return candidate;
      }
    }
  } catch {
    // The nominal path remains useful outside virtualized APPX installs.
  }

  return virtualPath;
}

/**
 * MSIX/APPX installs keep the app under Program Files\\WindowsApps. Chrome cannot
 * reliably launch from that read-only package, so copy the browser folder to user cache.
 */
async function materializeBundledChromiumForMsix(bundledExePath: string): Promise<string> {
  const browserDir = path.dirname(bundledExePath);
  const revisionDir = path.dirname(browserDir);
  const revisionName = path.basename(revisionDir);
  const cacheRoot = getMsixChromiumCacheRoot();
  const destRevisionDir = path.join(cacheRoot, "chrome", revisionName);
  const destExe = path.join(destRevisionDir, path.basename(browserDir), path.basename(bundledExePath));
  const stampPath = path.join(cacheRoot, ".source-revision-dir");
  const sourceStamp = `${revisionDir}\n${await getDirectoryMtimeFingerprint(revisionDir)}`;

  if (isMaterializedChromiumComplete(destExe)) {
    try {
      if ((await fs.promises.readFile(stampPath, "utf8")).trim() === sourceStamp.trim()) {
        return resolveMsixBackingPath(destExe);
      }
    } catch {
      // Stale cache; recopy below.
    }
  }

  safeLog(
    "[Chromium] Copying bundled Chrome for Microsoft Store install:",
    destRevisionDir
  );
  await fs.promises.rm(cacheRoot, { recursive: true, force: true });
  await fs.promises.mkdir(path.dirname(destRevisionDir), { recursive: true });
  await fs.promises.cp(revisionDir, destRevisionDir, { recursive: true });
  await fs.promises.writeFile(stampPath, sourceStamp, "utf8");

  if (!isMaterializedChromiumComplete(destExe)) {
    throw new Error(`Chrome executable missing after MSIX materialization: ${destExe}`);
  }
  return resolveMsixBackingPath(destExe);
}

function isMaterializedChromiumComplete(executablePath: string): boolean {
  if (!fs.existsSync(executablePath)) {
    return false;
  }
  if (process.platform !== "win32") {
    return true;
  }

  const chromeDir = path.dirname(executablePath);
  return ["chrome.dll", "icudtl.dat"].every((fileName) =>
    fs.existsSync(path.join(chromeDir, fileName))
  );
}

async function getDirectoryMtimeFingerprint(directory: string): Promise<string> {
  let newestMtime = 0;
  let fileCount = 0;
  const visit = async (current: string) => {
    const entries = await fs.promises.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await visit(fullPath);
        continue;
      }
      const stat = await fs.promises.stat(fullPath);
      newestMtime = Math.max(newestMtime, stat.mtimeMs);
      fileCount += 1;
    }
  };
  await visit(directory);
  return `${fileCount}:${newestMtime}`;
}

function verifyChromiumCanStart(executablePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const probe = spawn(
      executablePath,
      [
        "--headless=new",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--no-sandbox",
        "--no-first-run",
        "--disable-extensions",
        "about:blank",
      ],
      {
        stdio: "ignore",
        windowsHide: process.platform === "win32",
      }
    );

    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      probe.kill();
      resolve();
    }, 3000);

    probe.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    });

    probe.once("exit", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      code === 0
        ? resolve()
        : reject(new Error(`Chrome probe exited with code ${code ?? "unknown"}`));
    });
  });
}

/**
 * Resolves a Chrome binary path that can actually be spawned (writable on MSIX/APPX).
 */
export async function resolveLaunchableExportChromiumPath(): Promise<string | null> {
  const installed = resolveInstalledExportChromiumPath();
  if (!installed) {
    return null;
  }

  const mustMaterialize =
    isWindowsStoreInstall() || isPathUnderWindowsApps(installed);
  if (!mustMaterialize) {
    return installed;
  }

  try {
    const materializedPath = await materializeBundledChromiumForMsix(installed);
    await verifyChromiumCanStart(materializedPath);
    return materializedPath;
  } catch (error) {
    safeError("[Chromium] Failed to prepare Chrome for Microsoft Store export", error);
    return null;
  }
}

export async function removeBrokenExportChromiumCaches(): Promise<number> {
  const cacheDir = resolvePuppeteerCacheRoot();
  const cache = new Cache(cacheDir);
  let removedCount = 0;

  for (const installed of cache.getInstalledBrowsers()) {
    if (installed.browser !== EXPORT_BROWSER) {
      continue;
    }
    const wrongBuild = installed.buildId !== EXPORT_BROWSER_BUILD_ID;
    if (!wrongBuild && fs.existsSync(installed.executablePath)) {
      continue;
    }
    try {
      await fs.promises.rm(installed.path, { recursive: true, force: true });
      removedCount += 1;
      safeLog(
        `[Chromium] Removed ${wrongBuild ? "unpinned" : "broken"} cache: ${installed.path}`
      );
    } catch {
      // Best effort cleanup only.
    }
  }

  const chromeBaseDir = path.join(cacheDir, "chrome");
  const legacyRelativePaths = getLegacyExecutableRelativePaths();
  let revisionDirs: string[] = [];
  try {
    revisionDirs = fs
      .readdirSync(chromeBaseDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(chromeBaseDir, entry.name));
  } catch {
    return removedCount;
  }

  for (const revisionDir of revisionDirs) {
    const hasLegacyExecutable = legacyRelativePaths.some((relativePath) =>
      fs.existsSync(path.join(revisionDir, relativePath))
    );
    if (hasLegacyExecutable) {
      continue;
    }

    const basename = path.basename(revisionDir);
    if (basename.includes("-")) {
      continue;
    }

    try {
      await fs.promises.rm(revisionDir, { recursive: true, force: true });
      removedCount += 1;
      safeLog(`[Chromium] Removed broken cache: ${revisionDir}`);
    } catch {
      // Best effort cleanup only.
    }
  }

  return removedCount;
}

function formatMegabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export async function installExportChromium(
  onProgress?: (progress: ChromiumInstallProgress) => void
): Promise<void> {
  const removed = await removeBrokenExportChromiumCaches();
  if (removed > 0) {
    onProgress?.({
      phase: "installing",
      message: `Removed ${removed} incomplete Chromium download${removed === 1 ? "" : "s"}.`,
    });
  }

  if (isExportChromiumAvailable()) {
    onProgress?.({ phase: "done", percent: 100, message: "Chromium is already installed." });
    return;
  }

  const options = resolveExportBrowserInstallOptions();
  if (!options) {
    throw new Error(`Unsupported platform for Chromium export runtime: ${process.platform}-${process.arch}`);
  }

  await fs.promises.mkdir(options.cacheDir, { recursive: true });

  onProgress?.({
    phase: "downloading",
    percent: 0,
    message: `Downloading Chromium ${options.buildId}…`,
  });

  let lastLoggedPercent = -1;
  await install({
    ...options,
    downloadProgressCallback(downloadedBytes, totalBytes) {
      if (totalBytes <= 0) {
        return;
      }
      const percent = Math.min(99, Math.floor((downloadedBytes / totalBytes) * 100));
      if (percent === lastLoggedPercent) {
        return;
      }
      lastLoggedPercent = percent;
      onProgress?.({
        phase: "downloading",
        percent,
        message: `${formatMegabytes(downloadedBytes)} / ${formatMegabytes(totalBytes)}`,
      });
    },
  });

  if (!isExportChromiumAvailable()) {
    const expectedPath = computeExecutablePath(options);
    throw new Error(
      `Chromium download finished but the browser executable was not found at ${expectedPath}. Check your network connection and try again.`
    );
  }

  onProgress?.({
    phase: "done",
    percent: 100,
    message: `Chromium ready (${resolveInstalledExportChromiumPath()})`,
  });
}

export async function ensureExportChromiumReady(): Promise<boolean> {
  await removeBrokenExportChromiumCaches();
  if (isExportChromiumAvailable()) {
    return true;
  }
  await installExportChromium();
  return isExportChromiumAvailable();
}
