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

function getRevisionDir(platform) {
  return path.join(cacheDir, Browser.CHROME, `${platform}-${buildId}`);
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

  const chromeDir = path.dirname(executablePath);
  return ["chrome.dll", "icudtl.dat"].every((fileName) =>
    fs.existsSync(path.join(chromeDir, fileName))
  );
}

function validateExecutable(executablePath) {
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
    fs.rmSync(profileDir, { recursive: true, force: true });
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

function normalizeFrameworkSymlinkTargets(frameworkPath) {
  if (!fs.existsSync(frameworkPath)) {
    return 0;
  }

  const stack = [frameworkPath];
  let rewritten = 0;
  while (stack.length) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      const stats = fs.lstatSync(fullPath);
      if (stats.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (!stats.isSymbolicLink()) {
        continue;
      }

      const linkTarget = fs.readlinkSync(fullPath);
      if (!/(^|\/)Versions\/Current\//.test(linkTarget)) {
        continue;
      }

      const resolvedTarget = path.resolve(path.dirname(fullPath), linkTarget);
      if (!fs.existsSync(resolvedTarget)) {
        continue;
      }

      const rewrittenTarget = path.relative(
        path.dirname(fullPath),
        fs.realpathSync.native ? fs.realpathSync.native(resolvedTarget) : fs.realpathSync(resolvedTarget),
      );
      if (!rewrittenTarget || rewrittenTarget === linkTarget) {
        continue;
      }

      fs.unlinkSync(fullPath);
      fs.symlinkSync(rewrittenTarget, fullPath);
      rewritten += 1;
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
  const rewritten = normalizeFrameworkSymlinkTargets(frameworkPath);
  if (rewritten > 0) {
    console.log(
      `[Chromium] Rewrote ${rewritten} framework symlinks to avoid nested Current references.`,
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
        rewritten += normalizeFrameworkSymlinkTargets(fullPath);
        continue;
      }
      stack.push(fullPath);
    }
  }

  if (rewritten > 0) {
    console.log(
      `[Chromium] Rewrote ${rewritten} bundled macOS framework symlinks before packaging.`,
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
  normalizeBundledMacChromiumForPackaging,
  normalizeMacBundleForPackaging,
};
