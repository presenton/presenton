export const BLANK_SLIDE_LAYOUT_ID = "__blank_slide__";
export const BLANK_SLIDE_LAYOUT_GROUP = "blank";

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

export function isTemplateFreePresentation(presentation: unknown) {
  if (
    !presentation ||
    typeof presentation !== "object" ||
    Array.isArray(presentation)
  ) {
    return false;
  }

  const slides = (presentation as { slides?: unknown }).slides;
  if (!Array.isArray(slides) || slides.length === 0) return false;

  const firstSlide = slides[0];
  if (!firstSlide || typeof firstSlide !== "object" || Array.isArray(firstSlide)) {
    return false;
  }

  return (
    (firstSlide as { layout_group?: unknown }).layout_group ===
    BLANK_SLIDE_LAYOUT_GROUP
  );
}
