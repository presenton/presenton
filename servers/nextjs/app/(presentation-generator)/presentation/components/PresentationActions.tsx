"use client";

import React, { useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  AlignCenter,
  AreaChart,
  ArrowDown,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  ArrowUpRight,
  BarChart3,
  Bookmark,
  ChartNoAxesGantt,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  Circle,
  Cloud,
  Columns2,
  Diamond,
  Droplet,
  Flag,
  Gauge,
  Grid3X3,
  GripVertical,
  Heart,
  Hexagon,
  Home,
  Image,
  LineChart,
  List,
  ListOrdered,
  MessageSquare,
  Minus,
  Moon,
  Move,
  Octagon,
  Pentagon,
  PieChart,
  Play,
  Plus,
  Quote,
  RectangleHorizontal,
  Rows3,
  Shield,
  Shapes,
  Star,
  Sun,
  Table2,
  Triangle,
  Type,
  ListMinus,
  Search,
  Sigma,
  X,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { notify } from "@/components/ui/sonner";
import { MixpanelEvent, trackEvent } from "@/utils/mixpanel";
import type { SlideElement } from "@/components/slide-editor/types";

import {
  ELEMENT_INSERT_GROUPS,
  createChartInsertElements,
  createElementInsertElements,
  createImageInsertContent,
  createInfographicInsertElements,
  createTableInsertElements,
  createTextInsertElements,
  type ElementInsertKind,
  type EditorInsertContent,
} from "@/components/slide-editor/insert/insert-elements";
import {
  adaptTemplateV2ComponentToElement,
  extractTemplateV2Layouts,
  extractTemplateV2MergedComponents,
  type TemplateV2Layout,
  type TemplateV2ImportResponse,
} from "@/components/slide-editor/importing/template-v2-import";
import {
  TEMPLATE_V2_INSERT_ELEMENTS_EVENT,
  TEMPLATE_V2_SURFACE_SELECTED_EVENT,
  type TemplateV2InsertComponent,
  type TemplateV2InsertElementsDetail,
  type TemplateV2SurfaceSelectedDetail,
} from "@/components/slide-editor/events/events";
import Chat from "./Chat";
import TemplateService from "../../services/api/template";
import { TemplateV2HtmlSlidePreview } from "../../components/TemplateV2HtmlSlidePreview";
import { isTemplateFreePresentation } from "../../_shared/blank-slide";
import {
  resolvePresentationTheme,
  type TemplateTheme,
} from "@/lib/template-theme";
import {
  InsertPalettePreview,
  type InsertPalettePreviewKind,
} from "./InsertPalettePreview";

type PresentationActionsProps = React.ComponentProps<typeof Chat> & {
  editingDisabled?: boolean;
  presentationData?: unknown;
  panelOpen?: boolean;
  onPanelOpenChange?: (open: boolean) => void;
};

type ActionId =
  | "ai"
  | "blocks"
  | "texts"
  | "charts"
  | "infographics"
  | "tables"
  | "images"
  | "elements";

type ActionItem = {
  id: ActionId;
  label: string;
  icon: LucideIcon;
};

export type PaletteItem = {
  id?: string;
  label: string;
  icon: LucideIcon;
};

type UnknownRecord = Record<string, unknown>;

export type TemplateBlock = {
  key: string;
  title: string;
  description: string;
  elementCount: number;
  raw: unknown;
  index: number;
};

type TemplateBlockGroup = {
  key: string;
  title: string;
  description: string;
  variants: TemplateBlock[];
};

type BlocksPanelState = {
  blocks: TemplateBlockGroup[];
  error: string | null;
  loading: boolean;
};

type BlocksPanelAction =
  | { type: "cached"; blocks: TemplateBlockGroup[] }
  | { type: "loading" }
  | { type: "loaded"; blocks: TemplateBlockGroup[] }
  | { type: "failed"; message: string };

const initialBlocksPanelState: BlocksPanelState = {
  blocks: [],
  error: null,
  loading: false,
};

function blocksPanelReducer(
  state: BlocksPanelState,
  action: BlocksPanelAction,
): BlocksPanelState {
  switch (action.type) {
    case "cached":
    case "loaded":
      return { blocks: action.blocks, error: null, loading: false };
    case "loading":
      return { ...state, error: null, loading: true };
    case "failed":
      return { blocks: [], error: action.message, loading: false };
    default:
      return state;
  }
}

type PresentationActionsUiState = {
  activeAction: ActionId;
};

type PresentationActionsUiAction = {
  type: "selectAction";
  activeAction: ActionId;
};

const initialPresentationActionsUiState: PresentationActionsUiState = {
  activeAction: "ai",
};

function presentationActionsUiReducer(
  state: PresentationActionsUiState,
  action: PresentationActionsUiAction,
): PresentationActionsUiState {
  switch (action.type) {
    case "selectAction":
      return { ...state, activeAction: action.activeAction };
    default:
      return state;
  }
}

const insertActions: ActionItem[] = [
  { id: "texts", label: "Texts", icon: Type },
  { id: "charts", label: "Charts", icon: BarChart3 },
  { id: "infographics", label: "Infographics", icon: Shapes },
  { id: "tables", label: "Tables", icon: Rows3 },
  { id: "images", label: "Images", icon: Image },
  { id: "elements", label: "Elements", icon: Shapes },
];

const actionIconSrc: Record<ActionId, string> = {
  ai: "/figma/presentation-actions/ai.svg",
  blocks: "/figma/presentation-actions/blocks.svg",
  texts: "/figma/presentation-actions/texts.svg",
  charts: "/figma/presentation-actions/charts.svg",
  infographics: "/figma/presentation-actions/infographics.svg",
  tables: "/figma/presentation-actions/tables.svg",
  images: "/figma/presentation-actions/images.svg",
  elements: "/figma/presentation-actions/elements.svg",
};

export const textItems = [
  { id: "equation", label: "Equation", icon: Sigma },
  { id: "equation-quadratic", label: "Quadratic", icon: Sigma },
  { id: "equation-summation", label: "Summation", icon: Sigma },
  { id: "equation-integral", label: "Integral", icon: Sigma },
  { id: "equation-matrix", label: "Matrix", icon: Sigma },
  { id: "title-block", label: "Title Block", icon: AlignCenter },
  { id: "subtitle", label: "Subtitle", icon: AlignCenter },
  { id: "bullet-list", label: "Bullet List", icon: List },
  { id: "numbered-list", label: "Order List", icon: ListOrdered },
  { id: "list-item", label: "List Item", icon: ListMinus },
  { id: "quote", label: "Quote", icon: Quote },
  { id: "body-text", label: "Body Text", icon: Columns2 },
] satisfies PaletteItem[];

export const chartTypeItems = [
  { id: "bar", label: "Bar Chart", icon: BarChart3 },
  { id: "horizontal_bar", label: "Horizontal Bar", icon: BarChart3 },
  { id: "stacked_bar", label: "Stacked Bar", icon: BarChart3 },
  {
    id: "horizontal_stacked_bar",
    label: "Horizontal Stack Bar",
    icon: BarChart3,
  },
  { id: "line", label: "Line Chart", icon: LineChart },
  { id: "pie", label: "Pie Chart", icon: PieChart },
  { id: "area", label: "Area Chart", icon: AreaChart },
  { id: "donut", label: "Donut Chart", icon: PieChart },
  { id: "scatter", label: "Scatter Chart", icon: Circle },
  { id: "radar", label: "Radar Chart", icon: PieChart },
  { id: "polar_area", label: "Polar Area", icon: PieChart },
] satisfies PaletteItem[];

export const infographicItems = [
  { id: "progress_bar", label: "Progress Bar", icon: ChartNoAxesGantt },
  { id: "gauge", label: "Gauge Chart", icon: Gauge },
  { id: "gantt", label: "Gantt Chart", icon: ChartNoAxesGantt },
  { id: "timeline", label: "Timeline", icon: ArrowRight },
  { id: "roadmap", label: "Roadmap", icon: Move },
  { id: "milestone_timeline", label: "Milestones", icon: Flag },
  { id: "staircase", label: "Staircase", icon: Rows3 },
  { id: "supply_chain", label: "Supply Chain", icon: Move },
  { id: "stair_step_blocks", label: "Step Blocks", icon: Rows3 },
  { id: "maturity_model", label: "Maturity Model", icon: Rows3 },
  { id: "pillar_framework", label: "Pillar Framework", icon: Columns2 },
  { id: "transformation_hub", label: "Transformation Hub", icon: Shapes },
  { id: "diagonal_circles", label: "Diagonal Circles", icon: Circle },
  { id: "risk_matrix", label: "Risk Matrix", icon: Grid3X3 },
  { id: "chevron_process", label: "Chevron Process", icon: ChevronsRight },
  { id: "radial_cycle", label: "Radial Cycle", icon: Circle },
  { id: "conversion_funnel", label: "Conversion Funnel", icon: AreaChart },
  { id: "pyramid", label: "Pyramid", icon: Triangle },
  { id: "segmented_wheel", label: "Segmented Wheel", icon: Circle },
  { id: "customer_journey", label: "Customer Journey", icon: Move },
  { id: "before_after", label: "Before & After", icon: Columns2 },
  { id: "impact_effort_matrix", label: "Impact / Effort", icon: Grid3X3 },
  { id: "comparison_matrix", label: "Comparison Matrix", icon: Table2 },
  { id: "org_chart", label: "Organization Chart", icon: Rows3 },
  { id: "decision_tree", label: "Decision Tree", icon: Shapes },
  { id: "mind_map", label: "Mind Map", icon: Shapes },
] satisfies PaletteItem[];

export const tableTypeItems = [
  { id: "simple-table", label: "Simple Table", icon: Table2 },
] satisfies PaletteItem[];

export const imageItems = [
  { id: "image", label: "Image", icon: Image },
  { id: "image-text", label: "Image + Text", icon: Columns2 },
  { id: "image-grid", label: "Image Grid", icon: Grid3X3 },
] satisfies PaletteItem[];

const elementIconById: Record<ElementInsertKind, LucideIcon> = {
  "vector-rectangle": RectangleHorizontal,
  "vector-rounded-rectangle": RectangleHorizontal,
  "vector-capsule": RectangleHorizontal,
  "vector-circle": Circle,
  "vector-ellipse": Circle,
  "vector-triangle": Triangle,
  "vector-right-triangle": Triangle,
  "vector-diamond": Diamond,
  "vector-parallelogram": Shapes,
  "vector-trapezoid": Shapes,
  "vector-pentagon": Pentagon,
  "vector-hexagon": Hexagon,
  "vector-octagon": Octagon,
  "vector-teardrop": Droplet,
  "vector-line": Minus,
  "vector-line-arrow": ArrowRight,
  "vector-line-arrow-both": ArrowLeftRight,
  "vector-line-stealth": ArrowRight,
  "vector-line-filled": ArrowRight,
  "vector-line-filled-both": ArrowLeftRight,
  "vector-line-circle-arrow": ArrowRight,
  "vector-line-square-arrow": ArrowRight,
  "vector-line-diamond-arrow": ArrowRight,
  "vector-arrow": ArrowRight,
  "vector-arrow-left": ArrowLeft,
  "vector-arrow-up": ArrowUp,
  "vector-arrow-down": ArrowDown,
  "vector-arrow-left-right": ArrowLeftRight,
  "vector-arrow-up-down": ArrowUpDown,
  "vector-chevron-right": ChevronsRight,
  "vector-notched-arrow": ArrowRight,
  "vector-bent-arrow": ArrowUpRight,
  "vector-four-way-arrow": Move,
  "vector-plus": Plus,
  "vector-cross": X,
  "vector-lightning": Zap,
  "vector-home": Home,
  "vector-speech-bubble": MessageSquare,
  "vector-cloud": Cloud,
  "vector-heart": Heart,
  "vector-star": Star,
  "vector-bookmark": Bookmark,
  "vector-shield": Shield,
  "vector-flag": Flag,
  "vector-moon": Moon,
  "vector-sun": Sun,
  "vector-play": Play,
};

export const elementItemGroups = ELEMENT_INSERT_GROUPS.map((group) => ({
  label: group.label,
  items: group.items.map((item) => ({
    ...item,
    icon: elementIconById[item.id],
  })),
}));

export const elementItems = elementItemGroups.flatMap((group) => group.items);

const templateBlocksCache = new Map<string, TemplateBlockGroup[]>();
const BLOCK_PREVIEW_WIDTH = 1280;
const BLOCK_PREVIEW_HEIGHT = 720;

const NavButton = ({
  item,
  active,
  onClick,
}: {
  item: ActionItem;
  active: boolean;
  onClick: () => void;
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex w-full flex-col items-center justify-center text-[12px] font-normal leading-normal transition-colors",
        item.id === "images" ? "h-[52px] gap-2" : "h-12 gap-1",
        active ? "text-[#7A5AF8]" : "text-black",
      )}
      aria-pressed={active}
    >
      <span
        className={cn(
          "flex h-[30px] w-[30px] items-center justify-center rounded-[10px] border border-transparent transition-all",
          active && "border-[#EDEEEF] bg-white",
        )}
        style={{
          boxShadow: active ? "0 6.6px 13.2px 0 rgba(124, 81, 248, 0.14)" : "",
        }}
      >
        <img
          alt=""
          aria-hidden="true"
          className="h-[14px] w-[14px]"
          src={actionIconSrc[item.id]}
        />
      </span>
      <span>{item.label}</span>
    </button>
  );
};

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <h4 className="mb-2 text-[10px] font-normal uppercase leading-[15px] tracking-[0.367px] text-[#99A1AF]">
    {children}
  </h4>
);

