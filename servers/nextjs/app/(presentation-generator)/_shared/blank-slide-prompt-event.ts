import type { TemplateV2Layout } from "@/components/slide-editor/importing/template-v2-import";

export const PRESENTON_BLANK_SLIDE_PROMPT_EVENT =
  "presenton:blank-slide-prompt";

export type BlankSlidePromptEventDetail = {
  prompt: string;
  slideIndex?: number | null;
  layoutId?: string | null;
  promptKind?: "blank" | "layout";
  layout?: TemplateV2Layout | null;
};
