require("dotenv").config();
import { app, BrowserWindow, globalShortcut } from "electron";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { findUnusedPorts, setupEnv, setUserConfig } from "./utils";
import { startFastApiServer, startNextJsServer } from "./utils/servers";
import {
  baseDir,
  ensureDirectoriesExist,
  fastapiDir,
  getAppDataDir,
  getCacheDir,
  getTempDir,
  getUserConfigPath,
  initializeAppPaths,
  isDev,
  localhost,
  nextjsDir,
} from "./utils/constants";
import { setupIpcHandlers } from "./ipc";
import { stopActiveExportProcesses } from "./ipc/export_handlers";
import { getLiteParseRunnerPath } from "./utils/liteparse-check";
import {
  buildPathWithImageMagick,
  resolveImageMagickRuntime,
  type ImageMagickRuntime,
} from "./utils/imagemagick-runtime";
import { startUpdateChecker, stopUpdateChecker } from "./utils/update-checker";
import {
  addMainBreadcrumb,
  captureMainException,
  initMainSentry,
  setMainSentryRuntimeContext,
} from "./sentry/main";
import { installSafeConsole, safeError, safeLog, safeStderrWrite, safeWarn } from "./utils/safe-console";
import { memorySnapshotMb } from "./utils/memory";
import {
  isSupportedExternalUrl,
  openExternalUrl,
  showOpenTargetErrorDialog,
} from "./utils/open-target";
import {
  finishChromiumCacheRecovery,
  prepareChromiumCacheRecovery,
  type ChromiumCacheRecoveryStatus,
} from "./utils/chromium-cache-recovery";
import { resolveLaunchableExportChromiumPath } from "./utils/export-chromium";

installSafeConsole();

// Linux Chromium requires chrome-sandbox to be root-owned mode 4755; unpacked
// dist/linux-unpacked builds usually lack that. Disable sandbox only when invalid.
if (process.platform === "linux") {
  try {
    const sandboxPath = path.join(path.dirname(process.execPath), "chrome-sandbox");
    if (fs.existsSync(sandboxPath)) {
      const st = fs.statSync(sandboxPath);
      const hasSetuid = (st.mode & 0o4777) === 0o4755;
      const rootOwned = st.uid === 0;
      if (!(hasSetuid && rootOwned)) {
        app.commandLine.appendSwitch("no-sandbox");
      }
    } else {
      app.commandLine.appendSwitch("no-sandbox");
    }
  } catch {
    app.commandLine.appendSwitch("no-sandbox");
  }
  // Fall back to /tmp instead of shared memory to avoid Chromium crashes
  // on systems where /dev/shm is unavailable/misconfigured.
  app.commandLine.appendSwitch("disable-dev-shm-usage");
}

var win: BrowserWindow | undefined;
type ManagedServerProcess = Awaited<ReturnType<typeof startFastApiServer>>;
var fastApiServer: ManagedServerProcess | undefined;
var nextjsServer: ManagedServerProcess | undefined;
let isStopping = false;

function getLiveMainWindow(): BrowserWindow | undefined {
  if (!win || win.isDestroyed()) {
    return undefined;
  }
  return win;
}

type ProcessGoneDetails = {
  reason?: string;
  type?: string;
  exitCode?: number;
  serviceName?: string;
  name?: string;
};

function profileHash(userDataDir: string): string {
  return crypto.createHash("sha256").update(userDataDir).digest("hex").slice(0, 16);
}

function updateSentryRuntimeContext(cacheRecovery: ChromiumCacheRecoveryStatus): void {
  setMainSentryRuntimeContext({
    profileHash: profileHash(electronAppPaths.userDataDir),
    cacheRecoveryStatus: cacheRecovery.status,
    cacheRecoveryMode: cacheRecovery.mode,
  });
}

function recordProcessGone(kind: "child" | "renderer", details: ProcessGoneDetails): void {
  const reason = details.reason ?? "unknown";
  const data = {
    kind,
    reason,
    type: details.type,
    exitCode: details.exitCode,
    serviceName: details.serviceName,
    name: details.name,
  };

  addMainBreadcrumb("process", `electron.${kind}_process_gone`, data);
  if (isStopping || reason === "clean-exit") {
    return;
  }

  captureMainException(new Error(`Electron ${kind} process gone: ${reason}`), data);
}