const PaletteCard = ({
  disabled = false,
  item,
  onClick,
  previewKind,
  theme,
}: {
  disabled?: boolean;
  item: PaletteItem;
  onClick?: () => void;
  previewKind: InsertPalettePreviewKind;
  theme: TemplateTheme;
}) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className={cn(
      "group min-w-0 overflow-hidden rounded-[10px] border border-[#EDEEF0] bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#B9A8FA] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7A5AF8]/40",
      disabled &&
        "cursor-not-allowed opacity-50 hover:translate-y-0 hover:border-[#EDEEF0] hover:shadow-sm",
    )}
    aria-label={`Add ${item.label}`}
    title={item.label}
  >
    <div className="aspect-video w-full overflow-hidden bg-white">
      <InsertPalettePreview itemId={item.id} kind={previewKind} theme={theme} />
    </div>
    <span className="block truncate border-t border-[#F0F1F3] px-2.5 py-2 text-[11px] font-medium leading-4 text-[#344054]">
      {item.label}
    </span>
  </button>
);

const PaletteGrid = ({
  disabled = false,
  items,
  onSelect,
  previewKind,
  theme,
}: {
  disabled?: boolean;
  items: PaletteItem[];
  onSelect?: (item: PaletteItem) => void;
  previewKind: InsertPalettePreviewKind;
  theme: TemplateTheme;
}) => (
  <div className="grid grid-cols-2 gap-[clamp(8px,0.8vw,10px)]">
    {items.map((item) => (
      <PaletteCard
        key={item.id ?? item.label}
        item={item}
        disabled={disabled}
        onClick={onSelect && !disabled ? () => onSelect(item) : undefined}
        previewKind={previewKind}
        theme={theme}
      />
    ))}
  </div>
);

