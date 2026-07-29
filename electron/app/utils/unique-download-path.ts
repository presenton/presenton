import fs from "fs";
import path from "path";

export function buildCandidateDownloadPath(
  directory: string,
  fileName: string,
  attempt: number,
): string {
  if (attempt <= 0) {
    return path.join(directory, fileName);
  }

  const extension = path.extname(fileName);
  const stem = path.basename(fileName, extension);
  return path.join(directory, `${stem} (${attempt})${extension}`);
}

export async function allocateUniqueDownloadPath(
  directory: string,
  fileName: string,
  maxAttempts: number = 10_000,
): Promise<string> {
  const safeName = path.basename(fileName);
  if (!safeName || safeName === "." || safeName === "..") {
    throw new Error("Invalid export file name");
  }

  await fs.promises.mkdir(directory, { recursive: true });

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = buildCandidateDownloadPath(directory, safeName, attempt);
    try {
      const handle = await fs.promises.open(candidate, "wx");
      await handle.close();
      return candidate;
    } catch (error: any) {
      if (error?.code === "EEXIST") {
        continue;
      }
      throw error;
    }
  }

  throw new Error(`Unable to allocate a unique download path for ${safeName}`);
}

async function removeQuietly(filePath: string): Promise<void> {
  try {
    await fs.promises.unlink(filePath);
  } catch {
    // Best-effort cleanup for reserved or partial destinations.
  }
}

/**
 * Move `sourcePath` into Downloads without clobbering an existing file.
 * Reserves a unique destination with O_EXCL, then replaces that placeholder
 * with the export contents (copy+unlink so Windows and POSIX behave the same).
 */
export async function moveExportToDownloads(
  sourcePath: string,
  downloadsDirectory: string,
  preferredFileName: string,
): Promise<string> {
  const destinationPath = await allocateUniqueDownloadPath(
    downloadsDirectory,
    preferredFileName,
  );

  try {
    await fs.promises.copyFile(sourcePath, destinationPath);
    await fs.promises.unlink(sourcePath);
    return destinationPath;
  } catch (error) {
    await removeQuietly(destinationPath);
    throw error;
  }
}
