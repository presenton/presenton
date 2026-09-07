import fs from "node:fs/promises";
import path from "node:path";
import { runTask } from "@presenton/export-core";

/**
 * Модуль пост-обработки грузится живучим импортом: раннер копируется
 * sync-скриптом в presentation-export/runner.mjs, и относительный путь
 * зависит от того, откуда файл запущен (образ кладёт pptx-svg-fallback.mjs
 * рядом; локально он в scripts/). Если модуль не найден — пост-обработка
 * SVG отключается с warning, экспорт продолжается как раньше: ошибка
 * импорта не должна ронять сам экспорт (прод-инцидент ERR_MODULE_NOT_FOUND).
 */
async function loadSvgFallbackModule() {
  const candidates = ["./pptx-svg-fallback.mjs", "../scripts/pptx-svg-fallback.mjs"];
  let lastError;
  for (const candidate of candidates) {
    try {
      return await import(candidate);
    } catch (error) {
      lastError = error;
    }
  }
  console.warn(
    "[presentation-export] pptx-svg-fallback.mjs не найден — SVG-пост-обработка отключена:",
    lastError?.message,
  );
  return null;
}

/**
 * SVG-иконки export-core вшивает без растрового fallback (r:embed у blip
 * вырезается) — PowerPoint-вьюверы показывают «Не удалось отобразить
 * рисунок». Чиним: каждому svg-only blip'у добавляется PNG-копия.
 * Сбой пост-обработки не валит экспорт — файл отдаётся как есть.
 */
async function applySvgRasterFallback(normalizedResponse, task) {
  const pptxPath =
    task?.type === "export" && task?.format !== "pdf"
      ? (normalizedResponse.path ?? normalizedResponse.filePath)
      : undefined;
  if (!pptxPath || !pptxPath.toLowerCase().endsWith(".pptx")) return;

  try {
    const fallbackModule = await loadSvgFallbackModule();
    if (!fallbackModule) return;
    const { JSZip, sharp } = await fallbackModule.loadExportCoreDeps();
    const result = await fallbackModule.addSvgRasterFallbacks(pptxPath, {
      JSZip,
      // density подгоняем под размер иконки: 72dpi × (512 / базовая ширина),
      // чтобы PNG не мылился при масштабировании в PowerPoint
      rasterize: (svgText) => {
        const width = Number(svgText.match(/\bwidth="(\d+(?:\.\d+)?)/)?.[1] ?? 24);
        const density = Math.min(Math.max(Math.round((72 * 512) / Math.max(width, 1)), 72), 2400);
        return sharp(Buffer.from(svgText), { density }).png().toBuffer();
      },
      log: (message) => console.warn(`[presentation-export] ${message}`),
    });
    if (result.fixed > 0) {
      console.log(`[presentation-export] svg raster fallbacks added: ${result.fixed}`);
    }
  } catch (error) {
    console.warn("[presentation-export] svg fallback пост-обработка не удалась:", error);
  }
}

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
  const normalized = normalizeResponse(response);
  await applySvgRasterFallback(normalized, task);
  const responsePath = taskPath.replace(/\.json$/i, ".response.json");
  await fs.writeFile(responsePath, JSON.stringify(normalized), "utf8");
}

main().catch((error) => {
  console.error("[presentation-export]", error);
  process.exitCode = 1;
});
