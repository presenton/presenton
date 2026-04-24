import path from "path";
import os from "os";
import fs from "fs/promises";
import { spawn } from "child_process";
import { sanitizeFilename } from "@/app/(presentation-generator)/utils/others";

/** Repo `presentation-export/` at app root (`/app/presentation-export` in Docker). */
export function getExportPackageRoot(): string {
  return (
    process.env.EXPORT_PACKAGE_ROOT?.trim() ||
    path.join(process.cwd(), "..", "..", "presentation-export")
  );
}

export function getPresentonAppRoot(): string {
  return (
    process.env.PRESENTON_APP_ROOT?.trim() ||
    path.join(process.cwd(), "..", "..")
  );
}

async function resolveExportEntrypoint(exportRoot: string): Promise<string> {
  const indexCjs = path.join(exportRoot, "index.cjs");
  const indexJs = path.join(exportRoot, "index.js");

  try {
    await fs.access(indexCjs);
    return indexCjs;
  } catch {
    await fs.access(indexJs);
    await fs.copyFile(indexJs, indexCjs);
    return indexCjs;
  }
}

function bundledConverterPath(exportRoot: string): string {
  const fromEnv = process.env.BUILT_PYTHON_MODULE_PATH?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  if (process.platform === "linux" && process.arch === "x64") {
    return path.join(exportRoot, "py", "convert-linux-x64");
  }
  throw new Error(
    `No bundled export converter for ${process.platform}/${process.arch}. Set BUILT_PYTHON_MODULE_PATH.`
  );
}

export async function bundledExportPackageAvailable(): Promise<boolean> {
  try {
    const root = getExportPackageRoot();
    await resolveExportEntrypoint(root);
    await fs.access(bundledConverterPath(root));
    return true;
  } catch {
    return false;
  }
}

export type BundledPdfExportResult = { path: string };

function normalizeExportOutputPath(params: {
  pathValue?: string;
  urlValue?: string;
}): string {
  const { pathValue, urlValue } = params;
  const appData = process.env.APP_DATA_DIRECTORY?.trim();

  const resolveAppDataRelative = (value: string): string => {
    if (!appData) {
      throw new Error("APP_DATA_DIRECTORY is required for relative export paths.");
    }

    const normalized = value.startsWith("/") ? value.slice(1) : value;
    if (!normalized.startsWith("app_data/")) {
      return path.join(appData, normalized);
    }
    return path.join(appData, normalized.slice("app_data/".length));
  };

  if (pathValue && typeof pathValue === "string") {
    if (path.isAbsolute(pathValue)) {
      return pathValue;
    }
    return resolveAppDataRelative(pathValue);
  }

  if (urlValue && typeof urlValue === "string") {
    if (urlValue.startsWith("file://")) {
      const parsed = new URL(urlValue);
      const fsPath = decodeURIComponent(parsed.pathname || "");
      if (fsPath.startsWith("/app_data/")) {
        return resolveAppDataRelative(fsPath);
      }
      if (path.isAbsolute(fsPath)) {
        return fsPath;
      }
      return resolveAppDataRelative(fsPath);
    }

    if (urlValue.startsWith("/app_data/")) {
      return resolveAppDataRelative(urlValue);
    }
  }

  throw new Error("Export finished but response did not include a valid output path.");
}

/**
 * Runs the bundled export entrypoint (`presentation-export/index.js`) with
 * `BUILT_PYTHON_MODULE_PATH` pointing at the PyInstaller converter binary.
 */
export async function runBundledPdfExport(params: {
  presentationId: string;
  title: string | undefined;
}): Promise<BundledPdfExportResult> {
  const { presentationId, title } = params;
  const exportRoot = getExportPackageRoot();
  const entrypoint = await resolveExportEntrypoint(exportRoot);
  const converter = bundledConverterPath(exportRoot);
  const appRoot = getPresentonAppRoot();

  await fs.access(converter);

  const nextjsUrl =
    process.env.NEXT_PUBLIC_URL?.trim() || "http://127.0.0.1";
  const q = new URLSearchParams({ id: presentationId });
  const fastapiUrl = process.env.NEXT_PUBLIC_FAST_API?.trim();
  if (fastapiUrl) {
    q.set("fastapiUrl", fastapiUrl);
  }
  const pptUrl = `${nextjsUrl}/pdf-maker?${q.toString()}`;

  const tempBase =
    process.env.TEMP_DIRECTORY?.trim() || path.join(os.tmpdir(), "presenton");
  await fs.mkdir(tempBase, { recursive: true });
  const workDir = await fs.mkdtemp(path.join(tempBase, "export-"));
  const exportTaskPath = path.join(workDir, "export_task.json");

  const exportTask = {
    type: "export",
    url: pptUrl,
    format: "pdf",
    title: sanitizeFilename(title ?? "presentation"),
    fastapiUrl: fastapiUrl || undefined,
  };

  await fs.writeFile(exportTaskPath, JSON.stringify(exportTask), "utf8");

  const responsePath = exportTaskPath.replace(/\.json$/i, ".response.json");

  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [entrypoint, exportTaskPath], {
      cwd: appRoot,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        BUILT_PYTHON_MODULE_PATH: converter,
      },
    });
    const stderr: Buffer[] = [];
    const stdout: Buffer[] = [];
    child.stderr?.on("data", (d) => stderr.push(d));
    child.stdout?.on("data", (d) => stdout.push(d));
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        const errText = Buffer.concat(stderr).toString("utf8").trim();
        const outText = Buffer.concat(stdout).toString("utf8").trim();
        reject(
          new Error(
            `Export process exited with code ${code}${errText ? `. ${errText}` : ""}${outText ? ` stdout: ${outText}` : ""}`
          )
        );
      }
    });
  });

  const responseRaw = await fs.readFile(responsePath, "utf8");
  const responseData = JSON.parse(responseRaw) as { path?: string; url?: string };

  const outPath = normalizeExportOutputPath({
    pathValue: responseData?.path,
    urlValue: responseData?.url,
  });

  return { path: outPath };
}
