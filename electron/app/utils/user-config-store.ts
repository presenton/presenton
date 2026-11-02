import crypto from "crypto";
import fs from "fs";
import path from "path";
import { ensurePrivateDirectory, writePrivateFileSync } from "./private-storage";

type ConfigSnapshot<T extends object> = {
  config: T;
  primaryValid: boolean;
};

const LOCK_TIMEOUT_MS = 5000;
const LOCK_STALE_MS = 30000;
const RETRY_DELAY_MS = 50;
const MAX_IO_ATTEMPTS = 6;

function sleepSync(ms: number): void {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    // Keep lock acquisition synchronous without requiring newer lib typings.
  }
}

function isRetryableFsError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  return code === "EPERM" || code === "EBUSY" || code === "EACCES";
}

function retrySync<T>(label: string, operation: () => T): T {
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_IO_ATTEMPTS; attempt += 1) {
    try {
      return operation();
    } catch (error) {
      lastError = error;
      if (!isRetryableFsError(error) || attempt === MAX_IO_ATTEMPTS - 1) {
        break;
      }
      sleepSync(RETRY_DELAY_MS * (attempt + 1));
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`Failed to ${label}: ${message}`);
}

function backupPath(configPath: string): string {
  return `${configPath}.bak`;
}

function lockPath(configPath: string): string {
  return `${configPath}.lock`;
}

function ensureParentDirectory(configPath: string): void {
  retrySync("create user config directory", () => {
    ensurePrivateDirectory(path.dirname(configPath));
  });
}

function readJsonIfValid<T extends object>(filePath: string): T | undefined {
  try {
    const content = retrySync(`read ${path.basename(filePath)}`, () =>
      fs.readFileSync(filePath, "utf8")
    );
    const trimmed = content.trim();
    if (!trimmed) {
      return undefined;
    }
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as T)
      : undefined;
  } catch {
    return undefined;
  }
}

function readSnapshot<T extends object>(configPath: string): ConfigSnapshot<T> {
  const primary = readJsonIfValid<T>(configPath);
  if (primary) {
    return { config: primary, primaryValid: true };
  }

  const backup = readJsonIfValid<T>(backupPath(configPath));
  return { config: backup ?? ({} as T), primaryValid: false };
}

function removeStaleLock(lockFilePath: string): void {
  try {
    const stat = fs.statSync(lockFilePath);
    if (Date.now() - stat.mtimeMs >= LOCK_STALE_MS) {
      retrySync("remove stale user config lock", () => {
        fs.unlinkSync(lockFilePath);
      });
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    if (code !== "ENOENT") {
      throw error;
    }
  }
}

function acquireLock(configPath: string): () => void {
  ensureParentDirectory(configPath);
  const lockFilePath = lockPath(configPath);
  const startedAt = Date.now();

  while (true) {
    try {
      const fd = fs.openSync(lockFilePath, "wx", 0o600);
      try {
        fs.writeSync(
          fd,
          JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() })
        );
      } finally {
        fs.closeSync(fd);
      }

      return () => {
        try {
          retrySync("release user config lock", () => {
            fs.unlinkSync(lockFilePath);
          });
        } catch (error) {
          const code = (error as NodeJS.ErrnoException | undefined)?.code;
          if (code !== "ENOENT") {
            console.warn("[Presenton] Failed to release user config lock", error);
          }
        }
      };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException | undefined)?.code;
      if (code !== "EEXIST" && !isRetryableFsError(error)) {
        throw error;
      }

      removeStaleLock(lockFilePath);
      if (Date.now() - startedAt >= LOCK_TIMEOUT_MS) {
        throw new Error(`Timed out waiting for user config lock: ${lockFilePath}`);
      }
      sleepSync(RETRY_DELAY_MS);
    }
  }
}

function writeFileDurably(filePath: string, content: string): void {
  const fd = retrySync(`open ${path.basename(filePath)} for writing`, () =>
    fs.openSync(filePath, "wx", 0o600)
  );
  try {
    retrySync(`write ${path.basename(filePath)}`, () => {
      fs.writeFileSync(fd, content, "utf8");
    });
    retrySync(`sync ${path.basename(filePath)}`, () => {
      fs.fsyncSync(fd);
    });
  } finally {
    fs.closeSync(fd);
  }
}

function copyBackupIfPossible(configPath: string, primaryValid: boolean): void {
  const configBackupPath = backupPath(configPath);

  try {
    if (primaryValid && fs.existsSync(configPath)) {
      retrySync("write user config backup", () => {
        writePrivateFileSync(configBackupPath, fs.readFileSync(configPath));
      });
    } else if (!fs.existsSync(configBackupPath) && fs.existsSync(configPath)) {
      retrySync("initialize user config backup", () => {
        writePrivateFileSync(configBackupPath, fs.readFileSync(configPath));
      });
    }
  } catch (error) {
    console.warn("[Presenton] Failed to update user config backup", error);
  }
}

function writeAtomicJson<T extends object>(
  configPath: string,
  config: T,
  primaryValid: boolean
): void {
  ensureParentDirectory(configPath);
  copyBackupIfPossible(configPath, primaryValid);

  const tempPath = `${configPath}.${process.pid}.${Date.now()}.${crypto
    .randomBytes(6)
    .toString("hex")}.tmp`;
  writeFileDurably(tempPath, JSON.stringify(config));

  try {
    retrySync("replace user config", () => {
      fs.renameSync(tempPath, configPath);
    });
    copyBackupIfPossible(configPath, false);
  } catch (error) {
    try {
      fs.unlinkSync(tempPath);
    } catch {
      /* Best-effort cleanup. */
    }
    throw error;
  }
}

export function readUserConfigFile<T extends object>(configPath: string): T {
  try {
    ensureParentDirectory(configPath);
    return readSnapshot<T>(configPath).config;
  } catch {
    return {} as T;
  }
}

export function updateUserConfigFile<T extends object>(
  configPath: string,
  update: (existingConfig: T) => T
): T {
  const releaseLock = acquireLock(configPath);
  try {
    const snapshot = readSnapshot<T>(configPath);
    const nextConfig = update({ ...snapshot.config });
    writeAtomicJson(configPath, nextConfig, snapshot.primaryValid);
    return nextConfig;
  } finally {
    releaseLock();
  }
}
