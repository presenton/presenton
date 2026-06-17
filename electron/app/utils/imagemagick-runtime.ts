import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { resourceBaseDir } from "./constants";

export type ImageMagickRuntime = {
  binaryPath: string;
  binDir: string;
  homeDir: string;
  version: string;
  source: "bundled" | "system";
};

type ImageMagickRuntimeManifest = {
  version?: string;
  platform?: string;
  arch?: string;
  binary?: string;
  kind?: string;
};

const RUNTIME_MANIFEST_NAME = "presenton-runtime.json";

function runVersion(command: string, homeDir = path.dirname(command)): string | null {
  const result = spawnSync(command, ["-version"], {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
    timeout: 15000,
    env: {
      ...process.env,
      MAGICK_HOME: homeDir,
      MAGICK_CONFIGURE_PATH: homeDir,
      MAGICK_TEMPORARY_PATH: process.env.TEMP || process.env.TMPDIR || homeDir,
      MAGICK_OCL_DEVICE: "OFF",
      APPIMAGE_EXTRACT_AND_RUN: "1",
    },
    windowsHide: true,
  });

  if (result.status !== 0) {
    return null;
  }

  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
  return output.toLowerCase().includes("imagemagick") ? output : null;
}

function resolveCommandPath(command: string): string | null {
  if (path.isAbsolute(command)) {
    return command;
  }

  if (process.platform === "win32") {
    const result = spawnSync(
      "powershell.exe",
      ["-NoProfile", "-Command", `(Get-Command '${command}' -ErrorAction Stop).Source`],
      {
        stdio: ["ignore", "pipe", "pipe"],
        encoding: "utf8",
        windowsHide: true,
      },
    );
    const lines = (result.stdout ?? "").trim().split(/\r?\n/).filter(Boolean);
    const resolved = lines.length ? lines[lines.length - 1] : undefined;
    return result.status === 0 && resolved ? resolved : null;
  }

  const result = spawnSync("which", [command], {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });
  const resolved = (result.stdout ?? "").trim().split(/\r?\n/).filter(Boolean)[0];
  return result.status === 0 && resolved ? resolved : null;
}

function uniqueExistingDirs(paths: string[]): string[] {
  const seen = new Set<string>();
  const dirs: string[] = [];
  for (const candidate of paths) {
    if (!candidate || seen.has(candidate)) {
      continue;
    }
    seen.add(candidate);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      dirs.push(candidate);
    }
  }
  return dirs;
}

export function getBundledImageMagickRoot(): string {
  return path.join(resourceBaseDir, "resources", "imagemagick");
}

export function getBundledImageMagickDir(): string {
  return path.join(getBundledImageMagickRoot(), `${process.platform}-${process.arch}`);
}

function readBundledRuntimeManifest(): ImageMagickRuntimeManifest | null {
  const manifestPath = path.join(getBundledImageMagickDir(), RUNTIME_MANIFEST_NAME);
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as ImageMagickRuntimeManifest;
    if (
      manifest.platform &&
      manifest.platform !== process.platform
    ) {
      return null;
    }
    if (manifest.arch && manifest.arch !== process.arch) {
      return null;
    }
    return manifest;
  } catch {
    return null;
  }
}

function bundledBinaryCandidates(): string[] {
  const runtimeDir = getBundledImageMagickDir();
  const executable = process.platform === "win32" ? "magick.exe" : "magick";
  const manifest = readBundledRuntimeManifest();
  const manifestBinary = manifest?.binary
    ? [path.join(runtimeDir, manifest.binary)]
    : [];
  return [
    ...manifestBinary,
    path.join(runtimeDir, executable),
    path.join(runtimeDir, "bin", executable),
    path.join(getBundledImageMagickRoot(), executable),
    path.join(getBundledImageMagickRoot(), "bin", executable),
  ];
}

function systemBinaryCandidates(): string[] {
  if (process.platform === "win32") {
    return ["magick"];
  }
  return [
    "magick",
    "convert",
    "/opt/homebrew/bin/magick",
    "/usr/local/bin/magick",
    "/opt/local/bin/magick",
    "/usr/bin/magick",
    "/usr/local/bin/convert",
    "/usr/bin/convert",
  ];
}

function runtimeFromBinary(
  binaryPath: string,
  source: ImageMagickRuntime["source"],
): ImageMagickRuntime | null {
  const resolvedBinaryPath = resolveCommandPath(binaryPath) ?? binaryPath;
  const binDir = path.dirname(resolvedBinaryPath);
  const manifest = source === "bundled" ? readBundledRuntimeManifest() : null;
  const manifestRuntimeDir = getBundledImageMagickDir();
  const homeDir = source === "bundled" && manifest?.binary
    ? manifestRuntimeDir
    : path.basename(binDir).toLowerCase() === "bin"
    ? path.dirname(binDir)
    : binDir;
  const version = runVersion(resolvedBinaryPath, homeDir);
  if (!version) {
    return null;
  }

  return {
    binaryPath: resolvedBinaryPath,
    binDir,
    homeDir,
    version,
    source,
  };
}

export function resolveImageMagickRuntime(): ImageMagickRuntime | null {
  for (const candidate of bundledBinaryCandidates()) {
    if (fs.existsSync(candidate)) {
      const runtime = runtimeFromBinary(candidate, "bundled");
      if (runtime) {
        return runtime;
      }
    }
  }

  for (const candidate of systemBinaryCandidates()) {
    const runtime = runtimeFromBinary(candidate, "system");
    if (runtime) {
      return runtime;
    }
  }

  return null;
}

export function buildPathWithImageMagick(runtime: ImageMagickRuntime): string {
  const currentPath = process.env.Path ?? process.env.PATH ?? "";
  return uniqueExistingDirs([runtime.binDir, currentPath])
    .concat(
      currentPath
        .split(path.delimiter)
        .map((entry) => entry.trim())
        .filter(Boolean)
        .filter((entry) => path.resolve(entry) !== path.resolve(runtime.binDir)),
    )
    .join(path.delimiter);
}
