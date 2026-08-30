import {
  asRecord,
  readArray,
  readString,
  type RawElement,
} from "@/components/slide-editor/model/model";

export const HTML_TEXT_WIDTH_ATTR = "presentonHtmlTextWidth";
export const HTML_TEXT_HEIGHT_ATTR = "presentonHtmlTextHeight";

export function shouldRenderTextElementAsHtml(element: RawElement) {
  const type = readString(element.type);
  if (type === "text") return runsContainLatex(readArray(element.runs));
  if (type !== "text-list") return false;

  return readArray(element.items).some((item) => {
    if (Array.isArray(item)) return runsContainLatex(item);
    const record = asRecord(item);
    return Boolean(record && runsContainLatex(readArray(record.runs)));
  });
}

function runsContainLatex(runs: unknown[]) {
  return runs.some((run) => readString(asRecord(run)?.type) === "latex");
}
