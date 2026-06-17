import { app } from "electron"
import path from "path"
import fs from "fs"
import os from "os"

export const localhost = "http://127.0.0.1"


export const isDev = !app.isPackaged;
export const baseDir = app.getAppPath();
export const resourceBaseDir =
  isDev || !baseDir.endsWith(".asar") ? baseDir : `${baseDir}.unpacked`;
export const fastapiDir = isDev
  ? path.resolve(baseDir, "..", "servers", "fastapi")
  : path.join(resourceBaseDir, "resources/fastapi");
export const nextjsDir = isDev
  ? path.resolve(baseDir, "..", "servers", "nextjs")
  : path.join(resourceBaseDir, "resources/nextjs");

const appDirectoryName = "Presenton Open Source";

export type ElectronAppPaths = {
  userDataDir: string;
  appDataDir: string;
  tempDir: string;
  logsDir: string;
  userConfigPath: string;
  cacheDir: string;
  crashDumpsDir: string;
  sessionDataDir: string;
};

let appPaths: ElectronAppPaths | undefined;
let downloadsDir: string | undefined;

function unique(paths: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const candidate of paths) {
    if (!candidate) continue;
    const resolved = path.resolve(candidate);
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    result.push(resolved);
  }

  return result;
}

function absoluteEnvPath(name: string): string | undefined {
  const value = process.env[name]?.trim();
  if (!value || !path.isAbsolute(value)) {
    return undefined;
  }
  return value;
}

function getHomeDir(): string | undefined {
  const envHome =
    absoluteEnvPath("HOME") ||
    absoluteEnvPath("USERPROFILE") ||
    (() => {
      const drive = process.env.HOMEDRIVE?.trim();
      const homePath = process.env.HOMEPATH?.trim();
      if (!drive || !homePath) return undefined;
      const candidate = `${drive}${homePath}`;
      return path.isAbsolute(candidate) ? candidate : undefined;
    })();

  if (envHome) {
    return envHome;
  }

  try {
    const home = os.homedir();
    return home && path.isAbsolute(home) ? home : undefined;
  } catch {
    return undefined;
  }
}

function electronPathCandidate(name: "temp" | "downloads" | "userData"): string | undefined {
  try {
    const candidate = app.getPath(name);
    return candidate && path.isAbsolute(candidate) ? candidate : undefined;
  } catch {
    return undefined;
  }
}

