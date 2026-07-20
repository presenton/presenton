export const BLANK_SLIDE_LAYOUT_ID = "__blank_slide__";

export const BLANK_TEMPLATE_V2_LAYOUT = {
  id: BLANK_SLIDE_LAYOUT_ID,
  description: "Empty slide.",
  background: "#FFFFFF",
  components: [],
  elements: [
    {
      type: "vector",
      shape: "polygon",
      points: [
        { x: 0, y: 0 },
        { x: 1280, y: 0 },
        { x: 1280, y: 720 },
        { x: 0, y: 720 },
      ],
      closed: true,
      fill: { color: "#FFFFFF" },
      decorative: true,
    },
    {
      type: "text",
      name: "Title placeholder",
      position: { x: 120, y: 180 },
      size: { width: 1040, height: 100 },
      text: "Title",
      runs: [{ text: "Title" }],
      font: {
        family: "Arial",
        size: 48,
        color: "#191919",
        bold: true,
        line_height: 1.1,
      },
      alignment: { horizontal: "center", vertical: "middle" },
    },
    {
      type: "text",
      name: "Subtitle placeholder",
      position: { x: 180, y: 310 },
      size: { width: 920, height: 64 },
      text: "Subtitle",
      runs: [{ text: "Subtitle" }],
      font: {
        family: "Arial",
        size: 24,
        color: "#667085",
        line_height: 1.25,
      },
      alignment: { horizontal: "center", vertical: "middle" },
    },
  ],
};

type BlankPresentationSlideOptions = {
  id: string;
  index?: number;
  presentationId?: string | null;
  templateId?: string | null;
  isTemplateV2?: boolean;
};

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export function cloneBlankTemplateV2Layout() {
  return cloneJson(BLANK_TEMPLATE_V2_LAYOUT);
}

export function isTemplateV2TemplateId(value: unknown): value is string {
  if (typeof value !== "string") return false;

  const templateId = value.trim();
  return templateId.startsWith("template-v2");
}

export function hasTemplateV2SlideUi(slide: any): boolean {
  const ui = slide?.ui;
  if (!ui || typeof ui !== "object" || Array.isArray(ui)) return false;

  return (
    Array.isArray(ui.components) ||
    Array.isArray(ui.elements)
  );
}

export function getSlideTemplateId(slide: any): string {
  const layoutGroup =
    typeof slide?.layout_group === "string" ? slide.layout_group.trim() : "";
  const layout = typeof slide?.layout === "string" ? slide.layout.trim() : "";
  const layoutTemplateId = layout.split(":")[0] || "";

  if (isTemplateV2TemplateId(layoutGroup)) {
    return layoutGroup;
  }
  return layoutGroup || layoutTemplateId;
}

export function isTemplateV2Slide(slide: any): boolean {
  return (
    isTemplateV2TemplateId(getSlideTemplateId(slide)) ||
    hasTemplateV2SlideUi(slide)
  );
}

export function getPresentationTemplateId(presentation: {
  layout?: unknown;
} | null | undefined): string {
  const layout = presentation?.layout;
  if (layout && typeof layout === "object" && !Array.isArray(layout)) {
    const record = layout as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name.trim() : "";
    if (name) return name;

    const layouts = record.layouts;
    if (Array.isArray(layouts)) return "template-v2";
    if (
      layouts &&
      typeof layouts === "object" &&
      Array.isArray((layouts as Record<string, unknown>).layouts)
    ) {
      return "template-v2";
    }
  }

  return "general";
}

export function createBlankPresentationSlide({
  id,
  index = 0,
  presentationId,
  templateId,
  isTemplateV2 = false,
}: BlankPresentationSlideOptions) {
  const resolvedTemplateId =
    typeof templateId === "string" && templateId.trim()
      ? templateId.trim()
      : isTemplateV2
        ? "template-v2"
        : "general";
  const shouldUseTemplateV2 =
    isTemplateV2 || isTemplateV2TemplateId(resolvedTemplateId);

  return {
    id,
    index,
    content: {},
    ...(shouldUseTemplateV2 ? { ui: cloneBlankTemplateV2Layout() } : {}),
    layout_group: resolvedTemplateId,
    layout: BLANK_SLIDE_LAYOUT_ID,
    ...(presentationId ? { presentation: presentationId } : {}),
  };
}

export function isBlankPresentationSlide(slide: {
  layout?: unknown;
} | null | undefined) {
  if (!slide || typeof slide.layout !== "string") return false;

  return (
    slide.layout === BLANK_SLIDE_LAYOUT_ID ||
    slide.layout.endsWith(`:${BLANK_SLIDE_LAYOUT_ID}`)
  );
}
