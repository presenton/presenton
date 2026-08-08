#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { pathToFileURL } from "node:url";

import { convertTemplateData } from "./convert-template.mjs";

function usage() {
  return `Usage: node scripts/convert-presentation-template.mjs <presentation.json> [options]

Options:
  --output <path>       Output JSON path (default: overwrite the input)
  --app-data <dir>     App-data root (default: APP_DATA_DIRECTORY or ./app_data)
  --id <id>            Override the template id
  --name <name>        Override the template name
  --description <text> Override the template description
  --thumbnail <path>   Thumbnail URL or asset path to package
  --help                Show this help
`;
}

function parseArgs(argv) {
  const options = {};
  const valueOptions = new Map([
    ["--output", "output"],
    ["-o", "output"],
    ["--app-data", "appData"],
    ["--id", "id"],
    ["--name", "name"],
    ["--description", "description"],
    ["--thumbnail", "thumbnail"],
  ]);

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") return { help: true };
    const optionName = valueOptions.get(argument);
    if (optionName) {
      const value = argv[++index];
      if (!value) throw new Error(`${argument} requires a value`);
      options[optionName] = value;
      continue;
    }
    if (argument.startsWith("-")) throw new Error(`Unknown option: ${argument}`);
    if (options.input) throw new Error("Only one presentation JSON file may be provided");
    options.input = argument;
  }

  if (!options.input) throw new Error("A presentation JSON file is required");
  return { ...options, help: false };
}

function asObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}

function unwrapArray(value, wrapperKey, label) {
  const array = Array.isArray(value) ? value : value?.[wrapperKey];
  if (!Array.isArray(array)) {
    throw new Error(`${label} must be an array or contain an array at .${wrapperKey}`);
  }
  return array;
}

function firstNonEmptyString(...values) {
  return values.find((value) => typeof value === "string" && value.trim())?.trim();
}

function displayName(value) {
  return value
    .replaceAll(/[-_]+/g, " ")
    .replaceAll(/\b\w/g, (character) => character.toUpperCase());
}

function findVariant(mergedComponents, component) {
  const matches = [];
  for (let groupIndex = 0; groupIndex < mergedComponents.length; groupIndex += 1) {
    const variants = mergedComponents[groupIndex].variants;
    if (!Array.isArray(variants)) {
      throw new Error(
        `merged_components[${groupIndex}].variants must be an array`,
      );
    }
    for (let variantIndex = 0; variantIndex < variants.length; variantIndex += 1) {
      if (isDeepStrictEqual(variants[variantIndex], component)) {
        matches.push({ groupIndex, variantIndex });
      }
    }
  }
  return matches;
}

function uniqueGroupId(componentId, usedIds) {
  const base = firstNonEmptyString(componentId) ?? "component";
  if (!usedIds.has(base)) {
    usedIds.add(base);
    return base;
  }

  for (let suffix = 2; ; suffix += 1) {
    const suffixText = `_${suffix}`;
    const candidate = `${base.slice(0, 80 - suffixText.length)}${suffixText}`;
    if (!usedIds.has(candidate)) {
      usedIds.add(candidate);
      return candidate;
    }
  }
}

function takeComponentWithId(components, componentId) {
  const index = components.findIndex((component) => component?.id === componentId);
  if (index === -1) return null;
  return components.splice(index, 1)[0];
}

function assertSingleVariantMatch(matches, layoutId, componentId) {
  if (matches.length === 1) return matches[0];
  const reason = matches.length === 0 ? "was not found" : "is ambiguous";
  throw new Error(
    `Original component ${layoutId}/${componentId ?? "<no id>"} ${reason} in merged_components`,
  );
}

/**
 * Apply the editor's latest slides[].ui trees to the reusable layout and merged
 * component catalogs carried by a presentation-detail response.
 */
