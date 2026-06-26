const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const {
  Browser,
  computeExecutablePath,
  detectBrowserPlatform,
  install,
} = require("@puppeteer/browsers");

const buildId = (process.env.EXPORT_CHROME_BUILD_ID || "146.0.7680.76").trim();
const cacheDir = path.join(__dirname, "..", "resources", "chromium");
const manifestPath = path.join(cacheDir, "presenton-runtime.json");
const windowsRequiredRuntimeFiles = [
  "chrome.dll",
  "chrome_100_percent.pak",
  "chrome_200_percent.pak",
  "icudtl.dat",
  "resources.pak",
  "v8_context_snapshot.bin",
  path.join("locales", "en-US.pak"),
];

function getRevisionDir(platform) {
  return path.join(cacheDir, Browser.CHROME, `${platform}-${buildId}`);
}

function fileLooksPresent(filePath) {
  try {
    const stat = fs.statSync(filePath);
    return stat.isFile() && stat.size > 0;
  } catch {
    return false;
  }
}

function validateWindowsRuntimeLayout(executablePath) {
  if (!fileLooksPresent(executablePath)) {
    return { ok: false, reason: `Chromium executable is missing: ${executablePath}` };
  }

  const chromeDir = path.dirname(executablePath);
  const missingFiles = windowsRequiredRuntimeFiles.filter(
    (fileName) => !fileLooksPresent(path.join(chromeDir, fileName))
  );
  if (missingFiles.length > 0) {
    return {
      ok: false,
      reason: `Chromium runtime layout is incomplete. Missing: ${missingFiles.join(", ")}`,
    };
  }

  return { ok: true };
}

function runtimeLooksComplete(executablePath) {
  if (!fs.existsSync(executablePath)) {
    return false;
  }
  if (process.platform === "darwin") {
    return macChromiumBundleLooksCodeSignReady(executablePath);
  }
  if (process.platform !== "win32") {
    return true;
  }

  return validateWindowsRuntimeLayout(executablePath).ok;
}

function removeProbeProfile(profileDir) {
  try {
    fs.rmSync(profileDir, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 100,
    });
  } catch (error) {
    console.warn(
      `[Chromium] Could not remove temporary probe profile ${profileDir}: ${error.message}`,
    );
  }
}

function validateExecutable(executablePath) {
  if (process.platform === "win32") {
    // Windows Chrome startup can be slow or session-dependent during packaging.
    // Runtime export still probes launchability, so the build validates the bundle.
    return validateWindowsRuntimeLayout(executablePath);
  }

  if (!runtimeLooksComplete(executablePath)) {
    return { ok: false, reason: "Chromium runtime layout is incomplete." };
  }

  if (process.platform === "darwin") {
    const appBundlePath = findAppBundle(executablePath);
    const result = spawnSync(
      "codesign",
      ["--verify", "--deep", "--strict", appBundlePath],
      {
        stdio: ["ignore", "pipe", "pipe"],
        encoding: "utf8",
      },
    );
    if (result.status !== 0) {
      const detail = result.error?.message || result.stderr || `status=${result.status}`;
      return { ok: false, reason: detail.trim() };
    }
    return { ok: true };
  }

  if (process.platform === "linux") {
    const result = spawnSync(executablePath, ["--version"], {
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
    });
    if (result.error || result.status !== 0) {
      const detail = result.error?.message || result.stderr || `status=${result.status}`;
      return { ok: false, reason: detail.trim() };
    }
    if (!/chrome|chromium/i.test(result.stdout || "")) {
      return { ok: false, reason: "Chromium version probe produced unexpected output." };
    }
    return { ok: true };
  }

  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "presenton-chromium-probe-"));
  try {
    const result = spawnSync(
      executablePath,
      [
        "--headless=new",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--disable-extensions",
        "--disable-crash-reporter",
        "--no-first-run",
        "--no-sandbox",
        "--password-store=basic",
        "--use-mock-keychain",
        `--user-data-dir=${profileDir}`,
        "--dump-dom",
        "about:blank",
      ],
      {
        stdio: ["ignore", "pipe", "pipe"],
        encoding: "utf8",
        timeout: 15000,
        windowsHide: process.platform === "win32",
      },
    );
    if (result.status !== 0) {
      const detail = result.error?.message || result.stderr || `status=${result.status}`;
      return { ok: false, reason: detail.trim() };
    }
    if (!(result.stdout || "").toLowerCase().includes("<html")) {
      return { ok: false, reason: "Chromium probe did not produce HTML output." };
    }
    return { ok: true };
  } finally {
    removeProbeProfile(profileDir);
  }
}

