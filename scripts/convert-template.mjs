#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rm,
  rmdir,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const TOP_LEVEL_KEYS = [
  "id",
  "name",
  "description",
  "thumbnail",
  "merged_components",
  "layouts",
  "fonts",
];

const REPLACEABLE_IMAGE = "/static/images/replaceable_template_image.png";
const ICON_PLACEHOLDER = "/static/icons/placeholder.svg";

function usage() {
  return `Usage: node scripts/convert-template.mjs <input.json> [options]

Options:
  --output <path>    Output JSON path (default: overwrite the input)
  --app-data <dir>  App-data root (default: APP_DATA_DIRECTORY or ./app_data)
  --help             Show this help
`;
}

function parseArgs(argv) {
  let input;
  let output;
  let appData;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") return { help: true };
    if (argument === "--output" || argument === "-o") {
      output = argv[++index];
      if (!output) throw new Error(`${argument} requires a path`);
      continue;
    }
    if (argument === "--app-data") {
      appData = argv[++index];
      if (!appData) throw new Error(`${argument} requires a directory`);
      continue;
    }
    if (argument.startsWith("-")) throw new Error(`Unknown option: ${argument}`);
    if (input) throw new Error("Only one input JSON file may be provided");
    input = argument;
  }

  if (!input) throw new Error("An input JSON file is required");
  return { input, output, appData, help: false };
}

function unwrapArray(value, wrapperKey, fieldName) {
  const unwrapped = Array.isArray(value) ? value : value?.[wrapperKey];
  if (!Array.isArray(unwrapped)) {
    throw new Error(
      `Top-level ${fieldName} must be an array or an object containing an array at .${wrapperKey}`,
    );
  }
  return unwrapped;
}

function firstNonEmptyString(...values) {
  return values.find((value) => typeof value === "string" && value.trim())?.trim();
}

function buildTargetShape(raw, outputPath) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("The input template must be a JSON object");
  }

  const id = firstNonEmptyString(raw.id, path.basename(path.dirname(outputPath)));
  const name = firstNonEmptyString(raw.name, id);
  const previewImages = Array.isArray(raw.assets?.slide_image_urls)
    ? raw.assets.slide_image_urls
    : [];
  const thumbnailSource = firstNonEmptyString(raw.thumbnail, ...previewImages) ?? "";
  const fonts =
    raw.assets?.fonts && typeof raw.assets.fonts === "object" && !Array.isArray(raw.assets.fonts)
      ? raw.assets.fonts
      : raw.fonts && typeof raw.fonts === "object" && !Array.isArray(raw.fonts)
        ? raw.fonts
        : {};

  return {
    template: {
      id,
      name,
      description: typeof raw.description === "string" ? raw.description : "",
      thumbnail: thumbnailSource,
      merged_components:
        raw.merged_components == null
          ? []
          : unwrapArray(raw.merged_components, "components", "merged_components"),
      layouts: unwrapArray(raw.layouts, "layouts", "layouts"),
      fonts,
    },
    thumbnailSource,
  };
}

function replaceEditableImages(value) {
  if (Array.isArray(value)) {
    return value.map(replaceEditableImages);
  }
  if (!value || typeof value !== "object") return value;

  const converted = Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, replaceEditableImages(child)]),
  );
  if (value.type !== "image") return converted;

  // Decorative images are part of the template design, including any image
  // that also happens to be marked as an icon. Keep their source so the asset
  // planner can bundle it and rewrite the path to the template's static folder.
  if (value.decorative === true) return converted;

  return {
    ...converted,
    data: value.is_icon === true ? ICON_PLACEHOLDER : REPLACEABLE_IMAGE,
  };
}

function collectStrings(value, result = new Set()) {
  if (typeof value === "string") {
    result.add(value);
  } else if (Array.isArray(value)) {
    for (const child of value) collectStrings(child, result);
  } else if (value && typeof value === "object") {
    for (const child of Object.values(value)) collectStrings(child, result);
  }
  return result;
}

function appDataRelativePath(value) {
  let pathname = value;
  try {
    pathname = decodeURIComponent(new URL(value).pathname);
  } catch {
    // Plain filesystem and template-relative paths are handled below.
  }

  const normalized = pathname.replaceAll("\\", "/");
  const marker = "/app_data/";
  if (normalized.startsWith(marker)) return normalized.slice(marker.length);
  if (normalized.startsWith("app_data/")) return normalized.slice("app_data/".length);
  return null;
}

function assertInside(root, candidate, label) {
  const relative = path.relative(root, candidate);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`${label} resolves outside ${root}`);
  }
}

