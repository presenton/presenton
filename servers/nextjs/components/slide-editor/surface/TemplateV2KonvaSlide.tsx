"use client";

import {
  useCallback,
  useEffect,
  useId,
  memo,
  useMemo,
  useRef,
  useState,
  type ChangeEvent as ReactChangeEvent,
} from "react";
import type Konva from "konva";
import { useDispatch } from "react-redux";
import { Loader2 } from "lucide-react";
import { Layer, Line, Rect, Stage } from "react-konva";
import { notify } from "@/components/ui/sonner";
import type { TemplateV2Layout } from "@/components/slide-editor/importing/template-v2-import";
import {
  templateFontOptionsFromMap,
} from "@/components/slide-editor/text/google-fonts";
import {
  canUngroupTemplateV2Component,
  ungroupTemplateV2ComponentInUi,
} from "@/components/slide-editor/model/template-v2-ungroup";
import {
  groupTemplateV2ComponentsInUi,
  isTemplateV2GroupShortcut,
} from "@/components/slide-editor/model/template-v2-group";
import { textRunsContent } from "@/components/slide-editor/text/text-runs";

import {
  normalizeRawTextMarkdownElement,
  rawTextContent,
  rawTextListRunsForEditor,
  rawTextRunsForEditor,
  rawTextStyle,
  setRawTextListRunsContent,
  setRawTextRunsContent,
} from "@/components/slide-editor/text/template-v2-text";
import type {
  Marker,
  SlideElement,
  TextRun,
} from "@/components/slide-editor/types";
import {
  useTableCellSelection,
  useTemplateV2InlineEditing,
  type ChartSlideElement,
  type TableSlideElement,
} from "@/components/slide-editor/state/state";
import { ElementToolbar } from "@/components/slide-editor/toolbar/ElementToolbar";
import { ChartDataEditorPopover } from "@/components/slide-editor/charts/ChartEditorContent";
import { TableInlineEditor } from "@/components/slide-editor/tables/TableInlineEditor";
import { TemplateV2InlineEditor } from "@/components/slide-editor/text/TemplateV2InlineEditor";
import {
  measureWordWrappedTextRunsHeight,
  type TemplateV2InlineEditBox,
  type TemplateV2TextEditStyle,
  wordWrappedTextRuns,
} from "@/components/slide-editor/text/template-v2-text-editing";


import { updateSlideUi } from "@/store/slices/presentationGeneration";
import { useNearViewport } from "@/app/hooks/useNearViewport";
import { resolveBackendAssetSource } from "@/utils/api";
import { bucketFileSize, sanitizeAnalyticsError } from "@/utils/analytics";
import { MixpanelEvent, trackEvent } from "@/utils/mixpanel";
import { ImagesApi } from "@/app/(presentation-generator)/services/api/images";
import IconsEditor from "@/components/slide-editor/images/IconsEditor";
import {
  createTemplateV2ClipboardPayload,
  pasteTemplateV2ClipboardPayload,
  type TemplateV2ClipboardPayload,
} from "@/components/slide-editor/clipboard/clipboard";
import { useTemplateV2Clipboard } from "@/components/slide-editor/clipboard/useClipboard";
import {
  isTemplateV2FlowLayoutElement,
  isTemplateV2GroupElement,
  isTemplateV2LayoutElement,
  type TemplateV2SelectionComponentActions,
} from "@/components/slide-editor/layout/LayoutToolbar";
import { TemplateV2SelectionToolbar } from "@/components/slide-editor/selection/SelectionToolbar";
import {
  getTemplateV2SelectionToolbarAnchorBox,
  getTemplateV2SelectionToolbarBounds,
  getTemplateV2SelectionToolbarPosition,
  hasTemplateV2SelectionToolbar,
} from "@/components/slide-editor/selection/toolbarPosition";
import {
  getTemplateV2SelectionChartToolbarTarget,
  getTemplateV2SelectionEditorToolbarTarget,
  getTemplateV2SelectionTableToolbarTarget,
  getTemplateV2SelectionToolbarTarget,
} from "@/components/slide-editor/selection/toolbarTarget";
import { updateComponentLayoutElement } from "@/components/slide-editor/layout/layoutResize";
import {
  componentLayerActionForShortcut,
  reorderComponentLayer,
  type ComponentLayerAction,
} from "@/components/slide-editor/selection/layering";
import { TemplateV2SelectionTransformers } from "@/components/slide-editor/selection/SelectionTransformers";
import { useFontLoadState } from "@/components/slide-editor/surface/fontLoading";
import {
  createAlignmentSnapTargets,
  snapBoxToAlignmentGuides,
  type AlignmentGuide,
  type AlignmentSnapTargets,
} from "@/components/slide-editor/surface/alignmentGuides";
import {
  MemoizedRawComponentNode,
  MemoizedRawElementNode,
} from "@/components/slide-editor/surface/nodes";
import {
  MAX_HISTORY_ENTRIES,
  ROOT_ELEMENTS_COMPONENT_INDEX,
  SCROLL_DISMISS_THRESHOLD_PX,
  STAGE_BOX,
  STAGE_HEIGHT,
  STAGE_WIDTH,
  absoluteBoxForSelection,
  absoluteInlineEditBox,
  appendInsertedContent,
  asRecord,
  backgroundColor,
  boxContainingBoxes,
  childArrayInfo,
  childrenBounds,
  cloneJson,
  componentBox,
  componentForClipboardSelection,
  componentIndexesForSelection,
  deleteSelectionFromUi,
  editorChartToRawChart,
  elementBox,
  elementSize,
  elementWithInlineDraft,
  elementWithNormalizedLayoutChildren,
  eventTargetsThisSlide,
  getElementAtSelection,
  syncComponentHeightToElement,
  isEditableTarget,
  isManualPositioned,
  isRecord,
  isRawIconElement,
  isVectorType,
  keyForSelection,
  keysForSelection,
  layoutChildren,
  normalizeMarkdownTextInUi,
  componentKey,
  mergeEditorToolbarElement,
  rawChartToEditorChart,
  rawElementForEditorToolbar,
  rawElementKey,
  rawIconQuery,
  readArray,
  readPoint,
  readString,
  renderedLocalBoxForElementSelection,
  rootElementsComponent,
  selectionForComponentIndexes,
  selectionForInsertedComponent,
  selectionWithComponentToggle,
  setComponentPositionsInUi,
  surfaceSelectionTarget,
  updateComponentInUi,
  updateElementInUi,
  type Box,
  type ComponentSelection,
  type ElementSelection,
  type MultiComponentDragState,
  type Point,
  type RawComponent,
  type RawElement,
  type RawUi,
  type SelectOptions,
  type Selection,
  type UnknownRecord,
} from "@/components/slide-editor/model/model";
import {
  TEMPLATE_V2_ACTIVATE_SURFACE_EVENT,
  TEMPLATE_V2_INSERT_ELEMENTS_EVENT,
  TEMPLATE_V2_SURFACE_SELECTED_EVENT,
  type TemplateV2ActivateSurfaceDetail,
  type TemplateV2InsertElementsDetail,
  type TemplateV2SurfaceSelectedDetail,
} from "@/components/slide-editor/events/events";

function autoSizeInlineTextFrame(
  frame: TemplateV2InlineEditBox | null | undefined,
  runs: TextRun[],
  style: TemplateV2TextEditStyle,
) {
  if (!frame) return frame;
  const contentHeight = measureWordWrappedTextRunsHeight(
    runs,
    frame.width,
    style,
  );
  return {
    ...frame,
    height: Math.max(1, contentHeight),
  };
}

function canEditVectorPointsForSelection(ui: RawUi, selection: ElementSelection) {
  if (selection.componentIndex === ROOT_ELEMENTS_COMPONENT_INDEX) return true;
  if (selection.elementPath.length !== 1) return false;
  const component = asRecord(readArray(ui.components)[selection.componentIndex]);
  const elements = readArray(component?.elements).filter(isRecord);
  return elements.length === 1;
}

const MIN_EDITING_SCENE_PIXEL_RATIO = 1;
const MAX_EDITING_SCENE_PIXEL_RATIO = 2;

function syncEditingScenePixelRatio(
  layer: Konva.Layer | null,
  displayScale: number,
) {
  if (!layer || typeof window === "undefined") return;
  const safeDisplayScale = Number.isFinite(displayScale)
    ? Math.max(0, displayScale)
    : 1;
  const pixelRatio = Math.min(
    MAX_EDITING_SCENE_PIXEL_RATIO,
    Math.max(
      MIN_EDITING_SCENE_PIXEL_RATIO,
      (window.devicePixelRatio || 1) * safeDisplayScale,
    ),
  );
  const canvas = layer.getCanvas();
  if (Math.abs(canvas.getPixelRatio() - pixelRatio) < 0.01) return;
  canvas.setPixelRatio(pixelRatio);
  layer.batchDraw();
}

function componentIndexForLayerShortcut(selection: Selection) {
  if (!selection) return null;
  if (selection.kind !== "component" && selection.kind !== "element") {
    return null;
  }
  if (selection.componentIndex === ROOT_ELEMENTS_COMPONENT_INDEX) return null;
  return selection.componentIndex;
}

export {
  TEMPLATE_V2_ACTIVATE_SURFACE_EVENT,
  TEMPLATE_V2_INSERT_ELEMENTS_EVENT,
  TEMPLATE_V2_SURFACE_SELECTED_EVENT,
  type TemplateV2ActivateSurfaceDetail,
  type TemplateV2InsertElementsDetail,
  type TemplateV2SurfaceSelectedDetail,
} from "@/components/slide-editor/events/events";

type TemplateV2KonvaSlideProps = {
  layout: TemplateV2Layout;
  isEditMode: boolean;
  slideId?: string | number | null;
  presentationId?: string;
  slideIndex: number;
  renderIndex?: number;
  fonts?: unknown;
  displayScale?: number;
  enableViewportCulling?: boolean;
  isSelected?: boolean;
  historyCommand?: { action: "undo" | "redo"; token: number } | null;
  onHistoryAvailabilityChange?: (availability: {
    canUndo: boolean;
    canRedo: boolean;
  }) => void;
  onLayoutChange?: (layout: TemplateV2Layout) => void;
};

type ComponentAlignmentDragState = {
  draggedComponentIndex: number;
  draggedNodeStart: Point;
  movingBoxStart: Box;
  targets: AlignmentSnapTargets;
};

type ElementAlignmentDragState = {
  draggedKey: string;
  draggedNodeStart: Point;
  movingBoxStart: Box;
  targets: AlignmentSnapTargets;
};

const ALIGNMENT_GUIDE_COLOR = "#D946EF";
const ALIGNMENT_GUIDE_SNAP_DISTANCE_PX = 5;

function renderedNodeBox(node: Konva.Node, fallback: Box): Box {
  const stage = node.getStage();
  if (!stage) return fallback;
  const rect = node.getClientRect({
    relativeTo: stage,
    skipShadow: true,
    skipStroke: true,
  });
  const values = [rect.x, rect.y, rect.width, rect.height];
  if (!values.every(Number.isFinite) || rect.width <= 0 || rect.height <= 0) {
    return fallback;
  }
  return rect;
}