function writeManifest(platform, executablePath) {
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        browser: Browser.CHROME,
        buildId,
        platform,
        nodePlatform: process.platform,
        arch: process.arch,
        executable: path.relative(cacheDir, executablePath),
        createdAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
}

function findAppBundle(executablePath) {
  let current = path.dirname(executablePath);
  while (true) {
    if (current.endsWith(".app")) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

function isSymlink(filePath) {
  try {
    return fs.lstatSync(filePath).isSymbolicLink();
  } catch {
    return false;
  }
}

function macChromiumFrameworkPath(appBundlePath) {
  return path.join(
    appBundlePath,
    "Contents",
    "Frameworks",
    "Google Chrome for Testing Framework.framework",
  );
}

function macFrameworkLayoutLooksValid(frameworkPath) {
  if (!fs.existsSync(frameworkPath)) {
    return false;
  }
  const entries = fs.readdirSync(frameworkPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "Versions") {
      continue;
    }
    if (!isSymlink(path.join(frameworkPath, entry.name))) {
      return false;
    }
  }

  return isSymlink(path.join(frameworkPath, "Versions", "Current"));
}

function macChromiumBundleLooksCodeSignReady(executablePath) {
  const appBundlePath = findAppBundle(executablePath);
  if (!appBundlePath) {
    return false;
  }
  return macFrameworkLayoutLooksValid(macChromiumFrameworkPath(appBundlePath));
}

function canonicalizeFrameworkSymlinkTargets(frameworkPath) {
  if (!fs.existsSync(frameworkPath)) {
    return 0;
  }

  const versionsPath = path.join(frameworkPath, "Versions");
  const currentPath = path.join(versionsPath, "Current");
  if (!fs.existsSync(versionsPath)) {
    return 0;
  }

  let rewritten = 0;

  const versionEntries = fs
    .readdirSync(versionsPath, { withFileTypes: true })
    .filter((entry) => entry.name !== "Current" && entry.isDirectory())
    .map((entry) => entry.name);
  const currentTarget =
    isSymlink(currentPath) &&
    fs.existsSync(path.resolve(versionsPath, fs.readlinkSync(currentPath)))
      ? fs.readlinkSync(currentPath)
      : versionEntries[0];

  if (!currentTarget) {
    return 0;
  }

  if (!isSymlink(currentPath) || fs.readlinkSync(currentPath) !== currentTarget) {
    fs.rmSync(currentPath, { recursive: true, force: true });
    fs.symlinkSync(currentTarget, currentPath);
    rewritten += 1;
  }

  const topLevelSymlinks = [
    "Google Chrome for Testing Framework",
    "Helpers",
    "Libraries",
    "Resources",
  ];
  for (const name of topLevelSymlinks) {
    const linkPath = path.join(frameworkPath, name);
    const linkTarget = ["Versions", "Current", name].join("/");
    if (!fs.existsSync(path.resolve(frameworkPath, linkTarget))) {
      continue;
    }
    if (isSymlink(linkPath) && fs.readlinkSync(linkPath) === linkTarget) {
      continue;
    }

    fs.rmSync(linkPath, { recursive: true, force: true });
    fs.symlinkSync(linkTarget, linkPath);
    rewritten += 1;
  }

  return rewritten;
}

function canonicalizeMacFrameworkSymlinks(rootDir) {
  if (!fs.existsSync(rootDir)) {
    return 0;
  }

  const stack = [rootDir];
  let rewritten = 0;
  while (stack.length) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (!entry.isDirectory()) {
        continue;
      }
      if (entry.name === "Google Chrome for Testing Framework.framework") {
        rewritten += canonicalizeFrameworkSymlinkTargets(fullPath);
        continue;
      }
      if (entry.name.endsWith(".framework")) {
        continue;
      }
      stack.push(fullPath);
    }
  }

  return rewritten;
}

