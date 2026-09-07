/**
 * Тесты пост-обработки PPTX: SVG-blip'ы без растрового fallback получают
 * PNG-копию + relationship + r:embed. Пакет собирается в тесте через jszip.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const { addSvgRasterFallbacks, fixSvgOnlyBlipsInZip, loadExportCoreDeps } = await import(
  "./pptx-svg-fallback.mjs"
);

let JSZip;
try {
  ({ JSZip } = await loadExportCoreDeps());
} catch {
  // пакет не установлен (CI без sync) — тесты пропускаются
}
const suite = JSZip ? test : test.skip;

const PNG_BYTES = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const SVG_TEXT =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24"/></svg>';
const fakeRasterize = async () => PNG_BYTES;

const SVG_BLIP =
  '<a:blip><a:extLst><a:ext uri="{96DAC541-7B7A-43D3-8B79-37D633B846F1}">' +
  '<asvg:svgBlip xmlns:asvg="http://schemas.microsoft.com/office/drawing/2016/SVG/main" r:embed="rId2"/>' +
  "</a:ext></a:extLst></a:blip>";

const SLIDE_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" ' +
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
  "<p:cSld><p:spTree>" +
  '<p:pic><p:blipFill><a:blip r:embed="rId1" cstate="none"/></p:blipFill></p:pic>' +
  `<p:pic><p:blipFill>${SVG_BLIP}</p:blipFill></p:pic>` +
  "</p:spTree></p:cSld></p:sld>";

const SLIDE_RELS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/Presenton_Raster_Image_1.png"/>' +
  '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/presenton-native-svg-1-1.svg"/>' +
  "</Relationships>";

const CONTENT_TYPES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="svg" ContentType="image/svg+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  "</Types>";

async function buildBrokenPptx(tmpDir) {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", CONTENT_TYPES);
  zip.file("ppt/slides/slide1.xml", SLIDE_XML);
  zip.file("ppt/slides/_rels/slide1.xml.rels", SLIDE_RELS);
  zip.file("ppt/media/presenton-native-svg-1-1.svg", SVG_TEXT);
  zip.file("ppt/media/Presenton_Raster_Image_1.png", PNG_BYTES);
  const pptxPath = path.join(tmpDir, "broken.pptx");
  await fs.writeFile(pptxPath, await zip.generateAsync({ type: "nodebuffer" }));
  return pptxPath;
}

suite("pptx svg fallback: svg-only blip получает PNG-fallback", async () => {
  test("blip получает r:embed, media и relationship добавляются", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "pptx-svg-"));
    const pptxPath = await buildBrokenPptx(dir);

    const result = await addSvgRasterFallbacks(pptxPath, {
      JSZip,
      rasterize: fakeRasterize,
    });

    assert.equal(result.fixed, 1);
    assert.deepEqual(result.parts, ["ppt/slides/slide1.xml"]);

    const zip = await JSZip.loadAsync(await fs.readFile(pptxPath));
    const slideXml = await zip.file("ppt/slides/slide1.xml").async("string");
    assert.match(slideXml, /<a:blip r:embed="rId3"><a:extLst>/);
    assert.doesNotMatch(slideXml, /<a:blip><a:extLst>/);

    const rels = await zip.file("ppt/slides/_rels/slide1.xml.rels").async("string");
    assert.match(rels, /Id="rId3"[^>]*Target="[^"]*presenton-svg-fallback-1\.png"/);
    assert.ok(zip.file("ppt/media/presenton-svg-fallback-1.png"), "media PNG создан");
    const ct = await zip.file("[Content_Types].xml").async("string");
    assert.match(ct, /Extension="png"/, "png Default объявлен в [Content_Types]");
  });

  test("идемпотентно: повторный прогон ничего не меняет", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "pptx-svg-"));
    const pptxPath = await buildBrokenPptx(dir);
    await addSvgRasterFallbacks(pptxPath, { JSZip, rasterize: fakeRasterize });
    const second = await addSvgRasterFallbacks(pptxPath, { JSZip, rasterize: fakeRasterize });
    assert.equal(second.fixed, 0);
  });

  test("blip с обычным r:embed не трогается", async () => {
    const zip = new JSZip();
    zip.file("[Content_Types].xml", CONTENT_TYPES);
    const plain = SLIDE_XML.replace(SVG_BLIP, "");
    zip.file("ppt/slides/slide1.xml", plain);
    zip.file("ppt/slides/_rels/slide1.xml.rels", SLIDE_RELS);
    zip.file("ppt/media/Presenton_Raster_Image_1.png", PNG_BYTES);

    const result = await fixSvgOnlyBlipsInZip(zip, fakeRasterize);
    assert.equal(result.fixed, 0);
    const slideXml = await zip.file("ppt/slides/slide1.xml").async("string");
    assert.match(slideXml, /<a:blip r:embed="rId1" cstate="none"\/>/);
  });

  test("сбой растеризации пропускает blip, не роняя файл", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "pptx-svg-"));
    const pptxPath = await buildBrokenPptx(dir);
    const result = await addSvgRasterFallbacks(pptxPath, {
      JSZip,
      rasterize: async () => {
        throw new Error("boom");
      },
    });
    assert.equal(result.fixed, 0);
    const zip = await JSZip.loadAsync(await fs.readFile(pptxPath));
    const slideXml = await zip.file("ppt/slides/slide1.xml").async("string");
    assert.match(slideXml, /<a:blip><a:extLst>/, "исходный blip не повреждён");
  });

  test("svg-fallback распространяется и на slideLayouts", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "pptx-svg-"));
    const zip = new JSZip();
    zip.file("[Content_Types].xml", CONTENT_TYPES);
    const layoutXml = SLIDE_XML.replace("<p:cSld>", "<p:cSld>");
    zip.file("ppt/slideLayouts/slideLayout1.xml", layoutXml);
    zip.file(
      "ppt/slideLayouts/_rels/slideLayout1.xml.rels",
      SLIDE_RELS.replace(/ppt\/media/g, "ppt/media")
    );
    zip.file("ppt/media/presenton-native-svg-1-1.svg", SVG_TEXT);
    zip.file("ppt/media/Presenton_Raster_Image_1.png", PNG_BYTES);
    const pptxPath = path.join(dir, "layout.pptx");
    await fs.writeFile(pptxPath, await zip.generateAsync({ type: "nodebuffer" }));

    const result = await addSvgRasterFallbacks(pptxPath, { JSZip, rasterize: fakeRasterize });
    assert.equal(result.fixed, 1);
    assert.deepEqual(result.parts, ["ppt/slideLayouts/slideLayout1.xml"]);
  });
});
