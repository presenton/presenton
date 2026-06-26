import fs from "fs";
import os from "os";
import path from "path";

export class LocalFileAccessError extends Error {
  constructor(
    message: string,
    public readonly statusCode: 400 | 403 | 404,
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
  const appDataDirectory =
    process.env.APP_DATA_DIRECTORY?.trim() || "/app/user_data";
  const tempDirectory =
    process.env.TEMP_DIRECTORY?.trim() || path.join(os.tmpdir(), "presenton");

  return [appDataDirectory, tempDirectory].map(resolveBaseDir);
}

function assertPathAllowed(candidatePath: string, baseDirs: string[]): void {
  for (const baseDir of baseDirs) {
    if (candidatePath === baseDir || candidatePath.startsWith(`${baseDir}${path.sep}`)) {
      return;
    }
  }

  throw new LocalFileAccessError("Access denied: File path not allowed", 403);
}

export function resolveReadableLocalFile(filePath: unknown): string {
  if (typeof filePath !== "string" || filePath.trim().length === 0) {
    throw new LocalFileAccessError("Invalid file path", 400);
  }

  const requestedPath = path.resolve(filePath);
  const allowedBaseDirs = allowedReadableFileBaseDirs();
  assertPathAllowed(requestedPath, allowedBaseDirs);


  let resolvedPath: string;
  try {
    resolvedPath = fs.realpathSync(requestedPath);
  } catch {
    throw new LocalFileAccessError("File not found", 404);
  }

  assertPathAllowed(resolvedPath, allowedBaseDirs);
  return resolvedPath;
}

export function readReadableLocalFile(filePath: unknown): string {
  const resolvedPath = resolveReadableLocalFile(filePath);

  // codeql[js/path-injection]
  return fs.readFileSync(resolvedPath, "utf-8");
}