export const InsertPanel = ({
  disabled = false,
  title,
  groups,
  onItemSelect,
  previewKind,
  theme,
}: {
  disabled?: boolean;
  title: string;
  groups: Array<{
    label: string;
    items: PaletteItem[];
  }>;
  onItemSelect?: (item: PaletteItem) => void;
  previewKind: InsertPalettePreviewKind;
  theme: TemplateTheme;
}) => (
  <div className="h-full overflow-y-auto px-[clamp(14px,1.4vw,20px)] pb-[clamp(24px,2.2vw,32px)] pt-[clamp(24px,2.2vw,32px)] hide-scrollbar">
    <h3 className="mb-[clamp(24px,2.2vw,32px)] text-[clamp(13px,0.95vw,15px)] font-semibold leading-5 text-[#101323]">
      {title}
    </h3>
    <div className="space-y-3.5">
      {groups.map((group) => (
        <section key={group.label}>
          <SectionLabel>{group.label}</SectionLabel>
          <PaletteGrid
            disabled={disabled}
            items={group.items}
            onSelect={onItemSelect}
            previewKind={previewKind}
            theme={theme}
          />
        </section>
      ))}
    </div>
  </div>
);

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function readRecordString(record: UnknownRecord, key: string): string | null {
  return readString(record[key]);
}

function readRecordArray(record: UnknownRecord, key: string): unknown[] {
  const value = record[key];
  return Array.isArray(value) ? value : [];
}

function hasUsableComponentSize(record: UnknownRecord) {
  const size = isRecord(record.size) ? record.size : null;
  const width = typeof size?.width === "number" ? size.width : null;
  const height = typeof size?.height === "number" ? size.height : null;
  return Boolean(width && height && width > 0 && height > 0);
}

function humanizeIdentifier(value: string) {
  const normalized = value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function templateBlockFromComponent(
  component: unknown,
  index: number,
): TemplateBlock | null {
  const raw = isRecord(component) ? component : null;
  if (!raw) return null;

  const id = readRecordString(raw, "id");
  const title =
    readRecordString(raw, "name") ??
    readRecordString(raw, "title") ??
    (id ? humanizeIdentifier(id) : `Component ${index + 1}`);
  const description = readRecordString(raw, "description") ?? "";
  const elementCount = readRecordArray(raw, "elements").length;
  const keyBase = id ?? title;

  return {
    key: `${keyBase}-${index}`,
    title,
    description,
    elementCount,
    raw: component,
    index,
  };
}

function componentVariants(component: unknown): unknown[] {
  const raw = isRecord(component) ? component : null;
  if (!raw) return [];

  return readRecordArray(raw, "variants")
    .map((variant, variantIndex) => {
      if (!isRecord(variant)) return null;
      return {
        ...raw,
        ...variant,
        id:
          readRecordString(variant, "id") ??
          `${readRecordString(raw, "id") ?? "component"}_variant_${variantIndex + 1}`,
        name:
          readRecordString(variant, "name") ??
          readRecordString(variant, "title") ??
          readRecordString(raw, "name") ??
          readRecordString(raw, "title"),
        description:
          readRecordString(variant, "description") ??
          readRecordString(raw, "description"),
      };
    })
    .filter(Boolean);
}

function templateBlockGroupsFromTemplate(template: unknown): TemplateBlockGroup[] {
  const components = extractTemplateV2MergedComponents(template);
  return components
    .map((component, componentIndex) => {
      const baseBlock = templateBlockFromComponent(component, componentIndex);
      if (!baseBlock) return null;
      const variants = componentVariants(component);
      const variantSources = variants.length > 0 ? variants : [component];
      const variantBlocks = variantSources
        .map((variant, variantIndex) => {
          const block = templateBlockFromComponent(variant, componentIndex);
          return block
            ? { ...block, key: `${baseBlock.key}-variant-${variantIndex}` }
            : null;
        })
        .filter((block): block is TemplateBlock => Boolean(block));

      return variantBlocks.length > 0
        ? {
          key: baseBlock.key,
          title: baseBlock.title,
          description: baseBlock.description,
          variants: variantBlocks,
        }
        : null;
    })
    .filter((group): group is TemplateBlockGroup => Boolean(group));
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter(Boolean) as string[]));
}