function resolveExportConverterPath(appRoot: string): string | undefined {
  const pyDir = path.join(appRoot, "resources", "export", "py");
  const candidates = [
    path.join(pyDir, `convert-${process.platform}-${process.arch}`),
    path.join(pyDir, `convert-${process.platform}-${process.arch}.exe`),
    path.join(pyDir, `convert-${process.platform}`),
    path.join(pyDir, `convert-${process.platform}.exe`),
    path.join(pyDir, "convert"),
    path.join(pyDir, "convert.exe"),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

function isDisableAuthEnabledValue(value?: string): boolean {
  const raw = value?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function resolveElectronDisableAuth(): string {
  const raw = (
    process.env.ELECTRON_DISABLE_AUTH ?? process.env.DISABLE_AUTH
  )?.trim().toLowerCase();
  if (!raw) {
    return "true";
  }
  if (["0", "false", "no", "off"].includes(raw)) {
    return "false";
  }
  if (isDisableAuthEnabledValue(raw)) {
    return "true";
  }
  return "true";
}

function buildImageMagickEnv(runtime: ImageMagickRuntime | null): Partial<FastApiEnv> {
  if (!runtime) {
    return {};
  }

  const pathKey = process.platform === "win32" && process.env.Path !== undefined
    ? "Path"
    : "PATH";

  return {
    IMAGEMAGICK_BINARY: runtime.binaryPath,
    MAGICK_HOME: runtime.homeDir,
    MAGICK_CONFIGURE_PATH: runtime.homeDir,
    [pathKey]: buildPathWithImageMagick(runtime),
  };
}

app.commandLine.appendSwitch('gtk-version', '3');

// Work around Chromium/Electron GPU compositor issues that can cause
// startup white screens on some Linux/driver combinations.
app.disableHardwareAcceleration();

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

const electronAppPaths = initializeAppPaths();
const chromiumCacheRecovery = prepareChromiumCacheRecovery(
  electronAppPaths.cacheDir,
  electronAppPaths.userDataDir,
);
safeLog("[Presenton] Electron paths initialized:", electronAppPaths);

initMainSentry();
updateSentryRuntimeContext(chromiumCacheRecovery);

app.on("child-process-gone", (_event, details) => {
  recordProcessGone("child", details);
});

addMainBreadcrumb("memory", "electron.main.startup", memorySnapshotMb());
safeLog("[Presenton] Startup memory:", {
  memory: memorySnapshotMb(),
});

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    show: false, // Reveal once the launch screen has painted to avoid a blank flash.
    backgroundColor: "#f3f5ff",
    icon: path.join(baseDir, "resources/ui/assets/images/presenton_short_filled.png"),
    webPreferences: {
        webSecurity: false,
        // Ensure a known preload path and explicit isolation settings so
        // the `contextBridge` API is exposed reliably to renderer pages.
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        preload: (() => {
          const p = path.join(__dirname, 'preloads/index.js');
          try {
            if (!fs.existsSync(p)) {
              safeWarn(`[Presenton] Preload not found at ${p}`);
            }
          } catch (e) {
            safeWarn('[Presenton] Failed to stat preload path', e);
          }
          return p;
        })(),
    },
  });
  win = mainWindow;

  mainWindow.on("closed", () => {
    if (win === mainWindow) {
      win = undefined;
    }
  });

  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    recordProcessGone("renderer", details);
  });

  // Open external links (e.g. "Download update") in the system browser so the user
  // sees download progress and can manage downloads normally.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!isSupportedExternalUrl(url)) {
      safeWarn("[Presenton] Blocked unsupported window open URL.");
      return { action: "deny" };
    }

    void openExternalUrl(url)
      .then(async (result) => {
        if (result.success) {
          return;
        }

        safeWarn(`[Presenton] Failed to open external URL: ${result.message || "Unknown error"}`);
        await showOpenTargetErrorDialog({
          parent: mainWindow,
          title: "Could Not Open Link",
          message: "Presenton could not open this link in your browser.",
          detail: `${result.message || "No application is registered to open this link."}\n\n${url}`,
        });
      })
      .catch((error) => {
        safeWarn("[Presenton] Failed to handle external URL open:", error);
      });

    return { action: "deny" };
  });

  mainWindow.once("ready-to-show", () => {
    if (mainWindow.isDestroyed()) {
      return;
    }
    mainWindow.show();
    mainWindow.focus();
  });

};