function pointsForAlignmentGuide(guide: AlignmentGuide) {
  return guide.axis === "vertical"
    ? [guide.coordinate, guide.start, guide.coordinate, guide.end]
    : [guide.start, guide.coordinate, guide.end, guide.coordinate];
}

function syncAlignmentGuideNode(
  node: Konva.Line | null,
  guide: AlignmentGuide | undefined,
) {
  if (!node) return false;
  if (!guide) {
    if (!node.visible()) return false;
    node.visible(false);
    return true;
  }

  const points = pointsForAlignmentGuide(guide);
  const currentPoints = node.points();
  const pointsChanged =
    currentPoints.length !== points.length ||
    points.some((point, index) => Math.abs(point - currentPoints[index]) >= 0.01);
  if (node.visible() && !pointsChanged) return false;
  node.points(points);
  node.visible(true);
  return true;
}

function TemplateV2KonvaSlideComponent({
  layout,
  isEditMode,
  slideId = null,
  presentationId,
  slideIndex,
  renderIndex,
  fonts,
  displayScale = 1,
  enableViewportCulling = false,
  isSelected = false,
  historyCommand = null,
  onHistoryAvailabilityChange,
  onLayoutChange,
}: TemplateV2KonvaSlideProps) {
  const effectiveDisplayScale = Number.isFinite(displayScale)
    ? Math.max(0.1, Math.abs(displayScale))
    : 1;
  const dispatch = useDispatch();
  const surfaceId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [rootElement, setRootElement] = useState<HTMLDivElement | null>(null);
  const nodeRefs = useRef(new Map<string, Konva.Node>());
  const backgroundLayerRef = useRef<Konva.Layer | null>(null);
  const contentLayerRef = useRef<Konva.Layer | null>(null);
  const alignmentGuideLayerRef = useRef<Konva.Layer | null>(null);
  const verticalAlignmentGuideRef = useRef<Konva.Line | null>(null);
  const horizontalAlignmentGuideRef = useRef<Konva.Line | null>(null);
  const imageUploadInputRef = useRef<HTMLInputElement | null>(null);
  const pendingImageUploadRef = useRef<ElementSelection | null>(null);
  const undoStackRef = useRef<RawUi[]>([]);
  const redoStackRef = useRef<RawUi[]>([]);
  const handledHistoryCommandTokenRef = useRef<number | null>(null);
  const multiComponentDragRef = useRef<MultiComponentDragState | null>(null);
  const componentAlignmentDragRef =
    useRef<ComponentAlignmentDragState | null>(null);
  const elementAlignmentDragRef =
    useRef<ElementAlignmentDragState | null>(null);
  const showAlignmentGuides = useCallback((guides: AlignmentGuide[]) => {
    const vertical = guides.find((guide) => guide.axis === "vertical");
    const horizontal = guides.find((guide) => guide.axis === "horizontal");
    const verticalChanged = syncAlignmentGuideNode(
      verticalAlignmentGuideRef.current,
      vertical,
    );
    const horizontalChanged = syncAlignmentGuideNode(
      horizontalAlignmentGuideRef.current,
      horizontal,
    );
    if (verticalChanged || horizontalChanged) {
      alignmentGuideLayerRef.current?.batchDraw();
    }
  }, []);
  const clearAlignmentGuides = useCallback(
    () => showAlignmentGuides([]),
    [showAlignmentGuides],
  );
  const [uiDraft, setUiDraft] = useState<RawUi>(() =>
    normalizeMarkdownTextInUi(cloneJson(layout as RawUi)),
  );
  const templateFonts = useMemo(() => templateFontOptionsFromMap(fonts), [
    fonts,
  ]);
  const {
    isNearViewport,
    ref: setViewportRoot,
  } = useNearViewport<HTMLDivElement>({
    enabled: enableViewportCulling,
    forceActive: isSelected,
    rootMargin: "800px 0px",
    rootSelector: "[data-presentation-slides-scroll-container='true']",
  });
  const isRenderActive = !enableViewportCulling || isNearViewport;
  const fontLoadState = useFontLoadState(
    uiDraft,
    templateFonts,
    isRenderActive,
  );
  const currentUiRef = useRef<RawUi>(uiDraft);
  const [selection, setSelection] = useState<Selection>(null);
  const selectionRef = useRef<Selection>(selection);
  const {
    inlineEdit,
    clearInlineEdit,
    startInlineEdit,
    updateInlineDraft,
    updateInlineEdit,
    updateInlineTextSelectionRange,
  } = useTemplateV2InlineEditing<ElementSelection>({
    keyForSelection,
  });
  const [vectorEditSelection, setVectorEditSelection] =
    useState<ElementSelection | null>(null);
  const vectorEditingKey = vectorEditSelection
    ? keyForSelection(vectorEditSelection)
    : null;
  const [iconEditorSelection, setIconEditorSelection] =
    useState<ElementSelection | null>(null);
  const [chartEditorSelection, setChartEditorSelection] =
    useState<ElementSelection | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageCropActive, setImageCropActive] = useState(false);
  const [, setHistoryAvailability] = useState({
    canUndo: false,
    canRedo: false,
  });
  const publishHistoryAvailability = useCallback(() => {
    const availability = {
      canUndo: undoStackRef.current.length > 0,
      canRedo: redoStackRef.current.length > 0,
    };
    setHistoryAvailability(availability);
    onHistoryAvailabilityChange?.(availability);
  }, [onHistoryAvailabilityChange]);
  const {
    clearTableCellEditing,
    clearTableCellSelection,
    editingTableCell,
    editTableCellSelection,
    selectedTableCell,
    selectTableCellSelection,
    visibleSelectedTableCell,
  } = useTableCellSelection<Selection, ElementSelection>({
    keyForSelection,
    selection,
  });
  const setRootNode = useCallback((node: HTMLDivElement | null) => {
    rootRef.current = node;
    setRootElement(node);
    setViewportRoot(node);
  }, [setViewportRoot]);

  const components = useMemo(
    () => readArray(uiDraft.components).filter(isRecord) as RawComponent[],
    [uiDraft.components],
  );
  const rootElements = useMemo(
    () => readArray(uiDraft.elements).filter(isRecord) as RawElement[],
    [uiDraft.elements],
  );
  const setSelectionNodeRef = useCallback(
    (key: string, node: Konva.Node | null) => {
      if (node) nodeRefs.current.set(key, node);
      else nodeRefs.current.delete(key);
    },
    [],
  );
  const selectedComponentIndexes = useMemo(
    () => componentIndexesForSelection(selection),
    [selection],
  );
  const selectedComponentIndexesRef = useRef<number[]>(selectedComponentIndexes);
  const selectedComponentIndexSet = useMemo(
    () => new Set(selectedComponentIndexes),
    [selectedComponentIndexes],
  );
  const selectedKeys = useMemo(() => keysForSelection(selection), [selection]);
  const selectedKey = selectedKeys.length === 1 ? selectedKeys[0] : null;
  const selectedParentComponentKey =
    selection?.kind === "element" &&
      selection.componentIndex !== ROOT_ELEMENTS_COMPONENT_INDEX
      ? keyForSelection({
        kind: "component",
        componentIndex: selection.componentIndex,
      })
      : null;
  const editingKey = inlineEdit ? keyForSelection(inlineEdit.selection) : null;
  const selectedElement =
    selection?.kind === "element"
      ? getElementAtSelection(uiDraft, selection)
      : null;
  const selectedComponent =
    selection?.kind === "component"
      ? asRecord(readArray(uiDraft.components)[selection.componentIndex])
      : null;
  const selectedBox = selection
    ? absoluteBoxForSelection(uiDraft, selection)
    : null;
  const layoutToolbarTarget = useMemo(
    () =>
      getTemplateV2SelectionToolbarTarget({
        selection,
        selectedBox,
        selectedComponent,
        selectedElement,
        absoluteBoxForSelection: (targetSelection) =>
          absoluteBoxForSelection(uiDraft, targetSelection),
      }),
    [selectedBox, selectedComponent, selectedElement, selection, uiDraft],
  );
  const chartToolbarTarget = useMemo(
    () =>
      layoutToolbarTarget
        ? null
        : getTemplateV2SelectionChartToolbarTarget({
            selection,
            selectedBox,
            selectedComponent,
            selectedElement,
            absoluteBoxForSelection: (targetSelection) =>
              absoluteBoxForSelection(uiDraft, targetSelection),
          }),
    [
      layoutToolbarTarget,
      selectedBox,
      selectedComponent,
      selectedElement,
      selection,
      uiDraft,
    ],
  );
  const tableToolbarTarget = useMemo(
    () =>
      layoutToolbarTarget || chartToolbarTarget || editingTableCell
        ? null
        : getTemplateV2SelectionTableToolbarTarget({
            selection,
            selectedBox,
            selectedComponent,
            selectedElement,
            absoluteBoxForSelection: (targetSelection) =>
              absoluteBoxForSelection(uiDraft, targetSelection),
          }),
    [
      chartToolbarTarget,
      editingTableCell,
      layoutToolbarTarget,
      selectedBox,
      selectedComponent,
      selectedElement,
      selection,
      uiDraft,
    ],
  );
  const editorToolbarTarget = useMemo(
    () =>
      layoutToolbarTarget || chartToolbarTarget || tableToolbarTarget
        ? null
        : getTemplateV2SelectionEditorToolbarTarget({
            selection,
            selectedBox,
            selectedComponent,
            selectedElement,
            absoluteBoxForSelection: (targetSelection) =>
              absoluteBoxForSelection(uiDraft, targetSelection),
          }),
    [
      chartToolbarTarget,
      layoutToolbarTarget,
      selectedBox,
      selectedComponent,
      selectedElement,
      selection,
      tableToolbarTarget,
      uiDraft,
    ],
  );
  const horizontalResizeOnly = false;
  const selectedIsVectorElement =
    selection?.kind === "element" &&
    isVectorType(readString(selectedElement?.type));
  const selectedIsImageElement =
    selection?.kind === "element" &&
    readString(selectedElement?.type) === "image";
  const selectedCanEditVectorPoints =
    selection?.kind === "element" &&
    canEditVectorPointsForSelection(uiDraft, selection);
  const selectedIsVectorPointEditing =
    selectedIsVectorElement &&
    selection?.kind === "element" &&
    selectedCanEditVectorPoints &&
    vectorEditingKey === keyForSelection(selection);
  const shouldHideParentComponentBoundary =
    inlineEdit || selectedIsVectorElement || imageCropActive;
  const transformerParentComponentKey = shouldHideParentComponentBoundary
    ? null
    : selectedParentComponentKey;
  const toolbarElement = useMemo(
    () => {
      if (!selectedElement || !selectedBox) return null;
      const inlineTextElement =
        inlineEdit &&
          inlineEdit.kind === "text" &&
          inlineEdit.runs &&
          selection?.kind === "element" &&
          keyForSelection(inlineEdit.selection) === keyForSelection(selection)
          ? setRawTextRunsContent(selectedElement, inlineEdit.runs)
          : inlineEdit &&
            inlineEdit.kind === "text-list" &&
            inlineEdit.runs &&
            selection?.kind === "element" &&
            keyForSelection(inlineEdit.selection) === keyForSelection(selection)
            ? setRawTextListRunsContent(selectedElement, inlineEdit.runs)
            : selectedElement;
      return rawElementForEditorToolbar(inlineTextElement, selectedBox);
    },
    [inlineEdit, selectedBox, selectedElement, selection],
  );
  const canUngroupSelectedComponent = useMemo(
    () =>
      selection?.kind === "component" &&
      selectedComponent != null &&
      canUngroupTemplateV2Component(selectedComponent),
    [selectedComponent, selection],
  );
  const canUngroupLayoutTargetComponent = useMemo(() => {
    const componentIndex = layoutToolbarTarget?.selection.componentIndex;
    if (
      componentIndex == null ||
      componentIndex < 0 ||
      !layoutToolbarTarget ||
      (!isTemplateV2FlowLayoutElement(layoutToolbarTarget.element) &&
        !isTemplateV2GroupElement(layoutToolbarTarget.element))
    ) {
      return false;
    }
    const component = asRecord(readArray(uiDraft.components)[componentIndex]);
    return canUngroupTemplateV2Component(component);
  }, [layoutToolbarTarget, uiDraft.components]);
  const [, setToolbarViewportVersion] = useState(0);
  const hasDismissibleEditorUi = Boolean(
    selection ||
    inlineEdit ||
    iconEditorSelection ||
    chartEditorSelection ||
    selectedTableCell ||
    editingTableCell,
  );
  const floatingToolbarAnchorBox = getTemplateV2SelectionToolbarAnchorBox({
    chartTarget: chartToolbarTarget,
    layoutTarget: layoutToolbarTarget,
    selectedBox,
    selection,
    tableTarget: tableToolbarTarget,
  });
  const hasFloatingToolbar = hasTemplateV2SelectionToolbar({
    anchorBox: floatingToolbarAnchorBox,
    chartTarget: chartToolbarTarget,
    isEditMode,
    layoutTarget: layoutToolbarTarget,
    selection,
    tableTarget: tableToolbarTarget,
  });
  const selectionToolbarPosition = getTemplateV2SelectionToolbarPosition({
    anchorBox: floatingToolbarAnchorBox,
    chartTarget: chartToolbarTarget,
    layoutTarget: layoutToolbarTarget,
    root: rootElement,
    selection,
    tableTarget: tableToolbarTarget,
  });
  const selectionToolbarBounds =
    getTemplateV2SelectionToolbarBounds(rootElement);
  const inlineEditBox = inlineEdit
    ? absoluteInlineEditBox(uiDraft, inlineEdit.selection, inlineEdit.frame)
    : null;
  const iconEditorElement = iconEditorSelection
    ? getElementAtSelection(uiDraft, iconEditorSelection)
    : null;
  const chartEditorElement = chartEditorSelection
    ? getElementAtSelection(uiDraft, chartEditorSelection)
    : null;
  const surfaceSlideIndex = useMemo(() => {
    const index = typeof renderIndex === "number" ? renderIndex : slideIndex;
    return Number.isFinite(index) ? index : null;
  }, [renderIndex, slideIndex]);
  const editorAnalyticsProps = useCallback(
    (props: Record<string, unknown> = {}) => ({
      presentation_id: presentationId ?? null,
      slide_index: surfaceSlideIndex ?? slideIndex,
      ...props,
    }),
    [presentationId, slideIndex, surfaceSlideIndex],
  );
  const selectedSurfaceTarget = useMemo(
    () => surfaceSelectionTarget(uiDraft, selection, surfaceSlideIndex),
    [selection, surfaceSlideIndex, uiDraft],
  );
  const toolbarSelectedTableCell =
    tableToolbarTarget &&
    selectedTableCell?.elementPath ===
      keyForSelection(tableToolbarTarget.selection)
      ? selectedTableCell
      : null;
  useEffect(() => {
    selectionRef.current = selection;
  }, [selection]);

  useEffect(() => {
    if (!isRenderActive || !fontLoadState.ready) return;
    contentLayerRef.current?.batchDraw();
  }, [fontLoadState.ready, fontLoadState.revision, isRenderActive]);

  useEffect(() => {
    if (!isEditMode || !isRenderActive || typeof window === "undefined") {
      return;
    }
    const refreshPixelRatio = () => {
      syncEditingScenePixelRatio(backgroundLayerRef.current, displayScale);
      syncEditingScenePixelRatio(contentLayerRef.current, displayScale);
      syncEditingScenePixelRatio(alignmentGuideLayerRef.current, displayScale);
    };
    refreshPixelRatio();
    window.addEventListener("resize", refreshPixelRatio);
    return () => window.removeEventListener("resize", refreshPixelRatio);
  }, [displayScale, isEditMode, isRenderActive]);

  useEffect(() => {
    selectedComponentIndexesRef.current = selectedComponentIndexes;
  }, [selectedComponentIndexes]);

  useEffect(() => {
    if (layout === currentUiRef.current) return;
    const next = normalizeMarkdownTextInUi(cloneJson(layout as RawUi));
    currentUiRef.current = next;
    setUiDraft(next);
    componentAlignmentDragRef.current = null;
    elementAlignmentDragRef.current = null;
    multiComponentDragRef.current = null;
    clearAlignmentGuides();
    setSelection(null);
    clearTableCellSelection();
    clearInlineEdit();
    setVectorEditSelection(null);
    setIconEditorSelection(null);
    setChartEditorSelection(null);
    undoStackRef.current = [];
    redoStackRef.current = [];
    publishHistoryAvailability();
  }, [
    clearAlignmentGuides,
    clearInlineEdit,
    clearTableCellSelection,
    layout,
    publishHistoryAvailability,
  ]);

  useEffect(() => {
    if (
      !isRenderActive ||
      !hasFloatingToolbar ||
      typeof window === "undefined"
    ) {
      return;
    }
    let frame = 0;
    const refreshToolbarPosition = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        setToolbarViewportVersion((version) => version + 1);
      });
    };
    window.addEventListener("resize", refreshToolbarPosition);
    refreshToolbarPosition();
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", refreshToolbarPosition);
    };
  }, [hasFloatingToolbar, isRenderActive]);

  const isSurfaceActive = useCallback(
    () =>
      typeof document !== "undefined" &&
      document.documentElement.dataset.templateV2KonvaActiveSurface === surfaceId,
    [surfaceId],
  );

  const activateSurface = useCallback((nextSelection?: Selection) => {
    if (
      !isEditMode ||
      typeof document === "undefined" ||
      typeof window === "undefined"
    ) {
      return;
    }
    document.documentElement.dataset.templateV2KonvaActiveSurface = surfaceId;
    if (surfaceSlideIndex != null) {
      document.documentElement.dataset.templateV2KonvaActiveSlideIndex =
        String(surfaceSlideIndex);
    }
    window.dispatchEvent(
      new CustomEvent<TemplateV2SurfaceSelectedDetail>(
        TEMPLATE_V2_SURFACE_SELECTED_EVENT,
        {
          detail: {
            slideId,
            slideIndex: surfaceSlideIndex,
            selection: surfaceSelectionTarget(
              currentUiRef.current,
              nextSelection === undefined ? selectionRef.current : nextSelection,
              surfaceSlideIndex,
            ),
          },
        },
      ),
    );
  }, [isEditMode, slideId, surfaceId, surfaceSlideIndex]);

  useEffect(() => {
    if (
      !isRenderActive ||
      !isEditMode ||
      !isSurfaceActive() ||
      typeof window === "undefined"
    ) {
      return;
    }
    window.dispatchEvent(
      new CustomEvent<TemplateV2SurfaceSelectedDetail>(
        TEMPLATE_V2_SURFACE_SELECTED_EVENT,
        {
          detail: {
            slideId,
            slideIndex: surfaceSlideIndex,
            selection: selectedSurfaceTarget,
          },
        },
      ),
    );
  }, [
    isEditMode,
    isRenderActive,
    isSurfaceActive,
    selectedSurfaceTarget,
    slideId,
    surfaceSlideIndex,
  ]);

  useEffect(() => {
    if (!isEditMode || typeof window === "undefined") return;

    const handleActivateSurface = (event: Event) => {
      const detail = (event as CustomEvent<TemplateV2ActivateSurfaceDetail>)
        .detail;
      if (
        !detail ||
        !eventTargetsThisSlide(detail, slideId, surfaceSlideIndex, () => false)
      ) {
        return;
      }
      activateSurface();
    };

    window.addEventListener(
      TEMPLATE_V2_ACTIVATE_SURFACE_EVENT,
      handleActivateSurface,
    );
    return () =>
      window.removeEventListener(
        TEMPLATE_V2_ACTIVATE_SURFACE_EVENT,
        handleActivateSurface,
      );
  }, [activateSurface, isEditMode, slideId, surfaceSlideIndex]);

  const clearSurface = useCallback(() => {
    if (typeof document === "undefined") return;
    if (
      document.documentElement.dataset.templateV2KonvaActiveSurface === surfaceId
    ) {
      delete document.documentElement.dataset.templateV2KonvaActiveSurface;
      delete document.documentElement.dataset.templateV2KonvaActiveSlideIndex;
    }
  }, [surfaceId]);

  const clearEditorUiState = useCallback(
    (options?: { clearActiveSurface?: boolean }) => {
      multiComponentDragRef.current = null;
      componentAlignmentDragRef.current = null;
      elementAlignmentDragRef.current = null;
      clearAlignmentGuides();
      selectionRef.current = null;
      setSelection(null);
      clearTableCellSelection();
      clearTableCellEditing();
      clearInlineEdit();
      setVectorEditSelection(null);
      setIconEditorSelection(null);
      setChartEditorSelection(null);
      if (options?.clearActiveSurface) {
        clearSurface();
      }
    },
    [
      clearAlignmentGuides,
      clearInlineEdit,
      clearSurface,
      clearTableCellEditing,
      clearTableCellSelection,
    ],
  );

  useEffect(() => {
    if (isEditMode) return;
    clearEditorUiState({ clearActiveSurface: true });
    pendingImageUploadRef.current = null;
  }, [clearEditorUiState, isEditMode]);

  useEffect(() => {
    if (
      !isEditMode ||
      !isRenderActive ||
      !hasDismissibleEditorUi ||
      typeof document === "undefined" ||
      typeof window === "undefined"
    ) {
      return;
    }

    let cleared = false;
    let accumulatedScrollDistance = 0;
    const lastScrollPositionByTarget = new Map<EventTarget, Point>([
      [
        document,
        {
          x: window.scrollX,
          y: window.scrollY,
        },
      ],
    ]);
    const scrollStateForTarget = (target: EventTarget | null) => {
      if (
        target instanceof Element &&
        target !== document.documentElement &&
        target !== document.body
      ) {
        return {
          key: target,
          position: {
            x: target.scrollLeft,
            y: target.scrollTop,
          },
        };
      }

      return {
        key: document,
        position: {
          x: window.scrollX,
          y: window.scrollY,
        },
      };
    };
    const handleScroll = (event: Event) => {
      if (cleared) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("[data-inline-edit-ignore='true']")) return;

      const { key, position } = scrollStateForTarget(event.target);
      const previousPosition = lastScrollPositionByTarget.get(key);
      lastScrollPositionByTarget.set(key, position);
      if (!previousPosition) return;

      accumulatedScrollDistance +=
        Math.abs(position.x - previousPosition.x) +
        Math.abs(position.y - previousPosition.y);
      if (accumulatedScrollDistance < SCROLL_DISMISS_THRESHOLD_PX) return;

      cleared = true;
      clearEditorUiState({ clearActiveSurface: true });
    };

    document.addEventListener("scroll", handleScroll, true);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [
    clearEditorUiState,
    hasDismissibleEditorUi,
    isEditMode,
    isRenderActive,
  ]);

  const commitUi = useCallback(
    (nextUi: RawUi, pushHistory = true) => {
      if (!isEditMode) return;
      if (nextUi === currentUiRef.current) return;
      if (pushHistory) {
        undoStackRef.current.push(currentUiRef.current);
        if (undoStackRef.current.length > MAX_HISTORY_ENTRIES) {
          undoStackRef.current.shift();
        }
        redoStackRef.current = [];
      }
      currentUiRef.current = nextUi;
      setUiDraft(nextUi);
      onLayoutChange?.(nextUi as TemplateV2Layout);
      dispatch(
        updateSlideUi({
          index: surfaceSlideIndex ?? slideIndex,
          ui: nextUi as Record<string, unknown>,
        }),
      );
      publishHistoryAvailability();
    },
    [
      dispatch,
      isEditMode,
      onLayoutChange,
      publishHistoryAvailability,
      slideIndex,
      surfaceSlideIndex,
    ],
  );

  const undo = useCallback(() => {
    const previous = undoStackRef.current.pop();
    if (!previous) return;
    redoStackRef.current.push(currentUiRef.current);
    commitUi(previous, false);
    clearEditorUiState();
  }, [clearEditorUiState, commitUi]);

  const redo = useCallback(() => {
    const next = redoStackRef.current.pop();
    if (!next) return;
    undoStackRef.current.push(currentUiRef.current);
    commitUi(next, false);
    clearEditorUiState();
  }, [clearEditorUiState, commitUi]);

  useEffect(() => {
    if (!historyCommand || !isEditMode) return;
    if (handledHistoryCommandTokenRef.current === historyCommand.token) return;
    handledHistoryCommandTokenRef.current = historyCommand.token;

    if (historyCommand.action === "undo") {
      undo();
      return;
    }
    redo();
  }, [historyCommand, isEditMode, redo, undo]);

  const select = useCallback(
    (nextSelection: Selection, options?: SelectOptions) => {
      clearTableCellSelection();
      const resolvedSelection = selectionWithComponentToggle(
        selectionRef.current,
        nextSelection,
        options,
      );
      selectionRef.current = resolvedSelection;
      setSelection(resolvedSelection);
      setVectorEditSelection((current) =>
        current &&
        resolvedSelection?.kind === "element" &&
        keyForSelection(current) === keyForSelection(resolvedSelection)
          ? current
          : null,
      );
      activateSurface(resolvedSelection);
    },
    [activateSurface, clearTableCellSelection],
  );

  const selectTableCell = useCallback(
    (
      elementSelection: ElementSelection,
      rowIndex: number,
      colIndex: number,
    ) => {
      activateSurface(elementSelection);
      setSelection(elementSelection);
      clearInlineEdit();
      setVectorEditSelection(null);
      setIconEditorSelection(null);
      selectTableCellSelection(elementSelection, rowIndex, colIndex);
    },
    [activateSurface, clearInlineEdit, selectTableCellSelection],
  );

  const editTableCell = useCallback(
    (
      elementSelection: ElementSelection,
      rowIndex: number,
      colIndex: number,
    ) => {
      activateSurface(elementSelection);
      setSelection(elementSelection);
      clearInlineEdit();
      setVectorEditSelection(null);
      setIconEditorSelection(null);
      editTableCellSelection(elementSelection, rowIndex, colIndex);
    },
    [activateSurface, clearInlineEdit, editTableCellSelection],
  );

  const updateComponent = useCallback(
    (
      componentIndex: number,
      updater: (component: RawComponent) => RawComponent,
      pushHistory = true,
    ) => {
      commitUi(updateComponentInUi(currentUiRef.current, componentIndex, updater), pushHistory);
    },
    [commitUi],
  );

  const componentAlignmentTargetBoxes = useCallback(
    (
      movingComponentIndexes: Set<number>,
      movingRootElementIndex: number | null = null,
    ) => {
      const current = currentUiRef.current;
      const currentComponents = readArray(current.components);
      const componentTargets = currentComponents.flatMap((entry, index) => {
        if (movingComponentIndexes.has(index)) return [];
        const component = asRecord(entry);
        if (!component) return [];
        const fallback = componentBox(component);
        const targetNode = nodeRefs.current.get(
          keyForSelection({ kind: "component", componentIndex: index }),
        );
        return [targetNode ? renderedNodeBox(targetNode, fallback) : fallback];
      });
      const rootTargets = readArray(current.elements).flatMap((entry, index) => {
        if (index === movingRootElementIndex) return [];
        const element = asRecord(entry);
        if (!element) return [];
        const fallback = elementBox(element);
        const targetNode = nodeRefs.current.get(
          keyForSelection({
            kind: "element",
            componentIndex: ROOT_ELEMENTS_COMPONENT_INDEX,
            elementPath: [index],
          }),
        );
        return [targetNode ? renderedNodeBox(targetNode, fallback) : fallback];
      });
      return [...componentTargets, ...rootTargets];
    },
    [],
  );

  const snapDraggedComponentToGuides = useCallback(
    (componentIndex: number, node: Konva.Node) => {
      const dragState = componentAlignmentDragRef.current;
      if (
        !dragState ||
        dragState.draggedComponentIndex !== componentIndex
      ) {
        return;
      }
      const position = node.position();
      const rawDelta = {
        x: position.x - dragState.draggedNodeStart.x,
        y: position.y - dragState.draggedNodeStart.y,
      };
      const movingBox = {
        ...dragState.movingBoxStart,
        x: dragState.movingBoxStart.x + rawDelta.x,
        y: dragState.movingBoxStart.y + rawDelta.y,
      };
      const snapped = snapBoxToAlignmentGuides({
        movingBox,
        stageBox: STAGE_BOX,
        targets: dragState.targets,
        threshold:
          ALIGNMENT_GUIDE_SNAP_DISTANCE_PX /
          effectiveDisplayScale,
      });
      const snappedDelta = {
        x: snapped.position.x - dragState.movingBoxStart.x,
        y: snapped.position.y - dragState.movingBoxStart.y,
      };
      node.position({
        x: dragState.draggedNodeStart.x + snappedDelta.x,
        y: dragState.draggedNodeStart.y + snappedDelta.y,
      });
      showAlignmentGuides(snapped.guides);
    },
    [effectiveDisplayScale, showAlignmentGuides],
  );

  const snapDraggedElementToGuides = useCallback(
    (elementSelection: ElementSelection, node: Konva.Node) => {
      const dragState = elementAlignmentDragRef.current;
      if (
        !dragState ||
        dragState.draggedKey !== keyForSelection(elementSelection)
      ) {
        return;
      }
      const position = node.absolutePosition();
      const rawDelta = {
        x: position.x - dragState.draggedNodeStart.x,
        y: position.y - dragState.draggedNodeStart.y,
      };
      const movingBox = {
        ...dragState.movingBoxStart,
        x: dragState.movingBoxStart.x + rawDelta.x,
        y: dragState.movingBoxStart.y + rawDelta.y,
      };
      const snapped = snapBoxToAlignmentGuides({
        movingBox,
        stageBox: STAGE_BOX,
        targets: dragState.targets,
        threshold:
          ALIGNMENT_GUIDE_SNAP_DISTANCE_PX /
          effectiveDisplayScale,
      });
      node.absolutePosition({
        x:
          dragState.draggedNodeStart.x +
          snapped.position.x -
          dragState.movingBoxStart.x,
        y:
          dragState.draggedNodeStart.y +
          snapped.position.y -
          dragState.movingBoxStart.y,
      });
      showAlignmentGuides(snapped.guides);
    },
    [effectiveDisplayScale, showAlignmentGuides],
  );

  const handleElementAlignmentDragStart = useCallback(
    (elementSelection: ElementSelection, node: Konva.Node) => {
      const current = currentUiRef.current;
      const fallback =
        absoluteBoxForSelection(current, elementSelection) ??
        ({
          ...node.absolutePosition(),
          width: Math.max(1, node.width()),
          height: Math.max(1, node.height()),
        } satisfies Box);
      const draggedNodeStart = node.absolutePosition();
      const isRootElement =
        elementSelection.componentIndex === ROOT_ELEMENTS_COMPONENT_INDEX;
      elementAlignmentDragRef.current = {
        draggedKey: keyForSelection(elementSelection),
        draggedNodeStart: {
          x: draggedNodeStart.x,
          y: draggedNodeStart.y,
        },
        movingBoxStart: renderedNodeBox(node, fallback),
        targets: createAlignmentSnapTargets(
          STAGE_BOX,
          componentAlignmentTargetBoxes(
            new Set<number>(
              isRootElement ? [] : [elementSelection.componentIndex],
            ),
            isRootElement ? elementSelection.elementPath[0] ?? null : null,
          ),
        ),
      };
      componentAlignmentDragRef.current = null;
      multiComponentDragRef.current = null;
      clearAlignmentGuides();
    },
    [clearAlignmentGuides, componentAlignmentTargetBoxes],
  );

  const handleElementAlignmentDragMove = useCallback(
    (elementSelection: ElementSelection, node: Konva.Node) => {
      snapDraggedElementToGuides(elementSelection, node);
    },
    [snapDraggedElementToGuides],
  );

  const handleElementAlignmentDragComplete = useCallback(
    (elementSelection: ElementSelection, node: Konva.Node) => {
      snapDraggedElementToGuides(elementSelection, node);
      elementAlignmentDragRef.current = null;
      clearAlignmentGuides();
    },
    [clearAlignmentGuides, snapDraggedElementToGuides],
  );

  const handleComponentDragStart = useCallback(
    (componentIndex: number, node: Konva.Node) => {
      elementAlignmentDragRef.current = null;
      const selectedIndexes = selectedComponentIndexesRef.current;
      const isMultiComponentDrag =
        selectedIndexes.length >= 2 &&
        selectedIndexes.includes(componentIndex);
      const movingIndexes = isMultiComponentDrag
        ? selectedIndexes
        : [componentIndex];
      const sourceComponents = readArray(currentUiRef.current.components);
      const movingBoxes = movingIndexes.flatMap((movingIndex) => {
        const component = asRecord(sourceComponents[movingIndex]);
        if (!component) return [];
        const fallback = componentBox(component);
        const movingNode =
          movingIndex === componentIndex
            ? node
            : nodeRefs.current.get(
                keyForSelection({
                  kind: "component",
                  componentIndex: movingIndex,
                }),
              );
        return [movingNode ? renderedNodeBox(movingNode, fallback) : fallback];
      });
      const draggedNodeStart = node.position();
      componentAlignmentDragRef.current = {
        draggedComponentIndex: componentIndex,
        draggedNodeStart: {
          x: draggedNodeStart.x,
          y: draggedNodeStart.y,
        },
        movingBoxStart:
          movingBoxes.length > 0
            ? boxContainingBoxes(movingBoxes)
            : {
                x: draggedNodeStart.x,
                y: draggedNodeStart.y,
                width: 1,
                height: 1,
              },
        targets: createAlignmentSnapTargets(
          STAGE_BOX,
          componentAlignmentTargetBoxes(new Set(movingIndexes)),
        ),
      };
      clearAlignmentGuides();

      if (!isMultiComponentDrag) {
        multiComponentDragRef.current = null;
        return;
      }

      const nodes = selectedIndexes.flatMap((selectedIndex) => {
        const selectedNode = nodeRefs.current.get(
          keyForSelection({ kind: "component", componentIndex: selectedIndex }),
        );
        if (!selectedNode) return [];
        const nodePosition = selectedNode.position();
        const component = asRecord(sourceComponents[selectedIndex]);
        const modelPosition = component
          ? readPoint(component.position)
          : nodePosition;
        return [
          {
            componentIndex: selectedIndex,
            node: selectedNode,
            nodeStart: { x: nodePosition.x, y: nodePosition.y },
            modelStart: { x: modelPosition.x, y: modelPosition.y },
          },
        ];
      });
      multiComponentDragRef.current = {
        draggedComponentIndex: componentIndex,
        draggedNodeStart: { x: draggedNodeStart.x, y: draggedNodeStart.y },
        nodes,
      };
    },
    [clearAlignmentGuides, componentAlignmentTargetBoxes],
  );

  const handleComponentDragMove = useCallback(
    (componentIndex: number, node: Konva.Node) => {
      snapDraggedComponentToGuides(componentIndex, node);
      const dragState = multiComponentDragRef.current;
      if (!dragState || dragState.draggedComponentIndex !== componentIndex) {
        return;
      }
      const position = node.position();
      const delta = {
        x: position.x - dragState.draggedNodeStart.x,
        y: position.y - dragState.draggedNodeStart.y,
      };
      dragState.nodes.forEach(({ node, nodeStart }) => {
        node.position({
          x: nodeStart.x + delta.x,
          y: nodeStart.y + delta.y,
        });
      });
      node.getLayer()?.batchDraw();
    },
    [snapDraggedComponentToGuides],
  );

  const handleComponentDragEnd = useCallback(
    (componentIndex: number, node: Konva.Node) => {
      snapDraggedComponentToGuides(componentIndex, node);
      componentAlignmentDragRef.current = null;
      clearAlignmentGuides();
      const dragState = multiComponentDragRef.current;
      if (!dragState || dragState.draggedComponentIndex !== componentIndex) {
        updateComponent(componentIndex, (current) => {
          const box = componentBox(current);
          return {
            ...current,
            position: {
              x: node.x() - box.width / 2,
              y: node.y() - box.height / 2,
            },
          };
        });
        return;
      }

      multiComponentDragRef.current = null;
      const position = node.position();
      const delta = {
        x: position.x - dragState.draggedNodeStart.x,
        y: position.y - dragState.draggedNodeStart.y,
      };
      if (Math.abs(delta.x) < 0.01 && Math.abs(delta.y) < 0.01) {
        return;
      }
      commitUi(
        setComponentPositionsInUi(
          currentUiRef.current,
          dragState.nodes.map(({ componentIndex, modelStart }) => ({
            componentIndex,
            position: {
              x: modelStart.x + delta.x,
              y: modelStart.y + delta.y,
            },
          })),
        ),
      );
    },
    [
      clearAlignmentGuides,
      commitUi,
      snapDraggedComponentToGuides,
      updateComponent,
    ],
  );

  const updateElement = useCallback(
    (
      elementSelection: ElementSelection,
      updater: (element: RawElement) => RawElement,
      pushHistory = true,
    ) => {
      commitUi(updateElementInUi(currentUiRef.current, elementSelection, updater), pushHistory);
    },
    [commitUi],
  );

  const closeChartEditor = useCallback(() => {
    setChartEditorSelection(null);
  }, []);

  const deleteComponentAtIndex = useCallback(
    (componentIndex: number) => {
      const components = [...readArray(currentUiRef.current.components)];
      if (componentIndex < 0 || componentIndex >= components.length) return;
      components.splice(componentIndex, 1);
      trackEvent(MixpanelEvent.Editor_Element_Deleted, {
        ...editorAnalyticsProps({
          target_kind: "component",
          element_type: "component",
        }),
      });
      commitUi({ ...currentUiRef.current, components });
      setSelection(null);
      clearTableCellSelection();
      clearInlineEdit();
      setVectorEditSelection(null);
      setIconEditorSelection(null);
      closeChartEditor();
    },
    [
      clearInlineEdit,
      clearTableCellSelection,
      closeChartEditor,
      commitUi,
      editorAnalyticsProps,
    ],
  );

  const deleteSelection = useCallback(() => {
    if (!selection) return;
    const element =
      selection.kind === "element"
        ? getElementAtSelection(currentUiRef.current, selection)
        : null;
    trackEvent(MixpanelEvent.Editor_Element_Deleted, {
      ...editorAnalyticsProps({
        target_kind: selection.kind,
        element_type:
          selection.kind === "element"
            ? readString(element?.type) || "unknown"
            : "component",
      }),
    });
    commitUi(deleteSelectionFromUi(currentUiRef.current, selection));
    setSelection(null);
    clearTableCellSelection();
    clearInlineEdit();
    setVectorEditSelection(null);
    setIconEditorSelection(null);
    closeChartEditor();
  }, [
    clearInlineEdit,
    clearTableCellSelection,
    closeChartEditor,
    commitUi,
    editorAnalyticsProps,
    selection,
  ]);

  const createClipboardPayload = useCallback((): TemplateV2ClipboardPayload | null => {
    const clipboardComponent = componentForClipboardSelection(
      currentUiRef.current,
      selection,
    );
    return clipboardComponent
      ? createTemplateV2ClipboardPayload(
        clipboardComponent.components.map((item) => ({
          data: item.component,
          absoluteBox: item.box,
        })),
      )
      : null;
  }, [selection]);

  const pasteClipboardPayload = useCallback(
    (payload: TemplateV2ClipboardPayload, offset: number) => {
      const result = pasteTemplateV2ClipboardPayload({
        sourceUi: currentUiRef.current,
        payload,
        offset,
      });
      if (!result) return;
      commitUi(result.ui);
      setSelection(result.selection);
      clearTableCellSelection();
      clearInlineEdit();
      setVectorEditSelection(null);
      setIconEditorSelection(null);
      activateSurface(result.selection);
    },
    [activateSurface, clearInlineEdit, clearTableCellSelection, commitUi],
  );

  const duplicateComponentAtIndex = useCallback(
    (componentIndex: number) => {
      const clipboardComponent = componentForClipboardSelection(
        currentUiRef.current,
        { kind: "component", componentIndex },
      );
      if (!clipboardComponent) return;
      trackEvent(MixpanelEvent.Editor_Element_Duplicated, {
        ...editorAnalyticsProps({
          target_kind: "component",
        }),
      });
      pasteClipboardPayload(
        createTemplateV2ClipboardPayload(
          clipboardComponent.components.map((item) => ({
            data: item.component,
            absoluteBox: item.box,
          })),
        ),
        16,
      );
    },
    [editorAnalyticsProps, pasteClipboardPayload],
  );

  const duplicateSelection = useCallback(() => {
    const payload = createClipboardPayload();
    if (!payload) return;
    trackEvent(MixpanelEvent.Editor_Element_Duplicated, {
      ...editorAnalyticsProps({
        target_kind: selection?.kind ?? "selection",
      }),
    });
    pasteClipboardPayload(payload, 16);
  }, [createClipboardPayload, editorAnalyticsProps, pasteClipboardPayload, selection]);

  useTemplateV2Clipboard({
    enabled: isEditMode,
    isSurfaceActive,
    isEditableTarget,
    onCopy: createClipboardPayload,
    onPaste: pasteClipboardPayload,
  });

  const openInlineEditor = useCallback(
    (elementSelection: ElementSelection) => {
      const element = getElementAtSelection(currentUiRef.current, elementSelection);
      if (!element) return;
      clearTableCellEditing();
      setVectorEditSelection(null);
      const type = readString(element.type);
      const frame = renderedLocalBoxForElementSelection(
        currentUiRef.current,
        elementSelection,
      );
      if (type === "text") {
        const normalized = normalizeRawTextMarkdownElement(element);
        if (normalized.changed) {
          updateElement(elementSelection, () => normalized.element, false);
        }
        const style = rawTextStyle(normalized.element);
        const runs = wordWrappedTextRuns(normalized.runs);
        startInlineEdit({
          kind: "text",
          selection: elementSelection,
          draft: textRunsContent(runs),
          runs,
          frame: autoSizeInlineTextFrame(frame, runs, style),
          style,
        });
      } else if (type === "text-list") {
        const runs = wordWrappedTextRuns(rawTextListRunsForEditor(element));
        const style = rawTextStyle(element);
        const marker = readString(element.marker);
        const listMarker: Marker =
          marker === "number" || marker === "none" ? marker : "bullet";
        startInlineEdit({
          kind: "text-list",
          selection: elementSelection,
          draft: textRunsContent(runs),
          runs,
          listMarker,
          frame: autoSizeInlineTextFrame(frame, runs, style),
          style,
        });
      }
    },
    [clearTableCellEditing, startInlineEdit, updateElement],
  );

  const closeInlineEditor = useCallback(
    (commit = true, runsOverride?: TextRun[]) => {
      const current = inlineEdit;
      if (!current) return;
      if (commit) {
        const runs =
          current.kind === "text" || current.kind === "text-list"
            ? runsOverride ?? current.runs
            : current.runs;
        const style =
          (current.kind === "text" || current.kind === "text-list") &&
          current.style
            ? current.style
            : current.style;
        const frame =
          (current.kind === "text" || current.kind === "text-list") &&
          style &&
          runs
            ? autoSizeInlineTextFrame(current.frame, runs, style)
            : current.frame;
        const previousElement = getElementAtSelection(
          currentUiRef.current,
          current.selection,
        );
        const previousContent =
          !previousElement
            ? ""
            : current.kind === "text"
            ? rawTextContent(previousElement as any)
            : textRunsContent(rawTextListRunsForEditor(previousElement as any));
        const nextContent = runsOverride
          ? textRunsContent(runsOverride)
          : current.draft;
        commitUi(
          syncComponentHeightToElement(
            updateElementInUi(
              currentUiRef.current,
              current.selection,
              (element) =>
                elementWithInlineDraft(
                  element,
                  current.kind,
                  runsOverride
                    ? textRunsContent(runsOverride)
                    : current.draft,
                  style,
                  frame,
                  runs,
                ),
            ),
            current.selection,
          ),
        );
        if (previousContent !== nextContent) {
          trackEvent(MixpanelEvent.Editor_Element_Text_Edited, {
            ...editorAnalyticsProps({
              element_type: current.kind,
              target_kind: current.selection.kind,
            }),
          });
        }
      }
      setSelection(current.selection);
      clearInlineEdit();
      setVectorEditSelection(null);
    },
    [clearInlineEdit, commitUi, editorAnalyticsProps, inlineEdit],
  );

  const commitInlineTextRuns = useCallback(
    (elementSelection: ElementSelection, runs: TextRun[]) => {
      updateInlineEdit(elementSelection, (active) => {
        if (active.kind !== "text" && active.kind !== "text-list") {
          return active;
        }
        const nextRuns = wordWrappedTextRuns(runs);
        const style = active.style
          ? active.style
          : undefined;
        return {
          ...active,
          draft: textRunsContent(nextRuns),
          runs: nextRuns,
          style,
          frame:
            style != null
              ? autoSizeInlineTextFrame(active.frame, nextRuns, style)
              : active.frame,
        };
      });
    },
    [updateInlineEdit],
  );

  const applyToolbarElementChange = useCallback(
    (editorElement: SlideElement) => {
      if (selection?.kind !== "element") return;
      const current = getElementAtSelection(currentUiRef.current, selection);
      const box = absoluteBoxForSelection(currentUiRef.current, selection);
      if (!current || !box) return;
      const next = mergeEditorToolbarElement(current, editorElement, box);
      updateElement(selection, () => next);
      trackEvent(MixpanelEvent.Editor_Element_Style_Changed, {
        ...editorAnalyticsProps({
          element_type: readString(current.type) || editorElement.type,
          change_source: "element_toolbar",
        }),
      });
      updateInlineEdit(selection, (active) => {
        if (
          !active?.style ||
          keyForSelection(active.selection) !== keyForSelection(selection)
        ) {
          return active;
        }
        if (active.kind === "text") {
          const runs = wordWrappedTextRuns(rawTextRunsForEditor(next));
          const style = rawTextStyle(next);
          return {
            ...active,
            draft: rawTextContent(next),
            runs,
            style,
            frame: autoSizeInlineTextFrame(active.frame, runs, style),
          };
        }
        if (active.kind === "text-list") {
          const runs = wordWrappedTextRuns(rawTextListRunsForEditor(next));
          const style = rawTextStyle(next);
          return {
            ...active,
            draft: textRunsContent(runs),
            runs,
            style,
            frame: autoSizeInlineTextFrame(active.frame, runs, style),
          };
        }
        return { ...active, style: rawTextStyle(next) };
      });
    },
    [editorAnalyticsProps, selection, updateElement, updateInlineEdit],
  );

  const applyLayoutElementChange = useCallback(
    (changes: Record<string, unknown>) => {
      if (!layoutToolbarTarget) return;
      trackEvent(MixpanelEvent.Editor_Element_Style_Changed, {
        ...editorAnalyticsProps({
          element_type:
            readString(layoutToolbarTarget.element.type) || "layout",
          change_source: "layout_toolbar",
        }),
      });
      if (
        layoutToolbarTarget.selection.componentIndex ===
        ROOT_ELEMENTS_COMPONENT_INDEX
      ) {
        const updatedRoot = updateComponentLayoutElement(
          rootElementsComponent(currentUiRef.current),
          layoutToolbarTarget.selection.elementPath,
          changes,
          layoutToolbarTarget.box,
          {
            childrenBounds,
            elementBox,
            elementSize,
            isManualPositioned,
            normalizeLayoutChildren: elementWithNormalizedLayoutChildren,
          },
        );
        commitUi({
          ...currentUiRef.current,
          elements: readArray(updatedRoot.elements),
        });
        return;
      }
      updateComponent(layoutToolbarTarget.selection.componentIndex, (component) =>
        updateComponentLayoutElement(
          component,
          layoutToolbarTarget.selection.elementPath,
          changes,
          layoutToolbarTarget.box,
          {
            childrenBounds,
            elementBox,
            elementSize,
            isManualPositioned,
            normalizeLayoutChildren: elementWithNormalizedLayoutChildren,
          },
        ),
      );
    },
    [commitUi, editorAnalyticsProps, layoutToolbarTarget, updateComponent],
  );

  const applyChartToolbarElementChange = useCallback(
    (editorElement: ChartSlideElement) => {
      if (!chartToolbarTarget) return;
      const current = getElementAtSelection(
        currentUiRef.current,
        chartToolbarTarget.selection,
      );
      const box = absoluteBoxForSelection(
        currentUiRef.current,
        chartToolbarTarget.selection,
      );
      if (!current || !box) return;
      const next = mergeEditorToolbarElement(current, editorElement, box);
      updateElement(chartToolbarTarget.selection, () => next);
      trackEvent(MixpanelEvent.Editor_Element_Style_Changed, {
        ...editorAnalyticsProps({
          element_type: "chart",
          change_source: "chart_toolbar",
        }),
      });
    },
    [chartToolbarTarget, editorAnalyticsProps, updateElement],
  );

  const applyTableToolbarElementChange = useCallback(
    (editorElement: TableSlideElement) => {
      if (!tableToolbarTarget) return;
      const current = getElementAtSelection(
        currentUiRef.current,
        tableToolbarTarget.selection,
      );
      const box = absoluteBoxForSelection(
        currentUiRef.current,
        tableToolbarTarget.selection,
      );
      if (!current || !box) return;
      const next = mergeEditorToolbarElement(current, editorElement, box);
      updateElement(tableToolbarTarget.selection, () => next);
      trackEvent(MixpanelEvent.Editor_Element_Style_Changed, {
        ...editorAnalyticsProps({
          element_type: "table",
          change_source: "table_toolbar",
        }),
      });
    },
    [editorAnalyticsProps, tableToolbarTarget, updateElement],
  );

  const applyEditorToolbarTargetElementChange = useCallback(
    (editorElement: SlideElement) => {
      if (!editorToolbarTarget) return;
      const current = getElementAtSelection(
        currentUiRef.current,
        editorToolbarTarget.selection,
      );
      const box = absoluteBoxForSelection(
        currentUiRef.current,
        editorToolbarTarget.selection,
      );
      if (!current || !box) return;
      const next = mergeEditorToolbarElement(current, editorElement, box);
      updateElement(editorToolbarTarget.selection, () => next);
      trackEvent(MixpanelEvent.Editor_Element_Style_Changed, {
        ...editorAnalyticsProps({
          element_type: readString(current.type) || editorElement.type,
          change_source: "component_element_toolbar",
        }),
      });
    },
    [editorAnalyticsProps, editorToolbarTarget, updateElement],
  );

  const groupSelectedComponents = useCallback(() => {
    const currentSelection = selectionRef.current;
    if (currentSelection?.kind !== "multi-component") return false;
    const result = groupTemplateV2ComponentsInUi(
      currentUiRef.current,
      currentSelection.componentIndexes,
      { componentBox },
    );
    if (!result) return false;

    commitUi(result.ui as RawUi);
    selectionRef.current = result.selection;
    setSelection(result.selection);
    activateSurface(result.selection);
    clearInlineEdit();
    clearTableCellSelection();
    setVectorEditSelection(null);
    setIconEditorSelection(null);
    setChartEditorSelection(null);
    return true;
  }, [
    activateSurface,
    clearInlineEdit,
    clearTableCellSelection,
    commitUi,
  ]);

  useEffect(() => {
    if (!isRenderActive || !isEditMode || typeof document === "undefined") {
      return;
    }

    const handleGroupShortcut = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        !isSurfaceActive() ||
        isEditableTarget(event.target) ||
        !isTemplateV2GroupShortcut(event)
      ) {
        return;
      }
      if (selectionRef.current?.kind !== "multi-component") return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      groupSelectedComponents();
    };

    document.addEventListener("keydown", handleGroupShortcut, true);
    return () =>
      document.removeEventListener("keydown", handleGroupShortcut, true);
  }, [
    groupSelectedComponents,
    isEditMode,
    isRenderActive,
    isSurfaceActive,
  ]);

  const ungroupComponentAtIndex = useCallback((componentIndex: number) => {
    if (componentIndex < 0) return;
    const component = asRecord(
      readArray(currentUiRef.current.components)[componentIndex],
    );
    if (!canUngroupTemplateV2Component(component)) return;
    const result = ungroupTemplateV2ComponentInUi(
      currentUiRef.current,
      componentIndex,
      {
        childArrayInfo,
        componentBox,
        elementBox,
        layoutChildren,
      },
    );
    if (!result) return;
    commitUi(result.ui as RawUi);
    trackEvent(MixpanelEvent.Editor_Component_Ungrouped, {
      ...editorAnalyticsProps(),
    });
    selectionRef.current = result.selection;
    setSelection(result.selection);
    activateSurface(result.selection);
    clearInlineEdit();
    clearTableCellSelection();
    setVectorEditSelection(null);
    setIconEditorSelection(null);
  }, [
    activateSurface,
    clearInlineEdit,
    clearTableCellSelection,
    commitUi,
    editorAnalyticsProps,
  ]);

  const ungroupSelectedComponent = useCallback(() => {
    if (selection?.kind !== "component") return;
    ungroupComponentAtIndex(selection.componentIndex);
  }, [selection, ungroupComponentAtIndex]);

  const ungroupLayoutTargetComponent = useCallback(() => {
    const componentIndex = layoutToolbarTarget?.selection.componentIndex;
    if (componentIndex == null || componentIndex < 0) return;
    ungroupComponentAtIndex(componentIndex);
  }, [layoutToolbarTarget, ungroupComponentAtIndex]);

  const reorderComponentLayerAtIndex = useCallback(
    (componentIndex: number, action: ComponentLayerAction) => {
      const result = reorderComponentLayer(
        readArray(currentUiRef.current.components),
        componentIndex,
        action,
      );
      if (!result) return;
      const nextSelection: ComponentSelection = {
        kind: "component",
        componentIndex: result.componentIndex,
      };
      commitUi({
        ...currentUiRef.current,
        components: result.components,
      });
      trackEvent(MixpanelEvent.Editor_Component_Layer_Changed, {
        ...editorAnalyticsProps({
          action,
        }),
      });
      setSelection(nextSelection);
      clearTableCellSelection();
      clearInlineEdit();
      setVectorEditSelection(null);
      setIconEditorSelection(null);
      activateSurface(nextSelection);
    },
    [
      activateSurface,
      clearInlineEdit,
      clearTableCellSelection,
      commitUi,
      editorAnalyticsProps,
    ],
  );

  const reorderSelectedComponentLayer = useCallback(
    (action: ComponentLayerAction) => {
      if (selection?.kind !== "component") return;
      reorderComponentLayerAtIndex(selection.componentIndex, action);
    },
    [reorderComponentLayerAtIndex, selection],
  );

  useEffect(() => {
    if (!isRenderActive || !isEditMode || typeof document === "undefined") {
      return;
    }

    const handleLayerShortcut = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        !isSurfaceActive() ||
        isEditableTarget(event.target)
      ) {
        return;
      }

      const action = componentLayerActionForShortcut(event);
      if (!action) return;

      const componentIndex = componentIndexForLayerShortcut(selectionRef.current);
      if (componentIndex == null) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      reorderComponentLayerAtIndex(componentIndex, action);
    };

    document.addEventListener("keydown", handleLayerShortcut, true);
    return () =>
      document.removeEventListener("keydown", handleLayerShortcut, true);
  }, [
    isEditMode,
    isRenderActive,
    isSurfaceActive,
    reorderComponentLayerAtIndex,
  ]);

  const targetComponentActions =
    useMemo<TemplateV2SelectionComponentActions | null>(() => {
      const componentIndex =
        tableToolbarTarget?.selection.componentIndex ??
        chartToolbarTarget?.selection.componentIndex;
      if (componentIndex == null || componentIndex < 0) return null;
      const component = asRecord(readArray(uiDraft.components)[componentIndex]);
      return {
        canUngroup: canUngroupTemplateV2Component(component),
        componentCount: components.length,
        componentIndex,
        onDelete: () => deleteComponentAtIndex(componentIndex),
        onDuplicate: () => duplicateComponentAtIndex(componentIndex),
        onLayerAction: (action: ComponentLayerAction) =>
          reorderComponentLayerAtIndex(componentIndex, action),
        onUngroup: () => ungroupComponentAtIndex(componentIndex),
      };
    }, [
      chartToolbarTarget,
      components.length,
      deleteComponentAtIndex,
      duplicateComponentAtIndex,
      reorderComponentLayerAtIndex,
      tableToolbarTarget,
      uiDraft.components,
      ungroupComponentAtIndex,
    ]);

  const openImageUpload = useCallback(
    (elementSelection: ElementSelection) => {
      const element = getElementAtSelection(currentUiRef.current, elementSelection);
      if (readString(element?.type) !== "image") return;
      activateSurface(elementSelection);
      pendingImageUploadRef.current = elementSelection;
      if (imageUploadInputRef.current) {
        imageUploadInputRef.current.value = "";
        imageUploadInputRef.current.click();
      }
    },
    [activateSurface],
  );

  const openIconEditor = useCallback(
    (elementSelection: ElementSelection) => {
      const element = getElementAtSelection(
        currentUiRef.current,
        elementSelection,
      );
      if (!element || !isRawIconElement(element)) {
        return;
      }
      activateSurface(elementSelection);
      setSelection(elementSelection);
      clearInlineEdit();
      setVectorEditSelection(null);
      setIconEditorSelection(elementSelection);
    },
    [activateSurface, clearInlineEdit],
  );

  const handleIconChange = useCallback(
    (newIconUrl: string, query?: string) => {
      if (!iconEditorSelection || !newIconUrl) return;
      updateElement(iconEditorSelection, (element) => ({
        ...element,
        data: newIconUrl,
        ...(query ? { icon_query: query } : {}),
      }));
      trackEvent(MixpanelEvent.Editor_Icon_Replaced, {
        ...editorAnalyticsProps({
          query_present: Boolean(query),
        }),
      });
    },
    [editorAnalyticsProps, iconEditorSelection, updateElement],
  );

  const openChartEditor = useCallback(
    (elementSelection: ElementSelection) => {
      const element = getElementAtSelection(currentUiRef.current, elementSelection);
      if (!element || readString(element.type) !== "chart") return;
      activateSurface(elementSelection);
      setSelection(elementSelection);
      clearInlineEdit();
      setVectorEditSelection(null);
      setIconEditorSelection(null);
      setChartEditorSelection(elementSelection);
    },
    [activateSurface, clearInlineEdit],
  );

  const handleImageUploadChange = useCallback(
    async (event: ReactChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      const target = pendingImageUploadRef.current;
      if (!file || !target) return;

      if (!file.type.startsWith("image/")) {
        trackEvent(MixpanelEvent.Editor_Image_Replace_Failed, {
          ...editorAnalyticsProps({
            error_message: "Invalid image file type",
          }),
        });
        notify.warning("Invalid file", "Please upload an image file.");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        trackEvent(MixpanelEvent.Editor_Image_Replace_Failed, {
          ...editorAnalyticsProps({
            file_size_bucket: bucketFileSize(file.size),
            error_message: "Image file too large",
          }),
        });
        notify.warning("File too large", "Image files must be smaller than 5MB.");
        return;
      }

      try {
        setIsUploadingImage(true);
        const uploaded = await ImagesApi.uploadImage(file);
        const imageUrl = resolveBackendAssetSource(uploaded);
        if (!imageUrl) throw new Error("Upload did not return an image URL.");
        updateElement(target, (element) => ({
          ...element,
          data: imageUrl,
          name: file.name,
          focus_x: 50,
          focus_y: 50,
          crop_scale: null,
        }));
        trackEvent(MixpanelEvent.Editor_Image_Replaced, {
          ...editorAnalyticsProps({
            file_size_bucket: bucketFileSize(file.size),
          }),
        });
        notify.success("Image updated", "The selected image was replaced.");
      } catch (error) {
        trackEvent(MixpanelEvent.Editor_Image_Replace_Failed, {
          ...editorAnalyticsProps({
            error_message: sanitizeAnalyticsError(
              error,
              "Failed to upload image"
            ),
          }),
        });
        notify.error(
          "Upload failed",
          error instanceof Error
            ? error.message
            : "Failed to upload image. Please try again.",
        );
      } finally {
        pendingImageUploadRef.current = null;
        setIsUploadingImage(false);
      }
    },
    [editorAnalyticsProps, updateElement],
  );

  const handleElementDoubleClick = useCallback(
    (elementSelection: ElementSelection) => {
      const element = getElementAtSelection(currentUiRef.current, elementSelection);
      const type = readString(element?.type);
      if (type === "image") {
        return;
      }
      if (type === "chart") {
        openChartEditor(elementSelection);
        return;
      }
      if (isVectorType(type)) {
        activateSurface(elementSelection);
        setSelection(elementSelection);
        clearTableCellSelection();
        clearTableCellEditing();
        clearInlineEdit();
        setIconEditorSelection(null);
        setChartEditorSelection(null);
        setVectorEditSelection(
          canEditVectorPointsForSelection(currentUiRef.current, elementSelection)
            ? elementSelection
            : null,
        );
        return;
      }
      openInlineEditor(elementSelection);
    },
    [
      activateSurface,
      clearInlineEdit,
      clearTableCellEditing,
      clearTableCellSelection,
      openChartEditor,
      openInlineEditor,
    ],
  );

  useEffect(() => {
    if (!isRenderActive || !isEditMode || typeof window === "undefined") {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        (event.key !== "Delete" && event.key !== "Backspace") ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isEditableTarget(event.target)
      ) {
        return;
      }
      if (!selection) return;
      event.preventDefault();
      deleteSelection();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deleteSelection, isEditMode, isRenderActive, selection]);

  useEffect(() => {
    if (!isEditMode || typeof window === "undefined") return;

    const handleInsertElements = (event: Event) => {
      const detail = (event as CustomEvent<TemplateV2InsertElementsDetail>).detail;
      const elements = detail?.elements ?? [];
      const insertedComponents = detail?.components ?? [];
      if (elements.length === 0 && insertedComponents.length === 0) return;
      if (!eventTargetsThisSlide(detail, slideId, surfaceSlideIndex, isSurfaceActive)) {
        return;
      }

      const nextIndex = readArray(currentUiRef.current.components).length;
      const nextUi = appendInsertedContent(
        currentUiRef.current,
        elements as unknown as UnknownRecord[],
        insertedComponents as unknown as UnknownRecord[],
        detail.label,
        detail.preserveComponentData,
      );
      const insertedCount = elements.length + insertedComponents.length;
      const nextSelection =
        insertedCount > 1
          ? selectionForComponentIndexes(
              Array.from(
                { length: insertedCount },
                (_, offset) => nextIndex + offset,
              ),
            )
          : selectionForInsertedComponent(nextUi, nextIndex);
      commitUi(nextUi);
      setSelection(nextSelection);
      setVectorEditSelection(
        nextSelection?.kind === "element" ? nextSelection : null,
      );
      detail.handled = true;
    };

    window.addEventListener(TEMPLATE_V2_INSERT_ELEMENTS_EVENT, handleInsertElements);
    return () =>
      window.removeEventListener(
        TEMPLATE_V2_INSERT_ELEMENTS_EVENT,
        handleInsertElements,
      );
  }, [commitUi, isEditMode, isSurfaceActive, slideId, surfaceSlideIndex]);

  useEffect(() => {
    if (!isRenderActive || !isEditMode || typeof document === "undefined") {
      return;
    }
    const handlePointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      const targetNode = event.target instanceof Node ? event.target : null;
      const target = event.target instanceof Element ? event.target : null;
      if (
        target?.closest(
          "[data-template-v2-floating-toolbar='true'], [data-inline-edit-ignore='true']",
        )
      ) {
        if (isSurfaceActive()) {
          activateSurface();
        }
        return;
      }
      if (targetNode && root?.contains(targetNode)) {
        activateSurface();
        return;
      }

      clearEditorUiState({ clearActiveSurface: true });
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      clearSurface();
    };
  }, [
    activateSurface,
    clearEditorUiState,
    clearSurface,
    isEditMode,
    isRenderActive,
    isSurfaceActive,
  ]);

  useEffect(() => {
    if (!isRenderActive || !isEditMode || typeof document === "undefined") {
      return;
    }

    const handleUndoRedoShortcut = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        !isSurfaceActive() ||
        isEditableTarget(event.target) ||
        !(event.metaKey || event.ctrlKey) ||
        event.altKey
      ) {
        return;
      }

      const key = event.key.toLowerCase();
      const wantsUndo = key === "z" && !event.shiftKey;
      const wantsRedo = key === "y" || (key === "z" && event.shiftKey);
      if (!wantsUndo && !wantsRedo) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      if (wantsUndo) {
        undo();
        return;
      }
      redo();
    };

    document.addEventListener("keydown", handleUndoRedoShortcut, true);
    return () =>
      document.removeEventListener("keydown", handleUndoRedoShortcut, true);
  }, [isEditMode, isRenderActive, isSurfaceActive, redo, undo]);

  if (!uiDraft) {
    return (
      <div className="flex h-full aspect-video flex-col items-center justify-center rounded-lg bg-gray-100">
        <Loader2 className="mb-2 h-4 w-4 animate-spin" />
        <p className="text-center text-sm text-gray-600">Loading slide layout...</p>
      </div>
    );
  }

  return (
    <div
      ref={setRootNode}
      data-template-v2-konva-surface={surfaceId}
      className="relative h-full w-full overflow-hidden bg-white"
      style={{ width: STAGE_WIDTH, height: STAGE_HEIGHT }}
      onPointerDown={() => activateSurface()}
    >
      {isEditMode ? (
        <input
          ref={imageUploadInputRef}
          accept="image/*"
          className="hidden"
          type="file"
          onChange={handleImageUploadChange}
        />
      ) : null}
      {isRenderActive ? (
        <Stage
        width={STAGE_WIDTH}
        height={STAGE_HEIGHT}
        onMouseDown={(event) => {
          if (event.target === event.target.getStage()) {
            activateSurface(null);
            clearEditorUiState();
            return;
          }
          activateSurface();
        }}
        onTouchStart={(event) => {
          if (event.target === event.target.getStage()) {
            activateSurface(null);
            clearEditorUiState();
            return;
          }
          activateSurface();
        }}
      >
        <Layer ref={backgroundLayerRef} listening={false}>
          <Rect width={STAGE_WIDTH} height={STAGE_HEIGHT} fill={backgroundColor(uiDraft)} />
        </Layer>
        <Layer ref={contentLayerRef} listening={isEditMode}>
          {rootElements.map((element, elementIndex) => (
            <MemoizedRawElementNode
              key={`root:${rawElementKey(element, elementIndex)}`}
              element={element}
              componentIndex={ROOT_ELEMENTS_COMPONENT_INDEX}
              elementPath={[elementIndex]}
              isEditMode={isEditMode}
              editingKey={editingKey}
              vectorEditingKey={vectorEditingKey}
              selectedTableCell={visibleSelectedTableCell}
              selectedKey={selectedKey}
              setNodeRef={setSelectionNodeRef}
              onSelect={select}
              onTableCellSelect={selectTableCell}
              onTableCellEdit={editTableCell}
              onOpenEditor={handleElementDoubleClick}
              onElementChange={updateElement}
              onElementDragStart={handleElementAlignmentDragStart}
              onElementDragMove={handleElementAlignmentDragMove}
              onElementDragComplete={handleElementAlignmentDragComplete}
              parentBox={STAGE_BOX}
              layoutManaged={false}
              fontRevision={fontLoadState.revision}
            />
          ))}
          {components.map((component, componentIndex) => (
            <MemoizedRawComponentNode
              key={componentKey(component, componentIndex)}
              component={component}
              componentIndex={componentIndex}
              isEditMode={isEditMode}
              isMultiSelectedComponent={
                selectedComponentIndexes.length > 1 &&
                selectedComponentIndexSet.has(componentIndex)
              }
              editingKey={editingKey}
              vectorEditingKey={vectorEditingKey}
              selectedTableCell={visibleSelectedTableCell}
              selectedKey={selectedKey}
              setNodeRef={setSelectionNodeRef}
              onSelect={select}
              onTableCellSelect={selectTableCell}
              onTableCellEdit={editTableCell}
              onOpenElementEditor={handleElementDoubleClick}
              onComponentChange={updateComponent}
              onComponentDragStart={handleComponentDragStart}
              onComponentDragMove={handleComponentDragMove}
              onComponentDragEnd={handleComponentDragEnd}
              onElementChange={updateElement}
              onElementDragStart={handleElementAlignmentDragStart}
              onElementDragMove={handleElementAlignmentDragMove}
              onElementDragComplete={handleElementAlignmentDragComplete}
              fontRevision={fontLoadState.revision}
            />
          ))}
          {isEditMode ? (
            <TemplateV2SelectionTransformers
              nodeRefs={nodeRefs}
              parentComponentKey={transformerParentComponentKey}
              selectedKey={selectedKey}
              selectedKeys={selectedKeys}
              selectionKind={selection?.kind ?? null}
              horizontalResizeOnly={horizontalResizeOnly}
              fullElementTransform={
                selectedIsImageElement ||
                (selectedIsVectorElement && selectedCanEditVectorPoints)
              }
              suppressSelectedOutline={Boolean(
                selectedTableCell ||
                  inlineEdit ||
                  imageCropActive ||
                  readString(selectedElement?.type) === "chart" ||
                  selectedIsVectorPointEditing,
              )}
            />
          ) : null}
        </Layer>
        {isEditMode ? (
          <Layer ref={alignmentGuideLayerRef} listening={false}>
            <Line
              ref={verticalAlignmentGuideRef}
              points={[0, 0, 0, 0]}
              visible={false}
              stroke={ALIGNMENT_GUIDE_COLOR}
              strokeWidth={1.5 / effectiveDisplayScale}
              dash={[
                0.1 / effectiveDisplayScale,
                5 / effectiveDisplayScale,
              ]}
              lineCap="round"
              listening={false}
              perfectDrawEnabled={false}
              shadowForStrokeEnabled={false}
            />
            <Line
              ref={horizontalAlignmentGuideRef}
              points={[0, 0, 0, 0]}
              visible={false}
              stroke={ALIGNMENT_GUIDE_COLOR}
              strokeWidth={1.5 / effectiveDisplayScale}
              dash={[
                0.1 / effectiveDisplayScale,
                5 / effectiveDisplayScale,
              ]}
              lineCap="round"
              listening={false}
              perfectDrawEnabled={false}
              shadowForStrokeEnabled={false}
            />
          </Layer>
        ) : null}
        </Stage>
      ) : null}
      <TemplateV2SelectionToolbar
        anchorBox={floatingToolbarAnchorBox}
        canUngroupComponent={canUngroupSelectedComponent}
        canUngroupLayoutTarget={canUngroupLayoutTargetComponent}
        chartTarget={chartToolbarTarget}
        componentCount={components.length}
        editorTarget={editorToolbarTarget}
        isEditMode={isEditMode}
        layoutTarget={layoutToolbarTarget}
        position={selectionToolbarPosition}
        selectedTableCell={toolbarSelectedTableCell}
        selection={selection}
        selectionKey={keyForSelection(selection)}
        tableTarget={tableToolbarTarget}
        targetComponentActions={targetComponentActions}
        templateFonts={templateFonts}
        toolbarBounds={selectionToolbarBounds}
        onChartChange={applyChartToolbarElementChange}
        onChartEdit={() => {
          if (chartToolbarTarget) {
            openChartEditor(chartToolbarTarget.selection);
          }
        }}
        onDeleteSelection={deleteSelection}
        onDuplicateSelection={duplicateSelection}
        onEditorChange={applyEditorToolbarTargetElementChange}
        onImageCropModeChange={setImageCropActive}
        onIconEdit={() => {
          if (editorToolbarTarget) {
            openIconEditor(editorToolbarTarget.selection);
          }
        }}
        onLayoutChange={applyLayoutElementChange}
        onLayerAction={reorderSelectedComponentLayer}
        onGroupSelection={groupSelectedComponents}
        onTableChange={applyTableToolbarElementChange}
        onUngroupComponent={ungroupSelectedComponent}
        onUngroupLayoutTarget={ungroupLayoutTargetComponent}
      />
      {isEditMode &&
        selection?.kind === "element" &&
        selectedElement &&
        selectedBox &&
        toolbarElement &&
        !layoutToolbarTarget &&
        !chartToolbarTarget &&
        !tableToolbarTarget &&
        !isTemplateV2LayoutElement(selectedElement) &&
        !isTemplateV2GroupElement(selectedElement) &&
        !(editingTableCell && readString(selectedElement.type) === "table") ? (
        <ElementToolbar
          element={toolbarElement}
          index={selection.componentIndex}
          anchorBox={selectedBox}
          path={keyForSelection(selection)}
          scale={1}
          selectedTableCell={selectedTableCell}
          templateFonts={templateFonts}
          textSelectionRange={
            inlineEdit &&
              (inlineEdit.kind === "text" || inlineEdit.kind === "text-list") &&
              keyForSelection(inlineEdit.selection) === keyForSelection(selection)
              ? inlineEdit.textSelectionRange
              : null
          }
          onChange={(_index, element) => applyToolbarElementChange(element)}
          onImageCropModeChange={setImageCropActive}
          onEditIcon={() => openIconEditor(selection)}
          onEditImage={() => openImageUpload(selection)}
          onEditText={() => openInlineEditor(selection)}
        />
      ) : null}
      {isEditMode &&
        selection?.kind === "element" &&
        editingTableCell &&
        toolbarElement &&
        readString((toolbarElement as UnknownRecord).type) === "table" ? (
        <TableInlineEditor
          key={`${keyForSelection(selection)}:${editingTableCell.rowIndex}:${editingTableCell.colIndex}`}
          element={toolbarElement as TableSlideElement}
          index={selection.componentIndex}
          scale={1}
          selectedCell={editingTableCell}
          templateFonts={templateFonts}
          onChange={(_index, element) => applyToolbarElementChange(element)}
          onClose={clearTableCellEditing}
        />
      ) : null}
      {isEditMode && inlineEdit && inlineEditBox ? (
        <TemplateV2InlineEditor
          key={keyForSelection(inlineEdit.selection)}
          draft={inlineEdit.draft}
          kind={inlineEdit.kind}
          listMarker={inlineEdit.listMarker}
          box={inlineEditBox}
          runs={inlineEdit.runs}
          style={inlineEdit.style}
          onChange={updateInlineDraft}
          onSelectionChange={(textSelectionRange) =>
            updateInlineTextSelectionRange(
              inlineEdit.selection,
              textSelectionRange,
            )
          }
          onRunsChange={(runs) =>
            commitInlineTextRuns(inlineEdit.selection, runs)
          }
          onClose={(commit, runs) => closeInlineEditor(commit, runs)}
        />
      ) : null}
      {isEditMode &&
        chartEditorSelection &&
        chartEditorElement &&
        readString(chartEditorElement.type) === "chart" ? (
        <ChartDataEditorPopover
          key={keyForSelection(chartEditorSelection)}
          chart={rawChartToEditorChart(chartEditorElement)}
          chartPath={keyForSelection(chartEditorSelection)}
          onChange={(chart) =>
            updateElement(chartEditorSelection, (element) =>
              editorChartToRawChart(
                element,
                chart as unknown as UnknownRecord,
              ),
            )
          }
          onClose={closeChartEditor}
        />
      ) : null}
      {isEditMode &&
        iconEditorSelection &&
        iconEditorElement &&
        isRawIconElement(iconEditorElement) ? (
        <IconsEditor
          key={keyForSelection(iconEditorSelection)}
          icon_prompt={[rawIconQuery(iconEditorElement)]}
          currentIconUrl={readString(iconEditorElement.data) ?? ""}
          onClose={() => setIconEditorSelection(null)}
          onIconChange={handleIconChange}
        />
      ) : null}
      {isUploadingImage ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-white/35">
          <div className="flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-medium text-[#191919] shadow-md">
            <Loader2 className="h-4 w-4 animate-spin" />
            Uploading image...
          </div>
        </div>
      ) : null}
    </div>
  );
}

export const TemplateV2KonvaSlide = memo(TemplateV2KonvaSlideComponent);
TemplateV2KonvaSlide.displayName = "TemplateV2KonvaSlide";