function canUseDirectory(dir: string): boolean {
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.accessSync(dir, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function firstWritableDirectory(candidates: string[], label: string): string {
  for (const candidate of candidates) {
    if (canUseDirectory(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `Unable to create a writable ${label} directory. Tried: ${candidates.join(", ")}`
  );
}

function getTempRoot(): string {
  const home = getHomeDir();
  return firstWritableDirectory(
    unique([
      absoluteEnvPath("TMPDIR"),
      absoluteEnvPath("TEMP"),
      absoluteEnvPath("TMP"),
      electronPathCandidate("temp"),
      (() => {
        try {
          const tmp = os.tmpdir();
          return tmp && path.isAbsolute(tmp) ? tmp : undefined;
        } catch {
          return undefined;
        }
      })(),
      process.platform === "win32" ? absoluteEnvPath("LOCALAPPDATA") : undefined,
      home ? path.join(home, ".cache") : undefined,
      process.platform === "win32" ? undefined : "/tmp",
    ]),
    "temporary root"
  );
}

function getAppDataBaseDir(tempRoot: string): string {
  const home = getHomeDir();
  const fallback = path.join(tempRoot, "presenton-app-data");

  if (process.platform === "win32") {
    return firstWritableDirectory(
      unique([
        absoluteEnvPath("APPDATA"),
        absoluteEnvPath("LOCALAPPDATA"),
        home ? path.join(home, "AppData", "Roaming") : undefined,
        fallback,
      ]),
      "app data"
    );
  }

  if (process.platform === "darwin") {
    return firstWritableDirectory(
      unique([
        home ? path.join(home, "Library", "Application Support") : undefined,
        fallback,
      ]),
      "app data"
    );
  }

  return firstWritableDirectory(
    unique([
      absoluteEnvPath("XDG_CONFIG_HOME"),
      home ? path.join(home, ".config") : undefined,
      fallback,
    ]),
    "app data"
  );
}

function resolveLinuxDownloadsDir(home: string | undefined): string | undefined {
  if (!home) {
    return undefined;
  }

  const userDirsPath = path.join(home, ".config", "user-dirs.dirs");
  try {
    const userDirs = fs.readFileSync(userDirsPath, "utf8");
    const match = userDirs.match(/^XDG_DOWNLOAD_DIR=(["']?)(.+)\1$/m);
    const rawValue = match?.[2]?.trim();
    if (!rawValue) {
      return undefined;
    }
    const expanded = rawValue.replace("$HOME", home);
    return path.isAbsolute(expanded) ? expanded : path.join(home, expanded);
  } catch {
    return undefined;
  }
}

function getDownloadsDirCandidate(userDataDir: string): string {
  const home = getHomeDir();
  const fallback = path.join(userDataDir, "exports");

  if (process.platform === "linux") {
    return firstWritableDirectory(
      unique([
        electronPathCandidate("downloads"),
        resolveLinuxDownloadsDir(home),
        home ? path.join(home, "Downloads") : undefined,
        fallback,
      ]),
      "downloads"
    );
  }

  return firstWritableDirectory(
    unique([
      electronPathCandidate("downloads"),
      home ? path.join(home, "Downloads") : undefined,
      fallback,
    ]),
    "downloads"
  );
}

function setElectronPath(name: string, dir: string): void {
  try {
    app.setPath(name, dir);
  } catch (error) {
    console.warn(`[Presenton] Failed to set Electron path ${name}=${dir}`, error);
  }
}

function appendDiskCacheSwitch(cacheDir: string): void {
  try {
    app.commandLine.appendSwitch("disk-cache-dir", cacheDir);
  } catch (error) {
    console.warn("[Presenton] Failed to configure Chromium disk cache path", error);
  }
}

export function initializeAppPaths(): ElectronAppPaths {
  if (appPaths) {
    return appPaths;
  }

  const tempRoot = getTempRoot();
  const appDataBaseDir = getAppDataBaseDir(tempRoot);
  const userDataDir = firstWritableDirectory(
    unique([
      electronPathCandidate("userData"),
      path.join(appDataBaseDir, appDirectoryName),
      path.join(tempRoot, "presenton-user-data"),
    ]),
    "user data"
  );
  const appDataDir = isDev
    ? firstWritableDirectory(
        unique([path.join(baseDir, "app_data"), path.join(userDataDir, "app_data")]),
        "application data"
      )
    : userDataDir;
  const tempDir = firstWritableDirectory(
    unique([path.join(tempRoot, "presenton"), path.join(userDataDir, "temp")]),
    "temporary"
  );
  const logsDir = firstWritableDirectory(
    unique([path.join(userDataDir, "logs"), path.join(tempDir, "logs")]),
    "logs"
  );
  const cacheDir = firstWritableDirectory(
    unique([path.join(userDataDir, "Cache"), path.join(tempDir, "Cache")]),
    "cache"
  );
  const crashDumpsDir = firstWritableDirectory(
    unique([path.join(userDataDir, "Crashpad"), path.join(tempDir, "Crashpad")]),
    "crash dumps"
  );
  const sessionDataDir = userDataDir;

  appPaths = {
    userDataDir,
    appDataDir,
    tempDir,
    logsDir,
    userConfigPath: path.join(userDataDir, "userConfig.json"),
    cacheDir,
    crashDumpsDir,
    sessionDataDir,
  };

  setElectronPath("userData", userDataDir);
  setElectronPath("sessionData", sessionDataDir);
  setElectronPath("temp", tempDir);
  setElectronPath("crashDumps", crashDumpsDir);
  setElectronPath("cache", cacheDir);
  appendDiskCacheSwitch(cacheDir);

  return appPaths;
}

export function ensureDirectoriesExist() {
  initializeAppPaths();
}

function getInitializedPaths(): ElectronAppPaths {
  return initializeAppPaths();
}

export function getUserDataDir(): string {
  return getInitializedPaths().userDataDir;
}

export function getAppDataDir(): string {
  return getInitializedPaths().appDataDir;
}

export function getTempDir(): string {
  return getInitializedPaths().tempDir;
}

export function getLogsDir(): string {
  return getInitializedPaths().logsDir;
}

export function getUserConfigPath(): string {
  return getInitializedPaths().userConfigPath;
}

export function getDownloadsDir(): string {
  if (!downloadsDir) {
    downloadsDir = getDownloadsDirCandidate(getUserDataDir());
  }
  return downloadsDir;
}

export function getCacheDir(): string {
  return getInitializedPaths().cacheDir;
}

export function getCrashDumpsDir(): string {
  return getInitializedPaths().crashDumpsDir;
}
