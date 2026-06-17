import fs from "fs";
import path from "path";
import { getAppDataDir, getTempDir } from "./constants";

export class LocalFileAccessError extends Error {
  constructor(
    message: string,
    public readonly code: "INVALID_PATH" | "NOT_FOUND" | "ACCESS_DENIED",
  ) {
    super(message);
    this.name = "LocalFileAccessError";
  }
}

function resolveBaseDir(baseDir: string): string {
  const resolvedBaseDir = path.resolve(baseDir);
  try {
    return fs.realpathSync(resolvedBaseDir);
  } catch {
    return resolvedBaseDir;
  }
}

function allowedReadableFileBaseDirs(): string[] {
  return [getAppDataDir(), getTempDir()].map(resolveBaseDir);
}

function assertPathAllowed(candidatePath: string, baseDirs: string[]): void {
  for (const baseDir of baseDirs) {
    if (candidatePath === baseDir || candidatePath.startsWith(`${baseDir}${path.sep}`)) {
      return;
    }
  }

  throw new LocalFileAccessError(
    "Access denied: File path not allowed",
    "ACCESS_DENIED",
  );
}

export function resolveReadableLocalFile(filePath: unknown): string {
  if (typeof filePath !== "string" || filePath.trim().length === 0) {
    throw new LocalFileAccessError("Invalid file path", "INVALID_PATH");
  }

  const requestedPath = path.resolve(filePath);
  const allowedBaseDirs = allowedReadableFileBaseDirs();
  assertPathAllowed(requestedPath, allowedBaseDirs);


  let resolvedPath: string;
  try {
    resolvedPath = fs.realpathSync(requestedPath);
  } catch {
    throw new LocalFileAccessError("File not found", "NOT_FOUND");
  }

  assertPathAllowed(resolvedPath, allowedBaseDirs);
  return resolvedPath;
}

export function readReadableLocalFile(filePath: unknown): string {
  if (typeof filePath !== "string" || filePath.trim().length === 0) {
    throw new LocalFileAccessError("Invalid file path", "INVALID_PATH");
  }

  const requestedPath = path.resolve(filePath);
  const [appDataDir, tempDir] = allowedReadableFileBaseDirs();

  if (!(requestedPath.startsWith(appDataDir) || requestedPath.startsWith(tempDir))) {
    throw new LocalFileAccessError(
      "Access denied: File path not allowed",
      "ACCESS_DENIED",
    );
  }

  let resolvedPath: string;
  try {
    resolvedPath = fs.realpathSync(requestedPath);
  } catch {
    throw new LocalFileAccessError("File not found", "NOT_FOUND");
  }

  if (!(resolvedPath.startsWith(appDataDir) || resolvedPath.startsWith(tempDir))) {
    throw new LocalFileAccessError(
      "Access denied: File path not allowed",
      "ACCESS_DENIED",
    );
  }
  assertPathAllowed(resolvedPath, [appDataDir, tempDir]);

  return fs.readFileSync(resolvedPath, "utf-8");
}
