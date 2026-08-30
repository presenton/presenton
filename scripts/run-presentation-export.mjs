import fs from "node:fs/promises";
import path from "node:path";
import { runTask } from "@presenton/export-core";

function parseCookieHeader(cookieHeader) {
  if (!cookieHeader) return undefined;

  const cookies = {};
  for (const item of cookieHeader.split(";")) {
    const separator = item.indexOf("=");
    if (separator <= 0) continue;
    const name = item.slice(0, separator).trim();
    if (!name) continue;
    cookies[name] = item.slice(separator + 1).trim();
  }
  return Object.keys(cookies).length > 0 ? cookies : undefined;
}

function buildModifyWindow(fastapiUrl) {
  const assetsBaseUrl = process.env.ASSETS_BASE_URL?.trim();
  if (!fastapiUrl && !assetsBaseUrl) return undefined;

  const runtimeConfig = JSON.stringify({
    ...(fastapiUrl ? { NEXT_PUBLIC_FAST_API: fastapiUrl } : {}),
    ...(assetsBaseUrl ? { ASSETS_BASE_URL: assetsBaseUrl } : {}),
  });

  return new Function(
    `const target = window; target.env = { ...(target.env ?? {}), ...${runtimeConfig} };`,
  );
}

function buildRunOptions(task, legacyTask) {
  const appDataDirectory = process.env.APP_DATA_DIRECTORY?.trim();
  const tempDirectory = process.env.TEMP_DIRECTORY?.trim();
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();
  const puppeteerCacheDirectory = process.env.PUPPETEER_CACHE_DIR?.trim();
  const fastapiUrl = legacyTask.fastapiUrl || process.env.NEXT_PUBLIC_FAST_API?.trim();
  const cookies = parseCookieHeader(legacyTask.cookieHeader);

  const outputDirectory = appDataDirectory
    ? task.type === "export" || task.type === "html-to-any"
      ? path.join(appDataDirectory, "exports")
      : appDataDirectory
    : undefined;

  const urlConfigs =
    cookies && typeof task.url === "string"
      ? [{ url: task.url, match: "origin", cookies }]
      : undefined;

  return {
    ...(outputDirectory ? { outputDirectory } : {}),
    ...(tempDirectory ? { tempDirectory } : {}),
    ...(executablePath ? { browserLaunchOptions: { executablePath } } : {}),
    ...(puppeteerCacheDirectory ? { puppeteerCacheDirectory } : {}),
    ...(urlConfigs ? { urlConfigs } : {}),
    ...(fastapiUrl || process.env.ASSETS_BASE_URL?.trim()
      ? { modifyWindow: buildModifyWindow(fastapiUrl) }
      : {}),
  };
}

function normalizeResponse(response) {
  if (typeof response === "string") {
    return { data: response };
  }
  if (response.type === "files") {
    return {
      ...response,
      paths: response.filePaths,
      file_paths: response.filePaths,
    };
  }
  return {
    ...response,
    path: response.filePath,
    file_path: response.filePath,
  };
}

async function main() {
  const taskPath = process.argv[2];
  if (!taskPath) {
    throw new Error("Usage: run-presentation-export.mjs <task.json>");
  }

  const rawTask = JSON.parse(await fs.readFile(taskPath, "utf8"));
  const {
    fastapiUrl,
    cookieHeader,
    slide_concurrency: _slideConcurrency,
    ...task
  } = rawTask;
  task.__taskFilePath = path.resolve(taskPath);

  const response = await runTask(
    task,
    buildRunOptions(task, { fastapiUrl, cookieHeader }),
  );
  const responsePath = taskPath.replace(/\.json$/i, ".response.json");
  await fs.writeFile(responsePath, JSON.stringify(normalizeResponse(response)), "utf8");
}

main().catch((error) => {
  console.error("[presentation-export]", error);
  process.exitCode = 1;
});