function collectCandidateTemplateIds(value: unknown, depth = 0): string[] {
  if (depth > 6) return [];

  const ids: Array<string | null | undefined> = [];
  if (Array.isArray(value)) {
    value.slice(0, 80).forEach((item) => {
      ids.push(...collectCandidateTemplateIds(item, depth + 1));
    });
    return uniqueStrings(ids);
  }

  if (!isRecord(value)) return [];

  const directKeys = [
    "templateV2Id",
    "template_v2_id",
    "templateId",
    "template_id",
    "layout_group",
  ];

  directKeys.forEach((key) => {
    ids.push(readRecordString(value, key) ?? undefined);
  });

  const template = value.template;
  if (typeof template === "string") {
    ids.push(template);
  } else if (isRecord(template)) {
    ids.push(
      readRecordString(template, "id") ??
      readRecordString(template, "templateV2Id") ??
      readRecordString(template, "template_v2_id") ??
      undefined,
    );
  }

  [
    "layout",
    "layouts",
    "slides",
    "presentation",
    "properties",
    "ui",
    "metadata",
  ].forEach((key) => {
    ids.push(...collectCandidateTemplateIds(value[key], depth + 1));
  });

  if (typeof window !== "undefined" && depth === 0) {
    const params = new URLSearchParams(window.location.search);
    ids.push(
      params.get("templateV2Id") ??
      params.get("template_v2_id") ??
      params.get("template_id") ??
      params.get("templateId") ??
      undefined,
    );
  }

  return uniqueStrings(ids);
}

function collectPresentationLayoutIds(presentationData: unknown): string[] {
  const raw = isRecord(presentationData) ? presentationData : null;
  if (!raw) return [];

  const ids: Array<string | null | undefined> = [];
  const layout = raw.layout;

  if (typeof layout === "string") {
    ids.push(layout);
  } else if (isRecord(layout)) {
    ids.push(readRecordString(layout, "id"));
    extractTemplateV2Layouts(layout).forEach((entry) => {
      ids.push(readString(entry.id));
    });
  }

  readRecordArray(raw, "slides").forEach((slide) => {
    if (!isRecord(slide)) return;
    ids.push(readRecordString(slide, "layout"));
  });

  return uniqueStrings(ids);
}

function collectTemplateDetailLayoutIds(
  template: TemplateV2ImportResponse,
): string[] {
  return uniqueStrings([
    ...extractTemplateV2Layouts(template.layouts).map((layout) =>
      readString(layout.id),
    ),
    ...extractTemplateV2Layouts(template.raw_layouts).map((layout) =>
      readString(layout.id),
    ),
  ]);
}

function templateMatchesLayoutIds(
  template: TemplateV2ImportResponse,
  layoutIds: string[],
) {
  if (layoutIds.length === 0) return false;
  const wanted = new Set(layoutIds);
  return collectTemplateDetailLayoutIds(template).some((id) => wanted.has(id));
}

async function loadTemplateBlocksForPresentation(
  presentationData: unknown,
): Promise<TemplateBlockGroup[]> {
  const embeddedBlocks = templateBlockGroupsFromTemplate(presentationData);
  if (embeddedBlocks.length > 0) return embeddedBlocks;

  const candidateIds = collectCandidateTemplateIds(presentationData);
  for (const templateId of candidateIds) {
    try {
      const template = (await TemplateService.getTemplateDetails(
        templateId,
      )) as TemplateV2ImportResponse;
      const blocks = templateBlockGroupsFromTemplate(template);
      if (blocks.length > 0) return blocks;
    } catch {
      // Candidate ids can include legacy template slugs; ignore and try the next source.
    }
  }

  const layoutIds = collectPresentationLayoutIds(presentationData);
  if (layoutIds.length === 0) return [];

  try {
    const summaries = await TemplateService.getTemplateSummaries();
    for (const summary of summaries.items ?? []) {
      try {
        const template = (await TemplateService.getTemplateDetails(
          summary.id,
        )) as TemplateV2ImportResponse;
        if (!templateMatchesLayoutIds(template, layoutIds)) continue;

        const blocks = templateBlockGroupsFromTemplate(template);
        if (blocks.length > 0) return blocks;
      } catch {
        // Keep searching; one bad template should not break the blocks panel.
      }
    }
  } catch {
    return [];
  }

  return [];
}

function templateBlocksCacheKey(
  presentationId: string,
  presentationData: unknown,
) {
  const candidateIds = collectCandidateTemplateIds(presentationData).join(",");
  const layoutIds = collectPresentationLayoutIds(presentationData).join(",");
  return `${presentationId}:${candidateIds}:${layoutIds}`;
}