function normalizeMacBundleForPackaging(executablePath) {
  const appBundlePath = findAppBundle(executablePath);
  if (!appBundlePath || !fs.existsSync(appBundlePath)) {
    return 0;
  }

  const frameworkPath = macChromiumFrameworkPath(appBundlePath);
  const rewritten = canonicalizeFrameworkSymlinkTargets(frameworkPath);
  if (rewritten > 0) {
    console.log(
      `[Chromium] Canonicalized ${rewritten} framework symlinks for App Store packaging.`,
    );
  }
  adHocSignMacBundle(appBundlePath);
  return rewritten;
}

function adHocSignMacBundle(appBundlePath) {
  if (process.platform !== "darwin") {
    return;
  }

  const result = spawnSync(
    "codesign",
    ["--force", "--deep", "--sign", "-", "--timestamp=none", appBundlePath],
    {
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
    },
  );
  if (result.status !== 0) {
    throw new Error(
      `Failed to re-sign normalized Chromium bundle: ${(result.stderr || result.stdout || "").trim()}`,
    );
  }
  console.log(`[Chromium] Re-signed normalized macOS bundle: ${appBundlePath}`);
}

function normalizeBundledMacChromiumForPackaging(rootDir = cacheDir) {
  const rewritten = canonicalizeMacFrameworkSymlinks(rootDir);
  if (rewritten > 0) {
    console.log(
      `[Chromium] Canonicalized ${rewritten} bundled macOS framework symlinks before packaging.`,
    );
  }
  return rewritten;
}

function removeIncompleteRuntime(platform, executablePath) {
  if (validateExecutable(executablePath).ok) {
    return;
  }

  const revisionDir = getRevisionDir(platform);
  if (!fs.existsSync(revisionDir)) {
    return;
  }

  console.log(
    `[Chromium] Removing incomplete runtime before download: ${revisionDir}`
  );
  fs.rmSync(revisionDir, { recursive: true, force: true });
}

async function main() {
  if (process.env.SKIP_BUNDLED_CHROMIUM === "1") {
    console.log("[Chromium] SKIP_BUNDLED_CHROMIUM=1; leaving runtime unbundled.");
    return;
  }

  const platform = detectBrowserPlatform();
  if (!platform) {
    throw new Error(`Unsupported platform for bundled Chromium: ${process.platform}-${process.arch}`);
  }

  const options = {
    browser: Browser.CHROME,
    buildId,
    cacheDir,
    platform,
  };
  const executablePath = computeExecutablePath(options);
  if (runtimeLooksComplete(executablePath)) {
    if (!validateExecutable(executablePath).ok) {
      removeIncompleteRuntime(platform, executablePath);
    } else {
      normalizeMacBundleForPackaging(executablePath);
      if (!validateExecutable(executablePath).ok) {
        removeIncompleteRuntime(platform, executablePath);
      } else {
        writeManifest(platform, executablePath);
        console.log(`[Chromium] Bundled runtime already exists: ${executablePath}`);
        return;
      }
    }
  }

  if (validateExecutable(executablePath).ok) {
    writeManifest(platform, executablePath);
    return;
  }

  removeIncompleteRuntime(platform, executablePath);
  fs.mkdirSync(cacheDir, { recursive: true });
  console.log(`[Chromium] Downloading Chrome for Testing ${buildId} into ${cacheDir}`);
  await install({
    ...options,
    downloadProgressCallback(downloadedBytes, totalBytes) {
      if (totalBytes <= 0) return;
      const percent = Math.floor((downloadedBytes / totalBytes) * 100);
      process.stdout.write(`\r[Chromium] ${percent}%`);
    },
  });
  process.stdout.write("\n");

  normalizeMacBundleForPackaging(executablePath);
  const validation = validateExecutable(executablePath);
  if (!validation.ok) {
    throw new Error(
      `Chromium install finished, but the launch probe failed: ${validation.reason}\n${executablePath}`,
    );
  }
  writeManifest(platform, executablePath);
  console.log(`[Chromium] Bundled runtime ready: ${executablePath}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  adHocSignMacBundle,
  canonicalizeMacFrameworkSymlinks,
  normalizeBundledMacChromiumForPackaging,
  normalizeMacBundleForPackaging,
};