async function isFile(filePath) {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

async function contentHash(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

async function resolveAsset(value, context) {
  const appDataRelative = appDataRelativePath(value);
  if (appDataRelative != null) {
    const source = path.resolve(context.appDataRoot, appDataRelative);
    assertInside(context.appDataRoot, source, value);
    return { source, preferredName: path.basename(source) };
  }

  if (value.startsWith("static/")) {
    const relative = value.slice("static/".length);
    const source = path.resolve(context.inputDirectory, "static", relative);
    assertInside(path.join(context.inputDirectory, "static"), source, value);
    return { source, preferredName: relative };
  }

  const absolute = path.resolve(value);
  if (path.isAbsolute(value) && absolute.startsWith(`${context.appDataRoot}${path.sep}`)) {
    return { source: absolute, preferredName: path.basename(absolute) };
  }

  return null;
}

async function planAssets(template, thumbnailSource, context) {
  const plans = new Map();
  const plansBySource = new Map();
  const claimedNames = new Map();

  for (const value of collectStrings(template)) {
    const asset = await resolveAsset(value, context);
    if (!asset) continue;
    if (!(await isFile(asset.source))) {
      throw new Error(`Referenced asset does not exist: ${asset.source} (from ${value})`);
    }

    const sourceKey = path.resolve(asset.source);
    const existing = plansBySource.get(sourceKey);
    if (existing) {
      plans.set(value, existing);
      continue;
    }

    let targetName =
      value === thumbnailSource
        ? `thumbnail${path.extname(asset.preferredName) || ".png"}`
        : asset.preferredName;
    targetName = targetName.replaceAll("\\", "/").replace(/^\/+/, "");
    assertInside(
      context.staticDirectory,
      path.resolve(context.staticDirectory, targetName),
      targetName,
    );

    const claimed = claimedNames.get(targetName);
    if (claimed && claimed.sourceKey !== sourceKey) {
      const extension = path.extname(targetName);
      const stem = extension ? targetName.slice(0, -extension.length) : targetName;
      targetName = `${stem}-${(await contentHash(asset.source)).slice(0, 12)}${extension}`;
    }

    const plan = {
      source: asset.source,
      sourceKey,
      target: path.resolve(context.staticDirectory, targetName),
      outputValue: `static/${targetName}`,
    };
    claimedNames.set(targetName, plan);
    plansBySource.set(sourceKey, plan);
    plans.set(value, plan);
  }

  return plans;
}

function rewriteStrings(value, plans) {
  if (typeof value === "string") return plans.get(value)?.outputValue ?? value;
  if (Array.isArray(value)) return value.map((child) => rewriteStrings(child, plans));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, rewriteStrings(child, plans)]),
    );
  }
  return value;
}

async function cleanStaticDirectory(directory, retainedTargets) {
  async function clean(currentDirectory) {
    let entries;
    try {
      entries = await readdir(currentDirectory, { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }

    for (const entry of entries) {
      const entryPath = path.join(currentDirectory, entry.name);
      if (entry.isDirectory()) {
        await clean(entryPath);
        try {
          await rmdir(entryPath);
        } catch (error) {
          if (error.code !== "ENOTEMPTY" && error.code !== "EEXIST") throw error;
        }
      } else if (!retainedTargets.has(path.resolve(entryPath))) {
        await rm(entryPath, { force: true });
      }
    }
  }

  await clean(directory);
}

export async function convertTemplateData({ raw, input, output = input, appData } = {}) {
  if (!input) throw new Error("input is required");
  if (raw === undefined) throw new Error("raw template data is required");

  const inputPath = path.resolve(input);
  const outputPath = path.resolve(output);
  const appDataRoot = path.resolve(
    appData ?? process.env.APP_DATA_DIRECTORY ?? path.join(process.cwd(), "app_data"),
  );
  const inputDirectory = path.dirname(inputPath);
  const outputDirectory = path.dirname(outputPath);
  const staticDirectory = path.join(outputDirectory, "static");
  const { template: targetShape, thumbnailSource } = buildTargetShape(raw, outputPath);
  const template = replaceEditableImages(targetShape);
  const plans = await planAssets(template, thumbnailSource, {
    appDataRoot,
    inputDirectory,
    staticDirectory,
  });
  const converted = rewriteStrings(template, plans);

  await mkdir(outputDirectory, { recursive: true });
  for (const plan of new Set(plans.values())) {
    await mkdir(path.dirname(plan.target), { recursive: true });
    if (path.resolve(plan.source) !== path.resolve(plan.target)) {
      await copyFile(plan.source, plan.target);
    }
  }
  await cleanStaticDirectory(
    staticDirectory,
    new Set([...plans.values()].map((plan) => path.resolve(plan.target))),
  );
  await writeFile(outputPath, `${JSON.stringify(converted, null, 2)}\n`, "utf8");

  return {
    outputPath,
    assetCount: new Set([...plans.values()].map((plan) => plan.target)).size,
    topLevelKeys: TOP_LEVEL_KEYS,
  };
}

export async function convertTemplate({ input, output = input, appData } = {}) {
  if (!input) throw new Error("input is required");

  const inputPath = path.resolve(input);
  const raw = JSON.parse(await readFile(inputPath, "utf8"));
  return convertTemplateData({ raw, input: inputPath, output, appData });
}

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(usage());
      return;
    }
    const result = await convertTemplate(options);
    process.stdout.write(
      `Converted ${result.outputPath}\nPackaged ${result.assetCount} referenced asset(s).\n`,
    );
  } catch (error) {
    process.stderr.write(`Template conversion failed: ${error.message}\n\n${usage()}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  await main();
}