export function buildTemplateFromPresentation(rawPresentation, options = {}) {
  const raw = asObject(rawPresentation, "The presentation");
  const sourceLayouts = structuredClone(
    unwrapArray(raw.layout ?? raw.layouts, "layouts", "presentation.layout"),
  );
  const mergedComponents = structuredClone(
    unwrapArray(raw.merged_components, "components", "presentation.merged_components"),
  );
  const originalMergedComponents = structuredClone(mergedComponents);
  const removedVariant = Symbol("removed merged component variant");
  const slides = raw.slides == null ? [] : unwrapArray(raw.slides, "slides", "presentation.slides");
  const layoutIndexById = new Map();

  sourceLayouts.forEach((layout, index) => {
    asObject(layout, `presentation.layout.layouts[${index}]`);
    if (typeof layout.id !== "string" || !layout.id.trim()) {
      throw new Error(`presentation.layout.layouts[${index}].id must be a non-empty string`);
    }
    if (layoutIndexById.has(layout.id)) {
      throw new Error(`Duplicate source layout id: ${layout.id}`);
    }
    if (!Array.isArray(layout.components)) {
      throw new Error(`Layout ${layout.id}.components must be an array`);
    }
    layoutIndexById.set(layout.id, index);
  });

  mergedComponents.forEach((group, index) => {
    asObject(group, `presentation.merged_components.components[${index}]`);
    if (!Array.isArray(group.variants)) {
      throw new Error(
        `presentation.merged_components.components[${index}].variants must be an array`,
      );
    }
  });

  const editedLayoutBySourceId = new Map();
  for (let index = 0; index < slides.length; index += 1) {
    const slide = asObject(slides[index], `presentation.slides[${index}]`);
    if (slide.ui == null) continue;
    const ui = structuredClone(asObject(slide.ui, `presentation.slides[${index}].ui`));
    if (!Array.isArray(ui.components)) {
      throw new Error(`presentation.slides[${index}].ui.components must be an array`);
    }
    const sourceId = firstNonEmptyString(slide.layout, ui.id);
    if (!sourceId) {
      throw new Error(`presentation.slides[${index}] needs a layout id when ui is present`);
    }

    const existing = editedLayoutBySourceId.get(sourceId);
    if (existing && !isDeepStrictEqual(existing, ui)) {
      throw new Error(`Slides contain conflicting UI edits for layout ${sourceId}`);
    }
    editedLayoutBySourceId.set(sourceId, ui);
  }

  let updatedLayoutCount = 0;
  let updatedVariantCount = 0;
  let removedVariantCount = 0;
  let addedVariantCount = 0;

  for (const [sourceId, ui] of editedLayoutBySourceId) {
    const layoutIndex = layoutIndexById.get(sourceId);
    if (layoutIndex == null) {
      const newLayout = { ...ui, id: firstNonEmptyString(ui.id, sourceId) };
      sourceLayouts.push(newLayout);
      layoutIndexById.set(newLayout.id, sourceLayouts.length - 1);
      for (const component of newLayout.components) {
        if (findVariant(mergedComponents, component).length === 0) {
          mergedComponents.push({
            id: component.id,
            description: typeof component.description === "string" ? component.description : "",
            variants: [component],
          });
          addedVariantCount += 1;
        }
      }
      updatedLayoutCount += 1;
      continue;
    }

    const sourceLayout = sourceLayouts[layoutIndex];
    const remainingUiComponents = [...ui.components];
    for (const sourceComponent of sourceLayout.components) {
      const match = assertSingleVariantMatch(
        findVariant(originalMergedComponents, sourceComponent),
        sourceId,
        sourceComponent.id,
      );
      const editedComponent = takeComponentWithId(remainingUiComponents, sourceComponent.id);
      if (editedComponent) {
        mergedComponents[match.groupIndex].variants[match.variantIndex] = editedComponent;
        if (!isDeepStrictEqual(sourceComponent, editedComponent)) updatedVariantCount += 1;
      } else {
        // Keep catalog indexes stable while other source components are mapped
        // against the original catalog. Filtering happens after all UI edits.
        mergedComponents[match.groupIndex].variants[match.variantIndex] = removedVariant;
        removedVariantCount += 1;
      }
    }

    for (const addedComponent of remainingUiComponents) {
      if (findVariant(mergedComponents, addedComponent).length > 0) continue;
      mergedComponents.push({
        id: addedComponent.id,
        description:
          typeof addedComponent.description === "string" ? addedComponent.description : "",
        variants: [addedComponent],
      });
      addedVariantCount += 1;
    }

    sourceLayouts[layoutIndex] = { ...sourceLayout, ...ui };
    if (!isDeepStrictEqual(sourceLayout, sourceLayouts[layoutIndex])) updatedLayoutCount += 1;
  }

  const nonEmptyMergedComponents = mergedComponents
    .map((group) => ({
      ...group,
      variants: group.variants.filter((variant) => variant !== removedVariant),
    }))
    .filter((group) => group.variants.length > 0);
  const usedGroupIds = new Set();
  for (const group of nonEmptyMergedComponents) {
    group.id = uniqueGroupId(group.id, usedGroupIds);
  }

  // A valid final catalog must contain every component from every final layout.
  for (const layout of sourceLayouts) {
    for (const component of layout.components) {
      const matches = findVariant(nonEmptyMergedComponents, component);
      if (matches.length === 0) {
        throw new Error(
          `Final component ${layout.id}/${component.id ?? "<no id>"} is missing from merged_components`,
        );
      }
    }
  }

  const outputDirectoryName = path.basename(
    path.dirname(path.resolve(options.output ?? options.input ?? ".")),
  );
  const previewImages = Array.isArray(raw.assets?.slide_image_urls)
    ? raw.assets.slide_image_urls
    : [];
  const id = firstNonEmptyString(options.id, raw.template_id, raw.id, outputDirectoryName);
  const name = firstNonEmptyString(options.name, raw.name, displayName(outputDirectoryName), id);

  return {
    template: {
      id,
      name,
      description:
        options.description ?? (typeof raw.description === "string" ? raw.description : ""),
      thumbnail: firstNonEmptyString(options.thumbnail, raw.thumbnail, ...previewImages) ?? "",
      merged_components: nonEmptyMergedComponents,
      layouts: sourceLayouts,
      fonts:
        raw.assets?.fonts &&
        typeof raw.assets.fonts === "object" &&
        !Array.isArray(raw.assets.fonts)
          ? raw.assets.fonts
          : raw.fonts && typeof raw.fonts === "object" && !Array.isArray(raw.fonts)
            ? raw.fonts
            : {},
    },
    stats: {
      updatedLayoutCount,
      updatedVariantCount,
      removedVariantCount,
      addedVariantCount,
    },
  };
}

export async function convertPresentationTemplate({
  input,
  output = input,
  appData,
  ...metadata
} = {}) {
  if (!input) throw new Error("input is required");
  const inputPath = path.resolve(input);
  const outputPath = path.resolve(output);
  const raw = JSON.parse(await readFile(inputPath, "utf8"));
  const { template, stats } = buildTemplateFromPresentation(raw, {
    ...metadata,
    input: inputPath,
    output: outputPath,
  });
  const result = await convertTemplateData({
    raw: template,
    input: inputPath,
    output: outputPath,
    appData,
  });
  return { ...result, ...stats };
}

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(usage());
      return;
    }
    const result = await convertPresentationTemplate(options);
    const editSummary =
      `Applied UI edits to ${result.updatedLayoutCount} layout(s), ` +
      `updated ${result.updatedVariantCount} merged variant(s), ` +
      `removed ${result.removedVariantCount}, and added ${result.addedVariantCount}.\n`;
    process.stdout.write(
      `Converted ${result.outputPath}\n` +
        editSummary +
        `Packaged ${result.assetCount} referenced asset(s).\n`,
    );
  } catch (error) {
    process.stderr.write(`Presentation template conversion failed: ${error.message}\n\n${usage()}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  await main();
}