function useBlockPreviewScale() {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const [previewWidth, setPreviewWidth] = useState(0);

  useEffect(() => {
    const node = previewRef.current;
    if (!node) return;

    const updateWidth = (width = node.getBoundingClientRect().width) => {
      setPreviewWidth((current) =>
        Math.abs(current - width) < 0.5 ? current : width,
      );
    };

    updateWidth();

    if (typeof ResizeObserver === "undefined") {
      const handleResize = () => updateWidth();
      window.addEventListener("resize", handleResize);
      return () => {
        window.removeEventListener("resize", handleResize);
      };
    }

    const observer = new ResizeObserver((entries) => {
      updateWidth(entries[0]?.contentRect.width);
    });
    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, []);

  return {
    previewRef,
    scale: previewWidth > 0 ? previewWidth / BLOCK_PREVIEW_WIDTH : 0,
  };
}

function blockPreviewLayout(block: TemplateBlock): TemplateV2Layout {
  return {
    id: `block-preview-${block.key}`,
    components: [block.raw],
  };
}

function BlockThumbnail({ block }: { block: TemplateBlock }) {
  const { previewRef, scale } = useBlockPreviewScale();
  const layout = useMemo(() => blockPreviewLayout(block), [block]);

  return (
    <div
      ref={previewRef}
      className="template-block-preview relative aspect-video w-full overflow-hidden rounded-[6px] bg-white transition-colors"
    >
      <div
        className={cn(
          "pointer-events-none absolute left-0 top-0 origin-top-left",
          scale > 0 ? "opacity-100" : "opacity-0",
        )}
        style={{
          width: BLOCK_PREVIEW_WIDTH,
          height: BLOCK_PREVIEW_HEIGHT,
          transform: `scale(${scale || 1})`,
        }}
      >
        {/* <TemplateV2KonvaSlide
          layout={layout}
          isEditMode={false}
          slideId={null}
          slideIndex={block.index}
        /> */}
        <TemplateV2HtmlSlidePreview
          slide={{
            ui: layout,
          }}
          fonts={null}
          className="template-block-preview-surface pointer-events-none rounded-[10px]"
          contentClassName="template-block-preview-content"
        />

      </div>
    </div>
  );
}

function BlockVariantButton({
  block,
  disabled = false,
  onInsertBlock,
}: {
  block: TemplateBlock;
  disabled?: boolean;
  onInsertBlock: (block: TemplateBlock) => void;
}) {
  return (
    <button
      type="button"
      data-block-variant
      disabled={disabled}
      className={cn(
        "template-block-variant group relative w-full overflow-hidden rounded-[12px] border border-[#E5E7EB] bg-[#F9FAFB] p-2 text-left transition hover:border-[#D6BBFB] hover:bg-[#FAF9FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7A5AF8]/40",
        disabled && "cursor-not-allowed opacity-50 hover:border-[#E5E7EB] hover:bg-[#F9FAFB]",
      )}
      onClick={() => {
        if (!disabled) onInsertBlock(block);
      }}
      aria-label={`Insert ${block.title}`}
    >
      <div className="relative">
        <BlockThumbnail block={block} />
        <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white text-[#111827] shadow-[0_4px_12px_rgba(16,24,40,0.16)]">
          <GripVertical className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
        </span>
      </div>
    </button>
  );
}

function BlockGroupCard({
  disabled = false,
  group,
  onInsertBlock,
}: {
  disabled?: boolean;
  group: TemplateBlockGroup;
  onInsertBlock: (block: TemplateBlock) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [hasExpanded, setHasExpanded] = useState(false);
  const firstVariant = group.variants[0];
  const additionalVariants = group.variants.slice(1);
  const variantCount = group.variants.length;

  const toggleExpanded = () => {
    if (!expanded) setHasExpanded(true);
    setExpanded((current) => !current);
  };

  return (
    <section className="rounded-[14px] border border-[#E5E7EB] bg-white p-3 transition-shadow hover:shadow-[0_8px_24px_rgba(16,24,40,0.08)]">
      <h4 className="mb-4 truncate text-center text-[clamp(14px,1vw,16px)] font-medium leading-5 text-[#171717]">
        {group.title}
      </h4>

      {firstVariant ? (
        <BlockVariantButton
          block={firstVariant}
          disabled={disabled}
          onInsertBlock={onInsertBlock}
        />
      ) : null}

      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
          expanded
            ? "grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="space-y-3 pt-3">
            {hasExpanded
              ? additionalVariants.map((block) => (
                <BlockVariantButton
                  key={block.key}
                  block={block}
                  disabled={disabled}
                  onInsertBlock={onInsertBlock}
                />
              ))
              : null}
          </div>
        </div>
      </div>

      {variantCount > 1 ? (
        <button
          type="button"
          className="mt-3 flex w-full items-center justify-between gap-3 border-t border-[#E5E7EB] pt-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7A5AF8]/40"
          aria-expanded={expanded}
          onClick={toggleExpanded}
        >
          <span className="shrink-0 rounded-full border border-[#D6BBFB] bg-[#FAF8FF] px-3 py-1.5 text-[11px] font-medium leading-4 text-[#7F00FF]">
            {variantCount} Layouts
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-[#171717] transition-transform duration-200",
              expanded && "rotate-180",
            )}
            strokeWidth={2}
            aria-hidden
          />
        </button>
      ) : null}
    </section>
  );
}

export const BlocksPanel = ({
  disabled = false,
  presentationId,
  presentationData,
  onInsertBlock,
}: {
  disabled?: boolean;
  presentationId: string;
  presentationData?: unknown;
  onInsertBlock: (block: TemplateBlock) => void;
}) => {
  const [blockPrompt, setBlockPrompt] = useState("");
  const [{ blocks, error, loading }, dispatchBlockState] = useReducer(
    blocksPanelReducer,
    initialBlocksPanelState,
  );
  const cacheKey = useMemo(
    () => templateBlocksCacheKey(presentationId, presentationData),
    [presentationData, presentationId],
  );
  const visibleBlocks = useMemo(() => {
    const query = blockPrompt.trim().toLowerCase();
    if (!query) return blocks;
    return blocks.filter(
      (group) =>
        group.title.toLowerCase().includes(query) ||
        group.description.toLowerCase().includes(query) ||
        group.variants.some(
          (variant) =>
            variant.title.toLowerCase().includes(query) ||
            variant.description.toLowerCase().includes(query),
        ),
    );
  }, [blockPrompt, blocks]);

  useEffect(() => {
    let cancelled = false;
    const cached = templateBlocksCache.get(cacheKey);
    if (cached) {
      dispatchBlockState({ type: "cached", blocks: cached });
      trackEvent(MixpanelEvent.Editor_Template_Blocks_Loaded, {
        presentation_id: presentationId,
        block_group_count: cached.length,
        from_cache: true,
      });
      return;
    }

    dispatchBlockState({ type: "loading" });
    void loadTemplateBlocksForPresentation(presentationData)
      .then((nextBlocks) => {
        if (cancelled) return;
        if (nextBlocks.length > 0) {
          templateBlocksCache.set(cacheKey, nextBlocks);
        }
        dispatchBlockState({ type: "loaded", blocks: nextBlocks });
        trackEvent(MixpanelEvent.Editor_Template_Blocks_Loaded, {
          presentation_id: presentationId,
          block_group_count: nextBlocks.length,
          from_cache: false,
        });
      })
      .catch(() => {
        if (cancelled) return;
        dispatchBlockState({
          type: "failed",
          message: "Could not load template components.",
        });
        trackEvent(MixpanelEvent.Editor_Template_Blocks_Load_Failed, {
          presentation_id: presentationId,
          error_message: "Could not load template components.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [cacheKey, presentationData, presentationId]);

  return (
    <div className="h-full overflow-y-auto px-[clamp(14px,1.4vw,20px)] pb-[clamp(24px,2.2vw,32px)] pt-[clamp(24px,2.2vw,32px)] hide-scrollbar">
      <style jsx global>{`
        .template-block-preview,
        .template-block-preview-surface,
        .template-block-preview-content,
        .template-block-preview-content > div {
          transition:
            background 180ms ease,
            background-color 180ms ease;
        }

        .template-block-variant:hover .template-block-preview,
        .template-block-variant:hover .template-block-preview-surface,
        .template-block-variant:hover .template-block-preview-content,
        .template-block-variant:hover .template-block-preview-content > div {
          background: #a2a2a3 !important;
        }
      `}</style>
      <h3 className="mb-3 text-[clamp(13px,0.95vw,15px)] font-semibold leading-5 text-[#101323]">
        Blocks
      </h3>

      <div className="mb-7 flex h-[clamp(46px,3.6vw,52px)] items-center rounded-[10px] border border-[#EDEEF0] bg-white pl-[clamp(10px,0.9vw,12px)] pr-[clamp(6px,0.6vw,8px)] shadow-[0_10px_26px_rgba(17,24,39,0.08)]">
        <input
          value={blockPrompt}
          onChange={(event) => setBlockPrompt(event.target.value)}
          placeholder="Search blocks"
          className="min-w-0 flex-1 bg-transparent text-[clamp(10px,0.75vw,12px)] text-[#101323] outline-none placeholder:text-[#9CA3AF]"
        />
        <button
          type="button"
          disabled={disabled}
          className="flex h-[clamp(32px,2.5vw,36px)] w-[clamp(32px,2.5vw,36px)] shrink-0 items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            background:
              "linear-gradient(270deg, #D5CAFC 2.4%, #E3D2EB 35%, #FDE4C2 100%)",
          }}
          aria-label="Create block"
        >
          <Search
            className="h-[clamp(12px,0.9vw,14px)] w-[clamp(12px,0.9vw,14px)] text-[#101323]"
            strokeWidth={1.9}
          />
        </button>
      </div>

      <SectionLabel>Content</SectionLabel>

      <div className="space-y-3">
        {loading && (
          <p className="rounded-[8px] border border-[#E5E7EB] bg-[#F9FAFB] p-4 text-[11px] leading-4 text-[#667085]">
            Loading template components...
          </p>
        )}
        {!loading && error && (
          <p className="rounded-[8px] border border-[#FEE4E2] bg-[#FFFBFA] p-4 text-[11px] leading-4 text-[#B42318]">
            {error}
          </p>
        )}
        {!loading && !error && visibleBlocks.length === 0 && (
          <p className="rounded-[8px] border border-dashed border-[#D0D5DD] bg-[#F9FAFB] p-4 text-[11px] leading-4 text-[#667085]">
            No template components found.
          </p>
        )}
        {!loading &&
          !error &&
          visibleBlocks.map((group) => (
            <BlockGroupCard
              key={group.key}
              disabled={disabled}
              group={group}
              onInsertBlock={onInsertBlock}
            />
          ))}
      </div>
    </div>
  );
};

function PrimaryActionButton({
  active,
  disabled = false,
  disabledReason,
  iconSrc,
  label,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  disabledReason?: string;
  iconSrc: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={disabled ? disabledReason : undefined}
      aria-label={disabled && disabledReason ? `${label}: ${disabledReason}` : label}
      className={cn(
        "flex h-12 w-[82px] flex-col items-center justify-center gap-1",
        disabled && "cursor-not-allowed opacity-40",
      )}
      onClick={onClick}
    >
      <span
        className={`flex h-[30px] w-[30px] items-center justify-center rounded-[10px] border border-transparent ${
          active ? "border-[#EDEEEF] bg-white" : ""
        }`}
        style={{
          boxShadow: active ? "0 6.6px 13.2px 0 rgba(124, 81, 248, 0.14)" : "",
        }}
      >
        <img
          alt=""
          aria-hidden="true"
          className={label === "AI" ? "h-[18px] w-[18.643px]" : "h-[14px] w-[14px]"}
          src={iconSrc}
        />
      </span>
      <span className="text-[12px] font-normal leading-normal text-[#7A5AF8]">
        {label}
      </span>
    </button>
  );
}

function ActionsSidebar({
  activeAction,
  aiOnly = false,
  blocksUnavailable = false,
  onActionSelect,
}: {
  activeAction: ActionId;
  aiOnly?: boolean;
  blocksUnavailable?: boolean;
  onActionSelect: (action: ActionId) => void;
}) {
  return (
    <aside
      aria-label="Editor tools"
      className="ml-auto flex h-full w-[90px] font-syne shrink-0 flex-col items-center gap-5 bg-white px-[10px] py-2"
    >
      <div
        className="flex w-full shrink-0 flex-col items-center gap-5 rounded-[10px] py-7"
        style={{
          background: "rgba(244, 243, 255, 0.60)",
        }}
      >
        <PrimaryActionButton
          active={activeAction === "ai"}
          iconSrc={actionIconSrc.ai}
          label="AI"
          onClick={() => onActionSelect("ai")}
        />
        {!aiOnly && (
          <>
            <div className="h-0 w-[30px] border-t border-[#EDEEEF]" />
            <PrimaryActionButton
              active={activeAction === "blocks"}
              disabled={blocksUnavailable}
              disabledReason="Blocks require a presentation template"
              iconSrc={actionIconSrc.blocks}
              label="Blocks"
              onClick={() => onActionSelect("blocks")}
            />
          </>
        )}
      </div>

      {!aiOnly && (
        <>
          <div className="h-0 w-[30px] shrink-0 border-t border-[#EDEEEF]" />
          <nav className="flex w-full flex-col items-center gap-5">
            {insertActions.map((item) => (
              <React.Fragment key={item.id}>
                <NavButton
                  item={item}
                  active={activeAction === item.id}
                  onClick={() => onActionSelect(item.id)}
                />
                <div className="h-0 w-[30px] shrink-0 border-t border-[#EDEEEF]" />
              </React.Fragment>
            ))}
          </nav>
        </>
      )}
    </aside>
  );
}

function ActionsPanel({
  activeAction,
  aiOnly = false,
  blocksUnavailable = false,
  chatProps,
  editingDisabled = false,
  onBlockSelect,
  onChartItemSelect,
  onInfographicItemSelect,
  onElementItemSelect,
  onImageItemSelect,
  onTableItemSelect,
  onTextItemSelect,
  presentationData,
  presentationId,
  templateTheme,
}: {
  activeAction: ActionId;
  aiOnly?: boolean;
  blocksUnavailable?: boolean;
  chatProps: Omit<
    PresentationActionsProps,
    | "editingDisabled"
    | "presentationData"
    | "panelOpen"
    | "onPanelOpenChange"
  >;
  editingDisabled?: boolean;
  onBlockSelect: (block: TemplateBlock) => void;
  onChartItemSelect: (item: PaletteItem) => void;
  onInfographicItemSelect: (item: PaletteItem) => void;
  onElementItemSelect: (item: PaletteItem) => void;
  onImageItemSelect: (item: PaletteItem) => void;
  onTableItemSelect: (item: PaletteItem) => void;
  onTextItemSelect: (item: PaletteItem) => void;
  presentationData?: unknown;
  presentationId: string;
  templateTheme: TemplateTheme;
}) {
  return (
    <div className="min-w-0 flex-1 bg-white">
      <div className={cn("h-full", activeAction === "ai" ? "block" : "hidden")}>
        <Chat
          {...chatProps}
          presentationData={presentationData}
          inputDisabled={editingDisabled}
        />
      </div>

      {!aiOnly && !blocksUnavailable && activeAction === "blocks" && (
        <BlocksPanel
          disabled={editingDisabled}
          presentationId={presentationId}
          presentationData={presentationData}
          onInsertBlock={onBlockSelect}
        />
      )}
      {!aiOnly && activeAction === "texts" && (
        <InsertPanel
          disabled={editingDisabled}
          title="Texts"
          groups={[{ label: "Add", items: textItems }]}
          onItemSelect={onTextItemSelect}
          previewKind="text"
          theme={templateTheme}
        />
      )}
      {!aiOnly && activeAction === "charts" && (
        <InsertPanel
          disabled={editingDisabled}
          title="Charts"
          groups={[{ label: "Chart Type", items: chartTypeItems }]}
          onItemSelect={onChartItemSelect}
          previewKind="chart"
          theme={templateTheme}
        />
      )}
      {!aiOnly && activeAction === "infographics" && (
        <InsertPanel
          disabled={editingDisabled}
          title="Infographics"
          groups={[{ label: "Choose a layout", items: infographicItems }]}
          onItemSelect={onInfographicItemSelect}
          previewKind="infographic"
          theme={templateTheme}
        />
      )}
      {!aiOnly && activeAction === "tables" && (
        <InsertPanel
          disabled={editingDisabled}
          title="Tables"
          groups={[{ label: "Table Type", items: tableTypeItems }]}
          onItemSelect={onTableItemSelect}
          previewKind="table"
          theme={templateTheme}
        />
      )}
      {!aiOnly && activeAction === "images" && (
        <InsertPanel
          disabled={editingDisabled}
          title="Images"
          groups={[{ label: "Add", items: imageItems }]}
          onItemSelect={onImageItemSelect}
          previewKind="image"
          theme={templateTheme}
        />
      )}
      {!aiOnly && activeAction === "elements" && (
        <InsertPanel
          disabled={editingDisabled}
          title="Elements"
          groups={elementItemGroups}
          onItemSelect={onElementItemSelect}
          previewKind="element"
          theme={templateTheme}
        />
      )}
    </div>
  );
}

function templateV2TargetKey(
  slideIndex: number | null | undefined,
  target: TemplateV2SurfaceSelectedDetail["selection"],
) {
  if (target?.kind === "element") {
    return `slide:${slideIndex ?? ""}:element:${
      target.elementPath ?? target.componentIndex ?? ""
    }`;
  }
  if (target?.kind === "component") {
    return `slide:${slideIndex ?? ""}:component:${
      target.componentId ?? target.componentIndex ?? ""
    }`;
  }
  if (target?.kind === "multi-component") {
    return `slide:${slideIndex ?? ""}:multi:${target.components
      .map((component) => component.componentId ?? component.componentIndex ?? "")
      .join(".")}`;
  }
  return null;
}

const PresentationActions = (props: PresentationActionsProps) => {
  const {
    editingDisabled = false,
    presentationData,
    panelOpen = true,
    onPanelOpenChange = () => undefined,
    ...chatProps
  } = props;
  const aiOnly = props.presentationType === "smart";
  const blocksUnavailable = isTemplateFreePresentation(presentationData);
  const templateTheme = useMemo(
    () => resolvePresentationTheme(presentationData),
    [presentationData],
  );
  const [{ activeAction }, dispatchUiState] = useReducer(
    presentationActionsUiReducer,
    initialPresentationActionsUiState,
  );
  const [templateV2SelectionContext, setTemplateV2SelectionContext] = useState<{
    slideIndex: number | null;
    target: TemplateV2SurfaceSelectedDetail["selection"];
  }>({ slideIndex: null, target: null });
  const activeTemplateV2Target =
    templateV2SelectionContext.slideIndex === null ||
    typeof props.currentSlide !== "number" ||
    templateV2SelectionContext.slideIndex === props.currentSlide
      ? templateV2SelectionContext.target
      : null;
  const [hiddenSlideReference, setHiddenSlideReference] = useState<number | null>(
    null,
  );
  const [hiddenTargetReferenceKey, setHiddenTargetReferenceKey] = useState<
    string | null
  >(null);
  const targetReferenceKey = templateV2TargetKey(
    props.currentSlide,
    activeTemplateV2Target,
  );
  const selectedTemplateV2Target =
    targetReferenceKey && targetReferenceKey !== hiddenTargetReferenceKey
      ? activeTemplateV2Target
      : null;
  const chatSlide =
    typeof chatProps.currentSlide === "number" &&
    chatProps.currentSlide === hiddenSlideReference
      ? undefined
      : chatProps.currentSlide;

  useEffect(() => {
    if (
      (aiOnly || (blocksUnavailable && activeAction === "blocks")) &&
      activeAction !== "ai"
    ) {
      dispatchUiState({ type: "selectAction", activeAction: "ai" });
    }
  }, [activeAction, aiOnly, blocksUnavailable]);

  useEffect(() => {
    setHiddenSlideReference(null);
    setHiddenTargetReferenceKey(null);
  }, [props.currentSlide]);

  useEffect(() => {
    const handleSurfaceSelected = (event: Event) => {
      const detail = (event as CustomEvent<TemplateV2SurfaceSelectedDetail>).detail;
      const nextSelection = detail?.selection ?? null;
      if (nextSelection) {
        setHiddenTargetReferenceKey(null);
      }
      setTemplateV2SelectionContext({
        slideIndex:
          typeof detail?.slideIndex === "number" ? detail.slideIndex : null,
        target: nextSelection,
      });
    };

    window.addEventListener(
      TEMPLATE_V2_SURFACE_SELECTED_EVENT,
      handleSurfaceSelected,
    );
    return () => {
      window.removeEventListener(
        TEMPLATE_V2_SURFACE_SELECTED_EVENT,
        handleSurfaceSelected,
      );
    };
  }, []);

  const insertEditorContent = (
    content: EditorInsertContent,
    label: string,
  ): boolean => {
    if (editingDisabled) return false;
    if (typeof window === "undefined") return false;
    if (typeof props.currentSlide !== "number") {
      notify.warning("Select a slide", "Choose a slide before adding content.");
      return false;
    }
    if (
      (content.elements?.length ?? 0) === 0 &&
      (content.components?.length ?? 0) === 0
    ) {
      return false;
    }

    const detail: TemplateV2InsertElementsDetail = {
      ...content,
      label,
      slideIndex: props.currentSlide,
    };

    window.dispatchEvent(
      new CustomEvent(TEMPLATE_V2_INSERT_ELEMENTS_EVENT, { detail }),
    );

    if (!detail.handled) {
      notify.warning(
        "Insert unavailable",
        "Content can be added only to slides imported through the slide editor.",
      );
      return false;
    }

    window.requestAnimationFrame(() => {
      document.getElementById(`slide-${props.currentSlide}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
    return true;
  };

  const insertEditorElements = (elements: SlideElement[], label: string) => {
    return insertEditorContent({ elements }, label);
  };

  const handleTextItemSelect = (item: PaletteItem) => {
    if (
      insertEditorElements(
        createTextInsertElements(item.id, templateTheme),
        item.label,
      )
    ) {
      trackEvent(MixpanelEvent.Editor_Insert_Palette_Item_Selected, {
        presentation_id: props.presentationId,
        category: "texts",
        item_id: item.id,
        item_label: item.label,
        slide_index: props.currentSlide,
      });
    }
  };

  const handleChartItemSelect = (item: PaletteItem) => {
    const chartElements = createChartInsertElements(item.id, templateTheme);
    if (insertEditorElements(chartElements, item.label)) {
      trackEvent(MixpanelEvent.Editor_Insert_Palette_Item_Selected, {
        presentation_id: props.presentationId,
        category: "charts",
        item_id: item.id,
        item_label: item.label,
        slide_index: props.currentSlide,
      });
    }
  };

  const handleInfographicItemSelect = (item: PaletteItem) => {
    const infographicElements = createInfographicInsertElements(
      item.id,
      templateTheme,
    );
    if (insertEditorElements(infographicElements, item.label)) {
      trackEvent(MixpanelEvent.Editor_Insert_Palette_Item_Selected, {
        presentation_id: props.presentationId,
        category: "infographics",
        item_id: item.id,
        item_label: item.label,
        slide_index: props.currentSlide,
      });
    }
  };

  const handleTableItemSelect = (item: PaletteItem) => {
    if (
      insertEditorElements(
        createTableInsertElements(item.id, templateTheme),
        item.label,
      )
    ) {
      trackEvent(MixpanelEvent.Editor_Insert_Palette_Item_Selected, {
        presentation_id: props.presentationId,
        category: "tables",
        item_id: item.id,
        item_label: item.label,
        slide_index: props.currentSlide,
      });
    }
  };

  const handleImageItemSelect = (item: PaletteItem) => {
    if (
      insertEditorContent(
        createImageInsertContent(item.id, templateTheme),
        item.label,
      )
    ) {
      trackEvent(MixpanelEvent.Editor_Insert_Palette_Item_Selected, {
        presentation_id: props.presentationId,
        category: "images",
        item_id: item.id,
        item_label: item.label,
        slide_index: props.currentSlide,
      });
    }
  };

  const handleElementItemSelect = (item: PaletteItem) => {
    if (
      insertEditorElements(
        createElementInsertElements(item.id, templateTheme),
        item.label,
      )
    ) {
      trackEvent(MixpanelEvent.Editor_Insert_Palette_Item_Selected, {
        presentation_id: props.presentationId,
        category: "elements",
        item_id: item.id,
        item_label: item.label,
        slide_index: props.currentSlide,
      });
    }
  };

  const handleBlockSelect = (block: TemplateBlock) => {
    if (blocksUnavailable) return;

    if (
      isRecord(block.raw) &&
      hasUsableComponentSize(block.raw) &&
      readRecordArray(block.raw, "elements").length > 0
    ) {
      const inserted = insertEditorContent(
        { components: [block.raw as TemplateV2InsertComponent] },
        block.title,
      );
      if (inserted) {
        trackEvent(MixpanelEvent.Editor_Template_Block_Inserted, {
          presentation_id: props.presentationId,
          block_title: block.title,
          block_index: block.index,
          element_count: readRecordArray(block.raw, "elements").length,
          slide_index: props.currentSlide,
        });
      }
      return;
    }

    const element = adaptTemplateV2ComponentToElement(block.raw, block.index);
    if (!element) {
      notify.warning(
        "Component unavailable",
        "This template component cannot be inserted yet.",
      );
      return;
    }

    if (insertEditorElements([element], block.title)) {
      trackEvent(MixpanelEvent.Editor_Template_Block_Inserted, {
        presentation_id: props.presentationId,
        block_title: block.title,
        block_index: block.index,
        element_count: 1,
        slide_index: props.currentSlide,
      });
    }
  };

  const handleActionSelect = (nextAction: ActionId) => {
    if (aiOnly && nextAction !== "ai") {
      return;
    }
    if (blocksUnavailable && nextAction === "blocks") {
      return;
    }

    if (panelOpen && nextAction === activeAction) {
      onPanelOpenChange(false);
      return;
    }

    trackEvent(MixpanelEvent.Editor_Side_Panel_Tab_Selected, {
      presentation_id: props.presentationId,
      tab: nextAction,
      variant: "template-v2",
    });
    dispatchUiState({ type: "selectAction", activeAction: nextAction });
    onPanelOpenChange(true);
  };

  return (
    <div
      data-inline-edit-ignore="true"
      className="flex h-full w-full overflow-hidden bg-white text-[clamp(12px,0.82vw,14px)]"
    >
      {panelOpen ? (
        <ActionsPanel
          activeAction={activeAction}
          aiOnly={aiOnly}
          blocksUnavailable={blocksUnavailable}
          chatProps={{
            ...chatProps,
            currentSlide: chatSlide,
            selectedTemplateV2Target,
            onClearChatSlideReference:
              typeof chatProps.currentSlide === "number"
                ? () => setHiddenSlideReference(chatProps.currentSlide!)
                : undefined,
            onClearChatTargetReference: targetReferenceKey
              ? () => setHiddenTargetReferenceKey(targetReferenceKey)
              : undefined,
          }}
          editingDisabled={editingDisabled}
          onBlockSelect={handleBlockSelect}
          onChartItemSelect={handleChartItemSelect}
          onInfographicItemSelect={handleInfographicItemSelect}
          onElementItemSelect={handleElementItemSelect}
          onImageItemSelect={handleImageItemSelect}
          onTableItemSelect={handleTableItemSelect}
          onTextItemSelect={handleTextItemSelect}
          presentationData={presentationData}
          presentationId={props.presentationId}
          templateTheme={templateTheme}
        />
      ) : null}
      <ActionsSidebar
        activeAction={activeAction}
        aiOnly={aiOnly}
        blocksUnavailable={blocksUnavailable}
        onActionSelect={handleActionSelect}
      />
    </div>
  );
};

export default PresentationActions;