function focusMainWindow(): void {
  const mainWindow = getLiveMainWindow();
  if (!mainWindow) {
    return;
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();
}

if (gotSingleInstanceLock) {
  app.on("second-instance", () => {
    focusMainWindow();
  });
}

async function startServers(fastApiPort: number, nextjsPort: number) {
  try {
    const appDataDir = getAppDataDir();
    const tempDir = getTempDir();
    const userConfigPath = getUserConfigPath();
    const disableAuthForElectron = resolveElectronDisableAuth();
    const imageMagickRuntime = resolveImageMagickRuntime();
    const exportPackageRoot = path.join(baseDir, "resources", "export");
    const exportConverterPath = resolveExportConverterPath(baseDir);
    const exportChromiumPath = await resolveLaunchableExportChromiumPath();
    const puppeteerCacheDir = path.join(getCacheDir(), "puppeteer");
    const puppeteerTempDir = path.join(tempDir, "puppeteer");
    await Promise.all([
      fs.promises.mkdir(puppeteerCacheDir, { recursive: true }),
      fs.promises.mkdir(puppeteerTempDir, { recursive: true }),
    ]);
    if (exportChromiumPath) {
      safeLog("[Presenton] Export Chromium runtime resolved:", exportChromiumPath);
    } else {
      safeWarn(
        "[Presenton] Export Chromium runtime was not found; Template Studio slide previews will fail until Chromium is installed."
      );
    }
    if (imageMagickRuntime) {
      safeLog("[Presenton] ImageMagick runtime resolved:", {
        source: imageMagickRuntime.source,
        binaryPath: imageMagickRuntime.binaryPath,
        homeDir: imageMagickRuntime.homeDir,
      });
    } else {
      safeWarn("[Presenton] ImageMagick runtime was not found; LiteParse image conversion will fail until it is bundled or installed.");
    }
    const fastApi = await startFastApiServer(
      fastapiDir,
      fastApiPort,
      {
        DEBUG: isDev ? "True" : "False",
        CAN_CHANGE_KEYS: process.env.CAN_CHANGE_KEYS,
        LLM: process.env.LLM,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        OPENAI_MODEL: process.env.OPENAI_MODEL,
        GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
        GOOGLE_MODEL: process.env.GOOGLE_MODEL,
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
        ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL,
        OLLAMA_URL: process.env.OLLAMA_URL,
        OLLAMA_MODEL: process.env.OLLAMA_MODEL,
        CUSTOM_LLM_URL: process.env.CUSTOM_LLM_URL,
        CUSTOM_LLM_API_KEY: process.env.CUSTOM_LLM_API_KEY,
        CUSTOM_MODEL: process.env.CUSTOM_MODEL,
        BEDROCK_REGION: process.env.BEDROCK_REGION,
        BEDROCK_API_KEY: process.env.BEDROCK_API_KEY,
        BEDROCK_AWS_ACCESS_KEY_ID: process.env.BEDROCK_AWS_ACCESS_KEY_ID,
        BEDROCK_AWS_SECRET_ACCESS_KEY: process.env.BEDROCK_AWS_SECRET_ACCESS_KEY,
        BEDROCK_AWS_SESSION_TOKEN: process.env.BEDROCK_AWS_SESSION_TOKEN,
        BEDROCK_PROFILE_NAME: process.env.BEDROCK_PROFILE_NAME,
        BEDROCK_MODEL: process.env.BEDROCK_MODEL,
        FIREWORKS_API_KEY: process.env.FIREWORKS_API_KEY,
        FIREWORKS_MODEL: process.env.FIREWORKS_MODEL,
        FIREWORKS_BASE_URL: process.env.FIREWORKS_BASE_URL,
        TOGETHER_API_KEY: process.env.TOGETHER_API_KEY,
        TOGETHER_MODEL: process.env.TOGETHER_MODEL,
        TOGETHER_BASE_URL: process.env.TOGETHER_BASE_URL,
        LMSTUDIO_BASE_URL: process.env.LMSTUDIO_BASE_URL,
        LMSTUDIO_API_KEY: process.env.LMSTUDIO_API_KEY,
        LMSTUDIO_MODEL: process.env.LMSTUDIO_MODEL,
        PEXELS_API_KEY: process.env.PEXELS_API_KEY,
        PIXABAY_API_KEY: process.env.PIXABAY_API_KEY,
        IMAGE_PROVIDER: process.env.IMAGE_PROVIDER,
        DISABLE_IMAGE_GENERATION: process.env.DISABLE_IMAGE_GENERATION,
        EXTENDED_REASONING: process.env.EXTENDED_REASONING,
        TOOL_CALLS: process.env.TOOL_CALLS,
        DISABLE_THINKING: process.env.DISABLE_THINKING,
        WEB_GROUNDING: process.env.WEB_GROUNDING,
        WEB_SEARCH_PROVIDER: process.env.WEB_SEARCH_PROVIDER,
        WEB_SEARCH_MAX_RESULTS: process.env.WEB_SEARCH_MAX_RESULTS,
        SEARXNG_BASE_URL: process.env.SEARXNG_BASE_URL,
        TAVILY_API_KEY: process.env.TAVILY_API_KEY,
        EXA_API_KEY: process.env.EXA_API_KEY,
        BRAVE_SEARCH_API_KEY: process.env.BRAVE_SEARCH_API_KEY,
        SERPER_API_KEY: process.env.SERPER_API_KEY,
        DATABASE_URL: process.env.DATABASE_URL,
        DISABLE_ANONYMOUS_TRACKING: process.env.DISABLE_ANONYMOUS_TRACKING,
        COMFYUI_URL: process.env.COMFYUI_URL,
        COMFYUI_WORKFLOW: process.env.COMFYUI_WORKFLOW,
        DALL_E_3_QUALITY: process.env.DALL_E_3_QUALITY,
        GPT_IMAGE_1_5_QUALITY: process.env.GPT_IMAGE_1_5_QUALITY,
        APP_DATA_DIRECTORY: appDataDir,
        TEMP_DIRECTORY: tempDir,
        USER_CONFIG_PATH: userConfigPath,
        MIGRATE_DATABASE_ON_STARTUP: "True",
        DISABLE_AUTH: disableAuthForElectron,
        ...buildImageMagickEnv(imageMagickRuntime),
        LITEPARSE_RUNNER_PATH: getLiteParseRunnerPath(),
        // Use Electron's embedded runtime for LiteParse so parsing does not
        // depend on a system-wide Node installation.
        LITEPARSE_NODE_BINARY: process.execPath,
        ELECTRON_RUN_AS_NODE: "1",
        EXPORT_PACKAGE_ROOT: exportPackageRoot,
        EXPORT_RUNTIME_DIR: exportPackageRoot,
        PUPPETEER_CACHE_DIR: puppeteerCacheDir,
        PUPPETEER_TMP_DIR: puppeteerTempDir,
        ...(exportChromiumPath && {
          PUPPETEER_EXECUTABLE_PATH: exportChromiumPath,
        }),
        ...(exportConverterPath && {
          BUILT_PYTHON_MODULE_PATH: exportConverterPath,
        }),
      },
      isDev,
    );
    fastApiServer = fastApi;
    await fastApi.ready;

    const nextjs = await startNextJsServer(
      nextjsDir,
      nextjsPort,
      {
        NEXT_PUBLIC_FAST_API: process.env.NEXT_PUBLIC_FAST_API,
        TEMP_DIRECTORY: process.env.TEMP_DIRECTORY,
        NEXT_PUBLIC_URL: process.env.NEXT_PUBLIC_URL,
        NEXT_PUBLIC_USER_CONFIG_PATH: process.env.NEXT_PUBLIC_USER_CONFIG_PATH,
        USER_CONFIG_PATH: process.env.NEXT_PUBLIC_USER_CONFIG_PATH,
        APP_DATA_DIRECTORY: appDataDir,
        DISABLE_AUTH: disableAuthForElectron,
        EXPORT_PACKAGE_ROOT: exportPackageRoot,
        PRESENTON_APP_ROOT: baseDir,
        ...(exportConverterPath && {
          BUILT_PYTHON_MODULE_PATH: exportConverterPath,
        }),
      },
      isDev,
    );
    nextjsServer = nextjs;
    await nextjs.ready;
  } catch (error) {
    safeError("Server startup error:", error);
  }
}

async function stopServers() {
  const fastApi = fastApiServer;
  const nextjs = nextjsServer;
  fastApiServer = undefined;
  nextjsServer = undefined;

  await Promise.all([
    fastApi
      ? fastApi.stop().catch((error) => safeError("Failed to stop FastAPI:", error))
      : Promise.resolve(),
    nextjs
      ? nextjs.stop().catch((error) => safeError("Failed to stop NextJS:", error))
      : Promise.resolve(),
  ]);
}

async function forceQuitApp(exitCode = 0) {
  if (isStopping) return;
  isStopping = true;
  globalShortcut.unregisterAll();
  stopUpdateChecker();
  try {
    await stopActiveExportProcesses();
    await stopServers();
  } finally {
    app.exit(exitCode);
  }
}

if (gotSingleInstanceLock) {
app.whenReady().then(async () => {
  const disableAuthForElectron = resolveElectronDisableAuth();
  process.env.DISABLE_AUTH = disableAuthForElectron;
  process.env.ELECTRON_DISABLE_AUTH = disableAuthForElectron;

  // Ensure all required directories exist before starting
  ensureDirectoriesExist();

  await finishChromiumCacheRecovery(
    electronAppPaths.userDataDir,
    chromiumCacheRecovery,
  );
  updateSentryRuntimeContext(chromiumCacheRecovery);

  // Create main window and show the launch page while local servers boot.
  createWindow();
  const initialWindow = getLiveMainWindow();
  if (initialWindow && !initialWindow.webContents.isDestroyed()) {
    void initialWindow
      .loadFile(path.join(baseDir, "resources/ui/homepage/index.html"))
      .catch((error) => {
        if (!initialWindow.isDestroyed()) {
          safeWarn("[Presenton] Failed to load startup page", error);
        }
      });
  }

  // Ensure the launch screen stays visible and focused during the server boot.
  const launchWindow = getLiveMainWindow();
  launchWindow?.show();
  launchWindow?.focus();

  try {
    setUserConfig({
      CAN_CHANGE_KEYS: process.env.CAN_CHANGE_KEYS,
      LLM: process.env.LLM,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      OPENAI_MODEL: process.env.OPENAI_MODEL,
      GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
      GOOGLE_MODEL: process.env.GOOGLE_MODEL,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL,
      OLLAMA_URL: process.env.OLLAMA_URL,
      OLLAMA_MODEL: process.env.OLLAMA_MODEL,
      CUSTOM_LLM_URL: process.env.CUSTOM_LLM_URL,
      CUSTOM_LLM_API_KEY: process.env.CUSTOM_LLM_API_KEY,
      CUSTOM_MODEL: process.env.CUSTOM_MODEL,
      BEDROCK_REGION: process.env.BEDROCK_REGION,
      BEDROCK_API_KEY: process.env.BEDROCK_API_KEY,
      BEDROCK_AWS_ACCESS_KEY_ID: process.env.BEDROCK_AWS_ACCESS_KEY_ID,
      BEDROCK_AWS_SECRET_ACCESS_KEY: process.env.BEDROCK_AWS_SECRET_ACCESS_KEY,
      BEDROCK_AWS_SESSION_TOKEN: process.env.BEDROCK_AWS_SESSION_TOKEN,
      BEDROCK_PROFILE_NAME: process.env.BEDROCK_PROFILE_NAME,
      BEDROCK_MODEL: process.env.BEDROCK_MODEL,
      FIREWORKS_API_KEY: process.env.FIREWORKS_API_KEY,
      FIREWORKS_MODEL: process.env.FIREWORKS_MODEL,
      FIREWORKS_BASE_URL: process.env.FIREWORKS_BASE_URL,
      TOGETHER_API_KEY: process.env.TOGETHER_API_KEY,
      TOGETHER_MODEL: process.env.TOGETHER_MODEL,
      TOGETHER_BASE_URL: process.env.TOGETHER_BASE_URL,
      LMSTUDIO_BASE_URL: process.env.LMSTUDIO_BASE_URL,
      LMSTUDIO_API_KEY: process.env.LMSTUDIO_API_KEY,
      LMSTUDIO_MODEL: process.env.LMSTUDIO_MODEL,
      PEXELS_API_KEY: process.env.PEXELS_API_KEY,
      PIXABAY_API_KEY: process.env.PIXABAY_API_KEY,
      IMAGE_PROVIDER: process.env.IMAGE_PROVIDER,
      DISABLE_IMAGE_GENERATION: process.env.DISABLE_IMAGE_GENERATION,
      EXTENDED_REASONING: process.env.EXTENDED_REASONING,
      TOOL_CALLS: process.env.TOOL_CALLS,
      DISABLE_THINKING: process.env.DISABLE_THINKING,
      WEB_GROUNDING: process.env.WEB_GROUNDING,
      WEB_SEARCH_PROVIDER: process.env.WEB_SEARCH_PROVIDER,
      WEB_SEARCH_MAX_RESULTS: process.env.WEB_SEARCH_MAX_RESULTS,
      SEARXNG_BASE_URL: process.env.SEARXNG_BASE_URL,
      TAVILY_API_KEY: process.env.TAVILY_API_KEY,
      EXA_API_KEY: process.env.EXA_API_KEY,
      BRAVE_SEARCH_API_KEY: process.env.BRAVE_SEARCH_API_KEY,
      SERPER_API_KEY: process.env.SERPER_API_KEY,
      DATABASE_URL: process.env.DATABASE_URL,
      DISABLE_ANONYMOUS_TRACKING: process.env.DISABLE_ANONYMOUS_TRACKING,
      COMFYUI_URL: process.env.COMFYUI_URL,
      COMFYUI_WORKFLOW: process.env.COMFYUI_WORKFLOW,
      DALL_E_3_QUALITY: process.env.DALL_E_3_QUALITY,
      GPT_IMAGE_1_5_QUALITY: process.env.GPT_IMAGE_1_5_QUALITY,
    })
  } catch (error) {
    safeWarn("[Presenton] Failed to persist startup user config", error);
  }

  const [fastApiPort, nextjsPort] = await findUnusedPorts();
  safeLog(`FastAPI port: ${fastApiPort}, NextJS port: ${nextjsPort}`);

  //? Setup environment variables to be used in the preloads
  setupEnv(fastApiPort, nextjsPort);
  setupIpcHandlers();

  await startServers(fastApiPort, nextjsPort);
  if (isStopping) {
    return;
  }
  const mainWindow = getLiveMainWindow();
  if (!mainWindow || mainWindow.webContents.isDestroyed()) {
    return;
  }

  try {
    const appPath = isDisableAuthEnabledValue(process.env.DISABLE_AUTH)
      ? "/upload"
      : "";
    await mainWindow.loadURL(`${localhost}:${nextjsPort}${appPath}`);
  } catch (error) {
    if (mainWindow.isDestroyed()) {
      return;
    }
    safeWarn("[Presenton] Failed to load application URL", error);
    return;
  }

  // Begin polling the version server for available updates
  const updateWindow = getLiveMainWindow();
  if (updateWindow && !updateWindow.webContents.isDestroyed()) {
    safeStderrWrite("[Presenton] Starting update checker...\n");
    startUpdateChecker(updateWindow);
  }
});

app.on("window-all-closed", async () => {
  await forceQuitApp(0);
});

app.on("before-quit", async (event) => {
  if (isStopping) return;
  event.preventDefault();
  await forceQuitApp(0);
});

app.on("will-quit", async (event) => {
  if (isStopping) return;
  event.preventDefault();
  await forceQuitApp(0);
});
}
