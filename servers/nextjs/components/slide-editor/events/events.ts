import type { SlideElement } from "@/components/slide-editor/types";

export const TEMPLATE_V2_INSERT_ELEMENTS_EVENT =
  "presenton:template-v2-insert-elements";
export const TEMPLATE_V2_SURFACE_SELECTED_EVENT =
  "presenton:template-v2-surface-selected";
export const TEMPLATE_V2_ACTIVATE_SURFACE_EVENT =
  "presenton:template-v2-activate-surface";

export type TemplateV2InsertComponent = {
  id?: string;
  description?: string;
  position: { x: number; y: number };
  elements: SlideElement[];
};

export type TemplateV2InsertElementsDetail = {
  elements?: SlideElement[];
  components?: TemplateV2InsertComponent[];
  preserveComponentData?: boolean;
  label?: string;
  slideId?: string | number | null;
  slideIndex?: number | null;
  handled?: boolean;
};

export type TemplateV2SingleSurfaceSelection = {
  kind: "component" | "element";
  slideIndex?: number | null;
  componentIndex?: number;
  componentId?: string;
  componentLabel?: string;
  elementPath?: string;
  elementType?: string;
  elementName?: string;
  targetLabel?: string;
};

export type TemplateV2MultiSurfaceSelection = {
  kind: "multi-component";
  slideIndex?: number | null;
  components: TemplateV2SingleSurfaceSelection[];
  componentIds?: string[];
  componentLabels?: string[];
  targetLabel?: string;
};

export type TemplateV2SurfaceSelectedDetail = {
  slideId?: string | number | null;
  slideIndex?: number | null;
  selection?: TemplateV2SingleSurfaceSelection | TemplateV2MultiSurfaceSelection | null;
};

export type TemplateV2ActivateSurfaceDetail = {
  slideId?: string | number | null;
  slideIndex?: number | null;
};
