/**
 * Пост-обработка экспортного PPTX: растровый fallback для SVG-картинок.
 *
 * @presenton/export-core вшивает SVG-иконки как `<a:blip><a:extLst>
 * <asvg:svgBlip r:embed="rIdN"/>…</a:extLst></a:blip>` — БЕЗ `r:embed`
 * растровой копии. По спецификации OOXML основной blip обязан указывать на
 * растр; без него PowerPoint-вьюверы (мобильные, веб, старые десктопы)
 * показывают «Не удалось отобразить рисунок». Дефект есть во всех версиях
 * пакета (1.0.14–1.0.26), поэтому чиним у себя: каждому такому blip'у
 * добавляется PNG-копия соответствующего SVG (rasterize инжектится —
 * в раннере это sharp из deps export-core).
 *
 * Идемпотентно: blip'ы уже с `r:embed` не трогаются, повторный прогон — 0.
 */

import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

/**
 * jszip и sharp живут в node_modules пакета @presenton/export-core:
 * резолвим их относительно реального пути пакета — раннер и тесты лежат
 * в scripts/, вне этого дерева.
 */
export async function loadExportCoreDeps() {
  const require = createRequire(import.meta.url);
  let exportCoreEntry;
  try {
    exportCoreEntry = require.resolve("@presenton/export-core");
  } catch {
    // пакет может лежать в presentation-export/ без ссылки из корневых node_modules
    exportCoreEntry = path.resolve(
      "presentation-export/node_modules/@presenton/export-core/dist/index.js"
    );
  }
  // резолвим deps ОТ entry пакета: они лежат в его дереве node_modules
  // (jszip — там же, sharp может быть в корневом дереве — require.resolve
  // пройдёт по цепочке предков автоматически)
  const entryRequire = createRequire(exportCoreEntry);
  const [jszipPath, sharpPath] = [entryRequire.resolve("jszip"), entryRequire.resolve("sharp")];
  const [jszip, sharpModule] = await Promise.all([
    import(pathToFileURL(jszipPath).href),
    import(pathToFileURL(sharpPath).href),
  ]);
  return { JSZip: jszip.default, sharp: sharpModule.default };
}

/** Разобрать `<Relationship …/>` из rels-файла: id → {tag, target}. */
function parseRelationships(relsXml) {
  const map = new Map();
  for (const match of relsXml.matchAll(/<Relationship\b[^>]*\/>/g)) {
    const tag = match[0];
    const id = tag.match(/\bId="([^"]+)"/)?.[1];
    const target = tag.match(/\bTarget="([^"]+)"/)?.[1];
    if (id && target) map.set(id, { tag, target });
  }
  return map;
}

/** Целевой rels-путь для XML-части слайда/лейаута/мастера. */
function relsPathFor(partPath) {
  const dir = path.posix.dirname(partPath);
  const name = path.posix.basename(partPath);
  return `${dir}/_rels/${name}.rels`;
}

/** Путь соседнего XML для rels-файла. */
function partPathForRels(relsPath) {
  const dir = path.posix.dirname(path.posix.dirname(relsPath));
  const name = path.posix.basename(relsPath).replace(/\.rels$/, "");
  return `${dir}/${name}`;
}

