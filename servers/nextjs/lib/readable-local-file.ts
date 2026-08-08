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

type FileOwnerScope = {
  userId: string | null;
  isAdmin: boolean;
};

function allowedReadableFileBaseDirs(scope?: FileOwnerScope): string[] {
  const appDataDirectory =
    process.env.APP_DATA_DIRECTORY?.trim() || "/app/user_data";
  const tempDirectory =
    process.env.TEMP_DIRECTORY?.trim() || path.join(os.tmpdir(), "presenton");

  if (scope?.userId) {
    const userId = scope.userId;
    const userRoots = [
      "images",
      "uploads",
      "exports",
      "pptx-to-html",
      "pptx-to-json",
    ].map((directory) =>
      path.join(appDataDirectory, directory, "users", userId)
    );
    const sharedRoots = [
      path.join(appDataDirectory, "fonts"),
      path.join(appDataDirectory, "templates"),
    ];
    const legacyAdminRoots = scope.isAdmin
      ? [
          path.join(appDataDirectory, "images"),
          path.join(appDataDirectory, "uploads"),
          path.join(appDataDirectory, "exports"),
          path.join(appDataDirectory, "pptx-to-html"),
          path.join(appDataDirectory, "pptx-to-json"),
          tempDirectory,
        ]
      : [];
    return [
      ...userRoots,
      path.join(tempDirectory, userId),
      ...sharedRoots,
      ...legacyAdminRoots,
    ].map(resolveBaseDir);
  }

  return [appDataDirectory, tempDirectory].map(resolveBaseDir);
}

function assertNotAnotherUsersFile(
  candidatePath: string,
  scope?: FileOwnerScope,
): void {
  if (!scope?.userId) return;
  const normalizedParts = path.resolve(candidatePath).split(path.sep);
  const usersIndex = normalizedParts.lastIndexOf("users");
  if (
    usersIndex >= 0 &&
    normalizedParts[usersIndex + 1] &&
    normalizedParts[usersIndex + 1] !== scope.userId
  ) {
    throw new LocalFileAccessError("Access denied: File belongs to another user", 403);
  }
}

function assertPathAllowed(candidatePath: string, baseDirs: string[]): void {
  for (const baseDir of baseDirs) {
    if (candidatePath === baseDir || candidatePath.startsWith(`${baseDir}${path.sep}`)) {
      return;
    }
  }

  throw new LocalFileAccessError("Access denied: File path not allowed", 403);
}

export function resolveReadableLocalFile(
  filePath: unknown,
  scope?: FileOwnerScope,
): string {
  if (typeof filePath !== "string" || filePath.trim().length === 0) {
    throw new LocalFileAccessError("Invalid file path", 400);
  }

  const requestedPath = path.resolve(filePath);
  const allowedBaseDirs = allowedReadableFileBaseDirs(scope);
  assertNotAnotherUsersFile(requestedPath, scope);
  assertPathAllowed(requestedPath, allowedBaseDirs);


  let resolvedPath: string;
  try {
    resolvedPath = fs.realpathSync(requestedPath);
  } catch {
    throw new LocalFileAccessError("File not found", 404);
  }

  assertNotAnotherUsersFile(resolvedPath, scope);
  assertPathAllowed(resolvedPath, allowedBaseDirs);
  return resolvedPath;
}

export function readReadableLocalFile(
  filePath: unknown,
  scope?: FileOwnerScope,
): string {
  const resolvedPath = resolveReadableLocalFile(filePath, scope);

  // codeql[js/path-injection]
  return fs.readFileSync(resolvedPath, "utf-8");
}