/** Target rels → zip-путь внутри пакета. */
function resolveMediaPath(partPath, target) {
  const clean = target.replace(/^\.\//, "");
  if (clean.startsWith("/")) return clean.slice(1);
  return path.posix.normalize(path.posix.join(path.posix.dirname(partPath), clean));
}

/**
 * Найти svg-only blip'ы: blip без собственного r:embed, но с svgBlip-ext.
 * Регексп ограничен ext-блоком svgBlip (uuid из спецификации Microsoft SVG).
 * Группы: [1] = ext-блок целиком, [2] = r:embed svgBlip'а (id SVG-relationship).
 */
function findSvgOnlyBlips(slideXml) {
  const results = [];
  const re =
    /<a:blip>((?:(?!<a:blip>).)*?<a:ext uri="\{96DAC541-7B7A-43D3-8B79-37D633B846F1\}"><asvg:svgBlip[^>]*\br:embed="([^"]+)"[^>]*\/><\/a:ext><\/a:extLst>)<\/a:blip>/g;
  for (const match of slideXml.matchAll(re)) {
    const withoutSvgTag = match[0].replace(/<asvg:svgBlip[^>]*>/, "");
    if (/\br:embed="/.test(withoutSvgTag)) continue;
    results.push({ full: match[0], svgRelId: match[2], extBlock: match[1] });
  }
  return results;
}

function nextRelationshipId(relsXml) {
  const ids = [...relsXml.matchAll(/\bId="rId(\d+)"/g)].map((m) => Number(m[1]));
  return `rId${(ids.length ? Math.max(...ids) : 0) + 1}`;
}

function ensurePngDefault(contentTypesXml) {
  if (/Extension="png"/i.test(contentTypesXml)) return contentTypesXml;
  return contentTypesXml.replace(
    /(<Types\b[^>]*>)/,
    '$1<Default Extension="png" ContentType="image/png"/>'
  );
}

/**
 * Починить загруженный пакет (JSZip-инстанс мутируется).
 * rasterize(svgText) → PNG-байты; null/undefined = пропустить blip.
 */
export async function fixSvgOnlyBlipsInZip(zip, rasterize) {
  const relsFiles = Object.keys(zip.files).filter((name) =>
    /^ppt\/(slides|slideLayouts|slideMasters)\/_rels\/.+\.rels$/.test(name)
  );

  let fixed = 0;
  const parts = [];
  const rasterCache = new Map();

  for (const relsPath of relsFiles) {
    const relsFile = zip.file(relsPath);
    if (!relsFile) continue;
    let relsXml = await relsFile.async("string");
    const partPath = partPathForRels(relsPath);
    const partFile = zip.file(partPath);
    if (!partFile) continue;
    let partXml = await partFile.async("string");

    const relationships = parseRelationships(relsXml);
    const blips = findSvgOnlyBlips(partXml);
    if (blips.length === 0) continue;

    let relsDirty = false;
    let partDirty = false;

    for (const blip of blips) {
      const svgRel = relationships.get(blip.svgRelId);
      if (!svgRel) continue;
      const svgPath = resolveMediaPath(partPath, svgRel.target);
      const svgFile = zip.file(svgPath);
      if (!svgFile) continue;
      const svgText = await svgFile.async("string");

      let png = rasterCache.get(svgText);
      if (png === undefined) {
        png = await rasterize(svgText);
        rasterCache.set(svgText, png);
      }
      if (!png) continue;

      const newId = nextRelationshipId(relsXml);
      const mediaName = `presenton-svg-fallback-${fixed + 1}.png`;
      const mediaPath = path.posix.join(path.posix.dirname(svgPath), mediaName);
      zip.file(mediaPath, png);

      const relationshipTag =
        `<Relationship Id="${newId}" ` +
        `Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" ` +
        `Target="${svgRel.target.replace(/[^/]+$/, mediaName)}"/>`;
      relsXml = relsXml.replace(/<\/Relationships>/, `${relationshipTag}</Relationships>`);
      relsDirty = true;

      partXml = partXml.replace(
        blip.full,
        `<a:blip r:embed="${newId}">${blip.extBlock}</a:blip>`
      );
      partDirty = true;
      fixed += 1;
    }

    if (relsDirty) zip.file(relsPath, relsXml);
    if (partDirty) {
      zip.file(partPath, partXml);
      parts.push(partPath);
    }
  }

  if (fixed > 0) {
    const ctFile = zip.file("[Content_Types].xml");
    if (ctFile) {
      const xml = await ctFile.async("string");
      const ensured = ensurePngDefault(xml);
      if (ensured !== xml) zip.file("[Content_Types].xml", ensured);
    }
  }
  return { fixed, parts };
}

/**
 * Пост-обработать pptx-файл на диске: прочитать, починить, перезаписать.
 * rasterize обязателен; сбой растеризации одной иконки пропускает её,
 * не роняя весь файл. Ошибки чтения/записи прокидываются наверх.
 */
export async function addSvgRasterFallbacks(pptxPath, { JSZip, rasterize, log } = {}) {
  if (!JSZip) throw new Error("JSZip обязателен для пост-обработки PPTX");
  if (typeof rasterize !== "function") throw new Error("rasterize(svg) обязателен");

  const fs = await import("node:fs/promises");
  const zip = await JSZip.loadAsync(await fs.readFile(pptxPath));

  const safeRasterize = async (svgText) => {
    try {
      return await rasterize(svgText);
    } catch (error) {
      log?.(`[svg-fallback] растеризация не удалась, blip пропущен: ${error}`);
      return null;
    }
  };

  const result = await fixSvgOnlyBlipsInZip(zip, safeRasterize);
  if (result.fixed > 0) {
    const buf = await zip.generateAsync({ type: "nodebuffer" });
    await fs.writeFile(pptxPath, buf);
    log?.(`[svg-fallback] добавлено PNG-fallback: ${result.fixed} (${result.parts.join(", ")})`);
  }
  return result;
}
