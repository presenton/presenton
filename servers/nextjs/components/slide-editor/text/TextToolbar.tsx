import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Ban,
  Bold,
  Check,
  ChevronDown,
  Italic,
  List,
  ListOrdered,
  Repeat2,
  Search,
  Settings,
  Underline,
  XCircle,
} from "lucide-react";
import type { TextSlideElement } from "@/components/slide-editor/state/state";
import { withHash } from "@/components/slide-editor/utils/color";
import type { Font, Marker } from "@/components/slide-editor/types";
import {
  elementFont,
  mergeFont,
  mergeFontForTextSelection,
} from "@/components/slide-editor/model/element-model";
import {
  ensureGoogleFontLoaded,
  ensureTemplateFontLoaded,
  GOOGLE_FONT_OPTIONS,
  loadGoogleFontOptions,
  type GoogleFontOption,
  type TemplateFontOption,
} from "@/components/slide-editor/text/google-fonts";
import {
  fontForTextSelection,
  normalizedTextSelectionRange,
  textRunsContent,
  type TextSelectionRange,
} from "@/components/slide-editor/text/text-runs";
import { DeferredColorInput } from "@/components/slide-editor/toolbar/DeferredColorInput";
import {
  FloatingToolbarBoundsProvider,
  FloatingToolbarPanel,
} from "@/components/slide-editor/toolbar/FloatingToolbar";
import {
  ComponentActionsMenu,
  ComponentUngroupButton,
  type ComponentActionsMenuActions,
} from "@/components/slide-editor/selection/ComponentActionsMenu";
import {
  numericInputMode,
  preventInvalidNumberInput,
  sanitizeNumericInput,
} from "@/components/slide-editor/toolbar/numericInput";

const EMPTY_TEMPLATE_FONTS: TemplateFontOption[] = [];

const HORIZONTAL_ALIGNMENT_ICONS = {
  left: AlignLeft,
  center: AlignCenter,
  right: AlignRight,
};

const MIN_FONT_SIZE = 4;
const MAX_FONT_SIZE = 240;
const MIN_LETTER_SPACING = -200;
const MAX_LETTER_SPACING = 600;
const MIN_LINE_HEIGHT = 0.8;
const MAX_LINE_HEIGHT = 2.2;
const DEFAULT_LINE_HEIGHT = 1.15;
const TEXT_TOOLBAR_FALLBACK_WIDTH = 560;
const TEXT_TOOLBAR_FALLBACK_HEIGHT = 44;
const TEXT_TOOLBAR_EDGE_PADDING = 8;
const TEXT_TOOLBAR_GAP = 8;
const FONT_MENU_OPTION_HEIGHT = 30;
const FONT_MENU_MAX_VISIBLE_ROWS = 8;
const FONT_MENU_OVERSCAN_ROWS = 4;

type TextToolbarPanel = "marker" | "settings";
type FontPickerSource = "template" | "google";
type ToolbarSurfaceRect = {
  height: number;
  left: number;
  top: number;
  width: number;
  scaleX: number;
  scaleY: number;
};

function clampFontSize(size: number) {
  return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, size));
}

function clampMetric(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatToolbarFontSize(size: number) {
  if (!Number.isFinite(size)) return "12";
  return Number.isInteger(size) ? String(size) : size.toFixed(1);
}

function formatLineHeight(value: number) {
  return value.toFixed(2).replace(/\.?0+$/, "");
}

function formatSettingsLetterSpacing(value: number) {
  const pixels = value / 100;
  return pixels.toFixed(1).replace(/\.0$/, "");
}

function formatOpacity(value: number) {
  return value.toFixed(1).replace(/\.0$/, "");
}

export function TextToolbar({
  element,
  index,
  anchorBox,
  scale,
  componentActions,
  disableAlignment = false,
  listMarker,
  selectionRange,
  templateFonts = EMPTY_TEMPLATE_FONTS,
  onChange,
  onListMarkerChange,
}: {
  element: TextSlideElement;
  index: number;
  anchorBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  scale: number;
  componentActions?: ComponentActionsMenuActions | null;
  disableAlignment?: boolean;
  listMarker?: Marker | null;
  selectionRange?: TextSelectionRange | null;
  templateFonts?: TemplateFontOption[];
  onChange: (index: number, element: TextSlideElement) => void;
  onListMarkerChange?: (marker: Marker) => void;
}) {
  const activeSelectionRange = normalizedTextSelectionRange(
    selectionRange,
    textRunsContent(element.runs).length,
  );
  const selectedFont = fontForTextSelection(element, activeSelectionRange);
  const font = elementFont({ font: selectedFont ?? element.font });
  const horizontalAlignment = element.alignment?.horizontal ?? "left";
  const letterSpacing = font.letterSpacing ?? 0;
  const lineHeight = font.lineHeight ?? DEFAULT_LINE_HEIGHT;
  const opacity = font.opacity ?? 1;
  const HorizontalAlignmentIcon =
    HORIZONTAL_ALIGNMENT_ICONS[horizontalAlignment];
  const ListMarkerIcon =
    listMarker === "number" ? ListOrdered : listMarker === "none" ? Ban : List;
  const hasListMarkerControls =
    listMarker != null && onListMarkerChange != null;
  const formattedFontSize = formatToolbarFontSize(font.size);
  const [openPanel, setOpenPanel] = useState<TextToolbarPanel | null>(null);
  const [hoveredControl, setHoveredControl] = useState<string | null>(null);
  const [fontSizeDraft, setFontSizeDraft] = useState(formattedFontSize);
  const [fontSizeEditing, setFontSizeEditing] = useState(false);
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [toolbarWidth, setToolbarWidth] = useState(
    TEXT_TOOLBAR_FALLBACK_WIDTH,
  );
  const [toolbarHeight, setToolbarHeight] = useState(
    TEXT_TOOLBAR_FALLBACK_HEIGHT,
  );
  const [surfaceRect, setSurfaceRect] = useState<ToolbarSurfaceRect>({
    height: 0,
    left: 0,
    top: 0,
    width: 0,
    scaleX: 1,
    scaleY: 1,
  });
  const updateFont = (fontPatch: Partial<Font>) => {
    onChange(
      index,
      activeSelectionRange
        ? mergeFontForTextSelection(element, activeSelectionRange, fontPatch)
        : mergeFont(element, fontPatch),
    );
  };
  const loadFontFamily = useCallback(
    (family: string) => {
      const templateFont = templateFonts.find(
        (fontOption) => fontOption.family === family,
      );
      if (templateFont) {
        void ensureTemplateFontLoaded(templateFont);
        return;
      }
      void ensureGoogleFontLoaded(family);
    },
    [templateFonts],
  );
  const updateFontFamily = (family: string) => {
    loadFontFamily(family);
    updateFont({ family });
  };
  const commitFontSize = (nextSize: number) => {
    if (!Number.isFinite(nextSize)) return;
    updateFont({ size: clampFontSize(nextSize) });
  };
  const updateFontSize = (value: string) => {
    setFontSizeDraft(value);
    if (!value.trim()) return;
    commitFontSize(Number.parseFloat(value));
  };
  const commitFontSizeDraft = () => {
    const value = fontSizeDraft.trim();
    const nextSize = Number.parseFloat(value);
    if (!value || !Number.isFinite(nextSize)) {
      setFontSizeDraft(formattedFontSize);
      return;
    }

    const clampedSize = clampFontSize(nextSize);
    commitFontSize(clampedSize);
    setFontSizeDraft(formatToolbarFontSize(clampedSize));
  };
  const stepFontSize = (delta: number) => {
    const draftSize = Number.parseFloat(fontSizeDraft);
    const currentSize = Number.isFinite(draftSize)
      ? draftSize
      : Number.isFinite(font.size)
        ? font.size
        : 12;
    const nextSize = clampFontSize(currentSize + delta);
    commitFontSize(nextSize);
    setFontSizeDraft(formatToolbarFontSize(nextSize));
  };
  const fontSizeInputOptions = {
    allowDecimal: true,
    min: MIN_FONT_SIZE,
  };

  const updateAlignment = (
    alignment: NonNullable<TextSlideElement["alignment"]>,
  ) => {
    onChange(index, {
      ...element,
      alignment: {
        ...(element.alignment ?? {}),
        ...alignment,
      },
    });
  };

  const updateOpacity = (nextOpacity: number) => {
    if (!Number.isFinite(nextOpacity)) return;
    updateFont({ opacity: clampMetric(nextOpacity, 0, 1) });
  };
  const updateLetterSpacing = (nextLetterSpacing: number) => {
    if (!Number.isFinite(nextLetterSpacing)) return;
    updateFont({
      letter_spacing: clampMetric(
        nextLetterSpacing,
        MIN_LETTER_SPACING,
        MAX_LETTER_SPACING,
      ),
    });
  };
  const updateLineHeight = (nextLineHeight: number) => {
    if (!Number.isFinite(nextLineHeight)) return;
    updateFont({
      line_height: clampMetric(
        nextLineHeight,
        MIN_LINE_HEIGHT,
        MAX_LINE_HEIGHT,
      ),
    });
  };

  useEffect(() => {
    if (!fontSizeEditing) {
      setFontSizeDraft(formattedFontSize);
    }
  }, [fontSizeEditing, formattedFontSize]);

  useEffect(() => {
    loadFontFamily(font.family);
  }, [font.family, loadFontFamily]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || typeof window === "undefined") return;
    const anchor = anchorRef.current;
    if (!anchor) return;
    const surface = anchor.closest<HTMLElement>(
      "[data-template-v2-konva-surface]",
    );
    const updateMeasurements = () => {
      const toolbar = toolbarRef.current;
      if (toolbar) {
        const toolbarRect = toolbar.getBoundingClientRect();
        const nextWidth = toolbarRect.width;
        const nextHeight = toolbarRect.height;
        if (Number.isFinite(nextWidth) && nextWidth > 0) {
          setToolbarWidth(nextWidth);
        }
        if (Number.isFinite(nextHeight) && nextHeight > 0) {
          setToolbarHeight(nextHeight);
        }
      }
      if (surface) {
        const nextSurfaceRect = surface.getBoundingClientRect();
        const surfaceScaleX =
          surface.offsetWidth > 0
            ? nextSurfaceRect.width / surface.offsetWidth
            : 1;
        const surfaceScaleY =
          surface.offsetHeight > 0
            ? nextSurfaceRect.height / surface.offsetHeight
            : 1;
        setSurfaceRect({
          height: nextSurfaceRect.height,
          left: nextSurfaceRect.left,
          top: nextSurfaceRect.top,
          width: nextSurfaceRect.width,
          scaleX: Number.isFinite(surfaceScaleX) ? surfaceScaleX : 1,
          scaleY: Number.isFinite(surfaceScaleY) ? surfaceScaleY : 1,
        });
      }
    };
    updateMeasurements();
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(updateMeasurements);
    if (observer) {
      const toolbar = toolbarRef.current;
      if (toolbar) observer.observe(toolbar);
      if (surface) observer.observe(surface);
    }
    window.addEventListener("resize", updateMeasurements);
    window.addEventListener("scroll", updateMeasurements, true);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateMeasurements);
      window.removeEventListener("scroll", updateMeasurements, true);
    };
  }, [mounted]);

  const viewportWidth =
    typeof window === "undefined" ? surfaceRect.width : window.innerWidth;
  const surfaceWidth = surfaceRect.width > 0 ? surfaceRect.width : viewportWidth;
  const anchorX =
    (anchorBox?.x ?? (element.position?.x ?? 0) * scale) * surfaceRect.scaleX;
  const anchorY =
    (anchorBox?.y ?? (element.position?.y ?? 0) * scale) * surfaceRect.scaleY;
  const preferredToolbarLeft = surfaceRect.left + anchorX;
  const minToolbarLeft = Math.max(
    TEXT_TOOLBAR_EDGE_PADDING,
    surfaceRect.left + TEXT_TOOLBAR_EDGE_PADDING,
  );
  const maxToolbarLeft = Math.max(
    TEXT_TOOLBAR_EDGE_PADDING,
    Math.min(
      surfaceRect.left + surfaceWidth - toolbarWidth - TEXT_TOOLBAR_EDGE_PADDING,
      viewportWidth - toolbarWidth - TEXT_TOOLBAR_EDGE_PADDING,
    ),
  );
  const toolbarLeft = Math.max(
    minToolbarLeft,
    Math.min(preferredToolbarLeft, maxToolbarLeft),
  );
  const toolbarTop = Math.max(
    TEXT_TOOLBAR_EDGE_PADDING,
    surfaceRect.top + anchorY - toolbarHeight - TEXT_TOOLBAR_GAP,
  );
  const toolbarBounds =
    surfaceRect.width > 0 && surfaceRect.height > 0
      ? {
          bottom: surfaceRect.top + surfaceRect.height,
          left: surfaceRect.left,
          right: surfaceRect.left + surfaceRect.width,
          top: surfaceRect.top,
        }
      : null;

  const toolbarNode = (
    <FloatingToolbarBoundsProvider bounds={toolbarBounds}>
      <div
        ref={toolbarRef}
        data-inline-edit-ignore="true"
        data-template-v2-floating-toolbar="true"
        style={{
          position: "fixed",
          zIndex: 10000,
          left: toolbarLeft,
          top: toolbarTop,
          pointerEvents: "auto",
          visibility: surfaceRect.width > 0 ? "visible" : "hidden",
        }}
        onMouseDown={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div style={textToolbarStyles.toolbar}>
          <FontFamilyPicker
            selectedFamily={font.family}
            templateFonts={templateFonts}
            googleFonts={GOOGLE_FONT_OPTIONS}
            onSelect={updateFontFamily}
          />
          <Divider />
          <div style={textToolbarStyles.fontSizeControl}>
            <input
              aria-label="Font size"
              title="Font size"
              type="text"
              inputMode={numericInputMode(fontSizeInputOptions)}
              value={fontSizeDraft}
              onFocus={() => {
                setFontSizeEditing(true);
                setFontSizeDraft(formattedFontSize);
              }}
              onBlur={() => {
                setFontSizeEditing(false);
                commitFontSizeDraft();
              }}
              onChange={(event) =>
                updateFontSize(
                  sanitizeNumericInput(event.target.value, fontSizeInputOptions),
                )
              }
              onKeyDown={(event) => {
                if (preventInvalidNumberInput(event, fontSizeInputOptions)) return;
                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  stepFontSize(1);
                }
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  stepFontSize(-1);
                }
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitFontSizeDraft();
                  event.currentTarget.blur();
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  setFontSizeDraft(formattedFontSize);
                  event.currentTarget.blur();
                }
              }}
              style={textToolbarStyles.fontSizeInput}
            />
            <span style={textToolbarStyles.fontSizeStepper}>
              <button
                type="button"
                aria-label="Increase font size"
                title="Increase font size"
                onClick={() => stepFontSize(1)}
                style={textToolbarStyles.fontSizeStepButton}
              >
                <span style={textToolbarStyles.fontSizeArrowUp} />
              </button>
              <button
                type="button"
                aria-label="Decrease font size"
                title="Decrease font size"
                onClick={() => stepFontSize(-1)}
                style={textToolbarStyles.fontSizeStepButton}
              >
                <span style={textToolbarStyles.fontSizeArrowDown} />
              </button>
            </span>
          </div>
          <Divider />
          <label
            aria-label="Text color"
            title="Text color"
            style={textToolbarStyles.colorControl}
            onMouseEnter={() => setHoveredControl("color")}
            onMouseLeave={() => setHoveredControl(null)}
          >
            <span
              aria-hidden="true"
              style={{
                ...textToolbarStyles.colorDot,
                background: withHash(font.color),
              }}
            />
            <DeferredColorInput
              aria-label="Text color"
              value={font.color}
              onCommit={(color) => updateFont({ color })}
              style={textToolbarStyles.hiddenInput}
            />
          </label>
          <Divider />
          <div style={textToolbarStyles.modeGroup}>
            <ToolbarButton
              title="Bold"
              controlId="bold"
              hoveredControl={hoveredControl}
              pressed={font.bold ?? false}
              setHoveredControl={setHoveredControl}
              onClick={() => updateFont({ bold: !(font.bold ?? false) })}
            >
              <Bold size={18} strokeWidth={2.25} aria-hidden="true" />
            </ToolbarButton>
            <ToolbarButton
              title="Italic"
              controlId="italic"
              hoveredControl={hoveredControl}
              pressed={font.italic ?? false}
              setHoveredControl={setHoveredControl}
              onClick={() => updateFont({ italic: !(font.italic ?? false) })}
            >
              <Italic size={18} strokeWidth={2.25} aria-hidden="true" />
            </ToolbarButton>
            <ToolbarButton
              title="Underline"
              controlId="underline"
              hoveredControl={hoveredControl}
              pressed={font.underline ?? false}
              setHoveredControl={setHoveredControl}
              onClick={() =>
                updateFont({ underline: !(font.underline ?? false) })
              }
            >
              <Underline size={18} strokeWidth={2.25} aria-hidden="true" />
            </ToolbarButton>
            <ToolbarButton
              title={
                disableAlignment
                  ? "Alignment is unavailable for list text"
                  : "Horizontal alignment"
              }
              controlId="horizontal-alignment"
              disabled={disableAlignment}
              hoveredControl={hoveredControl}
              setHoveredControl={setHoveredControl}
              onClick={() =>
                updateAlignment({
                  horizontal:
                    horizontalAlignment === "left"
                      ? "center"
                      : horizontalAlignment === "center"
                        ? "right"
                        : "left",
                })
              }
            >
              <HorizontalAlignmentIcon
                size={18}
                strokeWidth={2.2}
                aria-hidden="true"
              />
            </ToolbarButton>
          </div>
          <Divider />
          {hasListMarkerControls ? (
            <>
              <div style={textToolbarStyles.settingsControlWrap}>
                <ToolbarButton
                  title="List marker"
                  controlId="list-marker"
                  hoveredControl={hoveredControl}
                  pressed={openPanel === "marker"}
                  setHoveredControl={setHoveredControl}
                  onClick={() =>
                    setOpenPanel((current) =>
                      current === "marker" ? null : "marker",
                    )
                  }
                >
                  <ListMarkerIcon
                    size={18}
                    strokeWidth={2.2}
                    aria-hidden="true"
                  />
                </ToolbarButton>
                {openPanel === "marker" ? (
                  <ListMarkerPanel
                    marker={listMarker}
                    onChange={(marker) => {
                      onListMarkerChange(marker);
                      setOpenPanel(null);
                    }}
                  />
                ) : null}
              </div>
              <Divider />
            </>
          ) : null}
          <div style={textToolbarStyles.settingsControlWrap}>
            <ToolbarButton
              title="Settings"
              controlId="settings"
              hoveredControl={hoveredControl}
              setHoveredControl={setHoveredControl}
              onClick={() =>
                setOpenPanel((current) =>
                  current === "settings" ? null : "settings",
                )
              }
            >
              <Settings size={18} strokeWidth={2.3} aria-hidden="true" />
            </ToolbarButton>
            {openPanel === "settings" ? (
              <TextSettingsPanel
                opacity={opacity}
                letterSpacing={letterSpacing}
                lineHeight={lineHeight}
                onOpacityChange={updateOpacity}
                onLetterSpacingChange={updateLetterSpacing}
                onLineHeightChange={updateLineHeight}
              />
            ) : null}
          </div>
          {componentActions ? (
            <>
              <Divider />
              <ComponentUngroupButton actions={componentActions} />
              {componentActions.canUngroup ? <Divider /> : null}
              <ComponentActionsMenu actions={componentActions} />
            </>
          ) : null}
        </div>
      </div>
    </FloatingToolbarBoundsProvider>
  );

  return (
    <>
      <span ref={anchorRef} data-inline-edit-ignore="true" />
      {mounted ? createPortal(toolbarNode, document.body) : null}
    </>
  );
}

function ToolbarButton({
  children,
  controlId,
  disabled = false,
  hoveredControl,
  onClick,
  pressed,
  setHoveredControl,
  title,
}: {
  children: ReactNode;
  controlId: string;
  disabled?: boolean;
  hoveredControl: string | null;
  onClick?: () => void;
  pressed?: boolean;
  setHoveredControl: (control: string | null) => void;
  title: string;
}) {
  const hovered = hoveredControl === controlId;
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      onMouseDown={(event) => event.preventDefault()}
      onMouseEnter={() => {
        if (!disabled) setHoveredControl(controlId);
      }}
      onMouseLeave={() => {
        if (!disabled) setHoveredControl(null);
      }}
      style={{
        ...textToolbarStyles.button,
        ...(hovered && !disabled ? textToolbarStyles.buttonHover : {}),
        ...(pressed && !disabled ? textToolbarStyles.buttonActive : {}),
        ...(disabled ? textToolbarStyles.buttonDisabled : {}),
      }}
    >
      {children}
    </button>
  );
}

function uniqueFontFamilies(families: string[]) {
  const seenFamilies = new Set<string>();
  const uniqueFamilies: string[] = [];

  families.forEach((family) => {
    if (seenFamilies.has(family)) return;
    seenFamilies.add(family);
    uniqueFamilies.push(family);
  });

  return uniqueFamilies;
}

function FontFamilyPicker({
  selectedFamily,
  templateFonts,
  googleFonts,
  onSelect,
}: {
  selectedFamily: string;
  templateFonts: TemplateFontOption[];
  googleFonts: GoogleFontOption[];
  onSelect: (family: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(selectedFamily);
  const [searching, setSearching] = useState(false);
  const [loadedGoogleFonts, setLoadedGoogleFonts] = useState<
    GoogleFontOption[] | null
  >(null);
  const [activeSource, setActiveSource] = useState<FontPickerSource>(() =>
    templateFonts.some(({ family }) => family === selectedFamily)
      ? "template"
      : "google",
  );
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuPanelRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const googleFontLoadStartedRef = useRef(false);
  const loadFullGoogleFonts = useCallback(() => {
    if (googleFontLoadStartedRef.current) return;

    googleFontLoadStartedRef.current = true;
    void loadGoogleFontOptions().then(
      (options) => {
        setLoadedGoogleFonts(options);
      },
      () => {
        googleFontLoadStartedRef.current = false;
      },
    );
  }, []);

  useEffect(() => {
    if (!open) return;
    loadFullGoogleFonts();
    setQuery(selectedFamily);
    setSearching(false);
    setActiveSource(
      templateFonts.some(({ family }) => family === selectedFamily)
        ? "template"
        : "google",
    );
    window.setTimeout(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }, 0);
  }, [loadFullGoogleFonts, open, selectedFamily, templateFonts]);

  useEffect(() => {
    if (!open || typeof document === "undefined") return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && menuRef.current?.contains(target)) return;
      const menuPanel = menuPanelRef.current;
      if (menuPanel) {
        const rect = menuPanel.getBoundingClientRect();
        if (
          event.clientX >= rect.left &&
          event.clientX <= rect.right &&
          event.clientY >= rect.top &&
          event.clientY <= rect.bottom
        ) {
          return;
        }
      }
      setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [open]);

  const selectFamily = (family: string) => {
    onSelect(family);
    setOpen(false);
  };
  const resolvedGoogleFonts = loadedGoogleFonts ?? googleFonts;
  const templateFontFamilySet = useMemo(
    () => new Set(templateFonts.map(({ family }) => family)),
    [templateFonts],
  );
  const normalizedQuery = query.trim().toLowerCase();
  const hasSearchQuery = searching && normalizedQuery.length > 0;
  const templateFamilies = useMemo(
    () => templateFonts.map(({ family }) => family),
    [templateFonts],
  );
  const googleFamilies = useMemo(
    () =>
      resolvedGoogleFonts
        .filter(({ family }) => !templateFontFamilySet.has(family))
        .map(({ family }) => family),
    [resolvedGoogleFonts, templateFontFamilySet],
  );
  const activeFamilies =
    activeSource === "template" && templateFamilies.length > 0
      ? templateFamilies
      : googleFamilies;
  const searchFamilies = useMemo(
    () => uniqueFontFamilies([...templateFamilies, ...googleFamilies]),
    [googleFamilies, templateFamilies],
  );
  const visibleFamilies = useMemo(
    () =>
      hasSearchQuery
        ? searchFamilies.filter((family) =>
            family.toLowerCase().includes(normalizedQuery),
          )
        : activeFamilies,
    [activeFamilies, hasSearchQuery, normalizedQuery, searchFamilies],
  );
  const activeTitle = hasSearchQuery
    ? "All Fonts"
    : activeSource === "template" && templateFamilies.length > 0
      ? "Template Fonts"
      : "Google Fonts";
  const swapFontSource = () => {
    setSearching(false);
    setQuery(selectedFamily);
    setActiveSource((current) => {
      if (current === "template") return "google";
      return templateFamilies.length > 0 ? "template" : "google";
    });
    window.setTimeout(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }, 0);
  };

  return (
    <div
      ref={menuRef}
      data-inline-edit-ignore="true"
      style={textToolbarStyles.fontControl}
      onMouseDown={(event) => {
        const target = event.target;
        if (
          target instanceof HTMLElement &&
          target.closest("[data-font-search-input='true']")
        ) {
          return;
        }
        event.preventDefault();
      }}
    >
      <button
        type="button"
        aria-label="Font family"
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Font family"
        style={textToolbarStyles.fontTrigger}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
      >
        <span style={textToolbarStyles.fontTriggerText}>{selectedFamily}</span>
        <ChevronDown
          size={18}
          aria-hidden="true"
          style={textToolbarStyles.selectIcon}
        />
      </button>
      {open ? (
        <FloatingToolbarPanel
          ref={menuPanelRef}
          role="listbox"
          aria-label="Font family"
          style={textToolbarStyles.fontMenu}
          onWheel={(event) => event.stopPropagation()}
          onScroll={(event) => event.stopPropagation()}
        >
          <div style={textToolbarStyles.fontSearchRow}>
            <Search size={16} strokeWidth={2.2} aria-hidden="true" />
            <input
              ref={searchInputRef}
              data-font-search-input="true"
              aria-label="Search fonts"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSearching(true);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  setOpen(false);
                }
              }}
              style={textToolbarStyles.fontSearchInput}
            />
            <button
              type="button"
              aria-label="Clear font search"
              title="Clear"
              style={textToolbarStyles.fontSearchClear}
              onClick={() => {
                setQuery("");
                setSearching(false);
                searchInputRef.current?.focus();
              }}
            >
              <XCircle size={15} strokeWidth={2.1} aria-hidden="true" />
            </button>
          </div>
          <div aria-hidden="true" style={textToolbarStyles.fontMenuDivider} />
          <FontMenuSection
            title={activeTitle}
            families={visibleFamilies}
            selectedFamily={selectedFamily}
            onSelect={selectFamily}
            onSwap={swapFontSource}
          />
        </FloatingToolbarPanel>
      ) : null}
    </div>
  );
}

function FontMenuSection({
  title,
  families,
  selectedFamily,
  onSelect,
  onSwap,
}: {
  title: string;
  families: string[];
  selectedFamily: string;
  onSelect: (family: string) => void;
  onSwap: () => void;
}) {
  const optionsRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const viewportRows = Math.min(families.length, FONT_MENU_MAX_VISIBLE_ROWS);
  const viewportHeight = Math.max(1, viewportRows) * FONT_MENU_OPTION_HEIGHT;
  const firstVisibleIndex = Math.max(
    0,
    Math.floor(scrollTop / FONT_MENU_OPTION_HEIGHT) - FONT_MENU_OVERSCAN_ROWS,
  );
  const visibleOptionCount =
    viewportRows + FONT_MENU_OVERSCAN_ROWS * 2 + 1;
  const virtualFamilies = families.slice(
    firstVisibleIndex,
    firstVisibleIndex + visibleOptionCount,
  );

  useEffect(() => {
    setScrollTop(0);
    if (optionsRef.current) {
      optionsRef.current.scrollTop = 0;
    }
  }, [families]);

  return (
    <div style={textToolbarStyles.fontMenuSection}>
      <div style={textToolbarStyles.fontMenuHeading}>
        <span>{title}</span>
        <button
          type="button"
          aria-label="Swap font source"
          title="Swap font source"
          style={textToolbarStyles.fontSourceSwapButton}
          onMouseDown={(event) => event.preventDefault()}
          onClick={onSwap}
        >
          <Repeat2 size={14} strokeWidth={2.1} aria-hidden="true" />
        </button>
      </div>
      <div
        ref={optionsRef}
        style={{
          ...textToolbarStyles.fontMenuOptions,
          height: viewportHeight,
        }}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      >
        {families.length === 0 ? (
          <div style={textToolbarStyles.fontMenuEmpty}>No fonts</div>
        ) : (
          <div
            style={{
              ...textToolbarStyles.fontMenuVirtualSpace,
              height: families.length * FONT_MENU_OPTION_HEIGHT,
            }}
          >
            {virtualFamilies.map((family, offset) => {
              const familyIndex = firstVisibleIndex + offset;
              const selected = family === selectedFamily;
              return (
                <button
                  key={family}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  title={family}
                  style={{
                    ...textToolbarStyles.fontMenuOption,
                    ...textToolbarStyles.fontMenuOptionVirtual,
                    top: familyIndex * FONT_MENU_OPTION_HEIGHT,
                    ...(selected
                      ? textToolbarStyles.fontMenuOptionSelected
                      : {}),
                  }}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onSelect(family)}
                >
                  <span style={textToolbarStyles.fontMenuCheck}>
                    {selected ? (
                      <Check size={14} strokeWidth={2.4} aria-hidden="true" />
                    ) : null}
                  </span>
                  <span style={textToolbarStyles.fontMenuOptionLabel}>
                    {family}
                  </span>
                  <span style={textToolbarStyles.fontMenuSample}>Aa</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Divider() {
  return <span aria-hidden="true" style={textToolbarStyles.divider} />;
}

function LetterSpacingIcon() {
  return (
    <span aria-hidden="true" style={textToolbarStyles.textIcon}>
      <span style={textToolbarStyles.letterSpacingBar} />
      A
      <span style={textToolbarStyles.letterSpacingBar} />
    </span>
  );
}

function LineHeightIcon() {
  return (
    <span aria-hidden="true" style={textToolbarStyles.lineHeightIcon}>
      A
      <span style={textToolbarStyles.lineHeightLineTop} />
      <span style={textToolbarStyles.lineHeightLineBottom} />
    </span>
  );
}

function TextSettingsPanel({
  opacity,
  letterSpacing,
  lineHeight,
  onOpacityChange,
  onLetterSpacingChange,
  onLineHeightChange,
}: {
  opacity: number;
  letterSpacing: number;
  lineHeight: number;
  onOpacityChange: (value: number) => void;
  onLetterSpacingChange: (value: number) => void;
  onLineHeightChange: (value: number) => void;
}) {
  return (
    <FloatingToolbarPanel
      data-inline-edit-ignore="true"
      style={{ ...textToolbarStyles.settingsPanel, minHeight: 170 }}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <SettingsSliderRow
        label="Opacity"
        icon={<OpacityIcon />}
        value={opacity}
        valueLabel={formatOpacity(opacity)}
        min={0}
        max={1}
        step={0.05}
        onChange={onOpacityChange}
      />
      <SettingsSliderRow
        label="Letter spacing"
        icon={<LetterSpacingIcon />}
        value={letterSpacing}
        valueLabel={formatSettingsLetterSpacing(letterSpacing)}
        min={MIN_LETTER_SPACING}
        max={MAX_LETTER_SPACING}
        step={10}
        onChange={onLetterSpacingChange}
      />
      <SettingsSliderRow
        label="Line height"
        icon={<LineHeightIcon />}
        value={lineHeight}
        valueLabel={formatLineHeight(lineHeight)}
        min={MIN_LINE_HEIGHT}
        max={MAX_LINE_HEIGHT}
        step={0.05}
        onChange={onLineHeightChange}
      />
    </FloatingToolbarPanel>
  );
}

function ListMarkerPanel({
  marker,
  onChange,
}: {
  marker: Marker;
  onChange: (marker: Marker) => void;
}) {
  return (
    <FloatingToolbarPanel
      aria-label="List marker"
      style={textToolbarStyles.markerPanel}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div style={textToolbarStyles.settingsBulletActions}>
        <SettingsPanelButton
          label="Bullet list"
          pressed={marker === "bullet"}
          onClick={() => onChange("bullet")}
        >
          <List size={19} strokeWidth={2.2} aria-hidden="true" />
        </SettingsPanelButton>
        <SettingsPanelButton
          label="Numbered list"
          pressed={marker === "number"}
          onClick={() => onChange("number")}
        >
          <ListOrdered size={19} strokeWidth={2.2} aria-hidden="true" />
        </SettingsPanelButton>
        <SettingsPanelButton
          label="No list"
          pressed={marker === "none"}
          onClick={() => onChange("none")}
        >
          <Ban size={19} strokeWidth={2.1} aria-hidden="true" />
        </SettingsPanelButton>
      </div>
    </FloatingToolbarPanel>
  );
}

function SettingsSliderRow({
  icon,
  label,
  value,
  valueLabel,
  min,
  max,
  step,
  onChange,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  valueLabel: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  const progress =
    max === min
      ? 0
      : ((clampMetric(value, min, max) - min) / (max - min)) * 100;

  return (
    <label style={textToolbarStyles.settingsSliderRow}>
      <span style={textToolbarStyles.settingsSliderHeader}>
        <span style={textToolbarStyles.settingsSliderIcon}>{icon}</span>
        <span style={textToolbarStyles.settingsValueBadge}>{valueLabel}</span>
      </span>
      <span style={textToolbarStyles.settingsSliderWrap}>
        <span aria-hidden="true" style={textToolbarStyles.settingsSliderTrack}>
          <span
            style={{
              ...textToolbarStyles.settingsSliderFill,
              width: `${progress}%`,
            }}
          />
          <span
            style={{
              ...textToolbarStyles.settingsSliderThumb,
              left: `${progress}%`,
            }}
          />
        </span>
        <input
          aria-label={label}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          style={textToolbarStyles.settingsSliderInput}
        />
      </span>
    </label>
  );
}

function SettingsPanelButton({
  children,
  label,
  onClick,
  pressed = false,
}: {
  children: ReactNode;
  label: string;
  onClick?: () => void;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      style={{
        ...textToolbarStyles.settingsBulletButton,
        ...(pressed ? textToolbarStyles.settingsBulletButtonActive : {}),
      }}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function OpacityIcon() {
  return <span aria-hidden="true" style={textToolbarStyles.opacityIcon} />;
}

const textToolbarStyles = {
  toolbar: {
    display: "inline-flex",
    alignItems: "center",
    boxSizing: "border-box",
    height: 40,
    width: "auto",
    maxWidth: "calc(100vw - 32px)",
    padding: "0 10px",
    border: 0,
    borderRadius: 6,
    background: "#FFFFFF",
    boxShadow: "0 0 4px rgba(0, 0, 0, 0.15)",
    gap: 12,
  },
  fontControl: {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    width: 126,
    height: 36,
    flex: "0 0 auto",
  },
  fontTrigger: {
    width: "100%",
    height: 28,
    border: 0,
    outline: "none",
    borderRadius: 4,
    background: "transparent",
    color: "#0B1220",
    fontFamily:
      "var(--font-inter), -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
    fontSize: 14,
    fontWeight: 400,
    cursor: "pointer",
    padding: "0 24px 0 8px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  fontTriggerText: {
    display: "block",
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  selectIcon: {
    position: "absolute",
    right: 6,
    color: "#0B1220",
    pointerEvents: "none",
  },
  fontMenu: {
    position: "absolute",
    top: 44,
    left: -8,
    width: 242,
    maxHeight: 360,
    overflow: "hidden",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    padding: "10px 0 10px",
    borderRadius: 6,
    border: "1px solid #E6E7EB",
    background: "#FFFFFF",
    boxShadow: "0 18px 40px rgba(15, 23, 42, 0.14)",
    color: "#151922",
    zIndex: 30,
  },
  fontSearchRow: {
    height: 36,
    boxSizing: "border-box",
    display: "grid",
    gridTemplateColumns: "18px minmax(0, 1fr) 18px",
    alignItems: "center",
    gap: 6,
    padding: "0 12px",
    color: "#111827",
    fontFamily:
      "var(--font-inter), -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
  },
  fontSearchInput: {
    minWidth: 0,
    height: 28,
    border: 0,
    outline: "none",
    background: "transparent",
    color: "#111827",
    fontFamily:
      "var(--font-inter), -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
    fontSize: 14,
    fontWeight: 400,
    padding: 0,
  },
  fontSearchClear: {
    width: 18,
    height: 18,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: 0,
    borderRadius: 999,
    background: "transparent",
    color: "#111827",
    cursor: "pointer",
    padding: 0,
  },
  fontMenuDivider: {
    width: "100%",
    height: 1,
    background: "#ECEEF2",
  },
  fontMenuSection: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    minHeight: 0,
    padding: "8px 10px 0",
  },
  fontMenuHeading: {
    height: 26,
    boxSizing: "border-box",
    padding: "0 8px",
    border: "1px solid #CBB6FF",
    borderRadius: 4,
    color: "#7C51F8",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    fontFamily:
      "var(--font-inter), -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
    fontSize: 12,
    fontWeight: 500,
    lineHeight: 1,
    whiteSpace: "nowrap",
  },
  fontSourceSwapButton: {
    width: 18,
    height: 18,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: 0,
    borderRadius: 4,
    background: "transparent",
    color: "currentColor",
    cursor: "pointer",
    padding: 0,
  },
  fontMenuOptions: {
    display: "flex",
    flexDirection: "column",
    gap: 0,
    maxHeight: 250,
    minHeight: 0,
    overflowY: "auto",
    overscrollBehavior: "contain",
  },
  fontMenuVirtualSpace: {
    position: "relative",
    width: "100%",
    minHeight: "100%",
  },
  fontMenuOption: {
    width: "100%",
    minHeight: 30,
    border: 0,
    borderRadius: 4,
    background: "transparent",
    color: "#151922",
    cursor: "pointer",
    display: "grid",
    gridTemplateColumns: "22px minmax(0, 1fr) 24px",
    alignItems: "center",
    columnGap: 4,
    padding: "0 8px 0 4px",
    textAlign: "left",
    fontFamily:
      "var(--font-inter), -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
    fontSize: 13,
    fontWeight: 400,
    lineHeight: 1,
  },
  fontMenuOptionVirtual: {
    position: "absolute",
    left: 0,
    height: FONT_MENU_OPTION_HEIGHT,
  },
  fontMenuOptionSelected: {
    background: "#F1F1F4",
    color: "#111827",
  },
  fontMenuEmpty: {
    height: FONT_MENU_OPTION_HEIGHT,
    display: "flex",
    alignItems: "center",
    padding: "0 8px",
    color: "#6B7280",
    fontFamily:
      "var(--font-inter), -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
    fontSize: 13,
  },
  fontMenuCheck: {
    width: 22,
    minWidth: 22,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: "currentColor",
  },
  fontMenuOptionLabel: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  fontMenuSample: {
    justifySelf: "end",
    color: "#151922",
    fontSize: 13,
    lineHeight: 1,
  },
  fontSizeControl: {
    width: 70,
    height: 36,
    boxSizing: "border-box",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    flex: "0 0 auto",
  },
  fontSizeInput: {
    width: 36,
    height: 28,
    boxSizing: "border-box",
    border: 0,
    outline: "none",
    background: "transparent",
    color: "#0B1220",
    fontFamily:
      "var(--font-inter), -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
    fontSize: 14,
    fontWeight: 400,
    textAlign: "center",
    padding: 0,
    flex: "0 0 auto",
  },
  fontSizeStepper: {
    display: "inline-flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    width: 12,
    height: 24,
    flex: "0 0 auto",
  },
  fontSizeStepButton: {
    width: 12,
    height: 10,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: 0,
    borderRadius: 2,
    background: "transparent",
    padding: 0,
    cursor: "pointer",
    color: "#05070A",
  },
  fontSizeArrowUp: {
    width: 0,
    height: 0,
    borderLeft: "4px solid transparent",
    borderRight: "4px solid transparent",
    borderBottom: "6px solid currentColor",
  },
  fontSizeArrowDown: {
    width: 0,
    height: 0,
    borderLeft: "4px solid transparent",
    borderRight: "4px solid transparent",
    borderTop: "6px solid currentColor",
  },
  divider: {
    width: 1,
    height: 24,
    background: "#E5E7EB",
    flex: "0 0 auto",
  },
  modeGroup: {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    flex: "0 0 auto",
  },
  button: {
    boxSizing: "border-box",
    width: 22,
    height: 22,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: 0,
    outline: "none",
    borderRadius: 2,
    background: "transparent",
    color: "#05070A",
    cursor: "pointer",
    padding: 4,
    flex: "0 0 auto",
  },
  buttonHover: {
    background: "#F8F8FA",
  },
  buttonActive: {
    color: "#7C51F8",
    background: "#F4F1FF",
  },
  buttonDisabled: {
    color: "#A4A7AE",
    cursor: "not-allowed",
    opacity: 0.55,
  },
  colorControl: {
    position: "relative",
    width: 22,
    height: 28,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    cursor: "pointer",
    flex: "0 0 auto",
  },
  colorDot: {
    width: 16,
    height: 16,
    borderRadius: 999,
    boxShadow: "inset 0 0 0 1px rgba(17, 24, 39, 0.12)",
  },
  hiddenInput: {
    position: "absolute",
    inset: 0,
    opacity: 0,
    cursor: "pointer",
  },
  settingsControlWrap: {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flex: "0 0 auto",
  },
  settingsPanel: {
    position: "absolute",
    top: 52,
    right: -100,
    width: 217,
    minHeight: 230,
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    gap: 14,
    alignItems: "center",
    padding: 12,
    borderRadius: 6,
    border: "1px solid #E5E7EB",
    background: "#FFFFFF",
    boxShadow: "0 18px 44px rgba(15, 23, 42, 0.16)",
    zIndex: 80,
  },
  markerPanel: {
    width: 164,
    boxSizing: "border-box",
    padding: 10,
    borderRadius: 6,
    border: "1px solid #E5E7EB",
    background: "#FFFFFF",
    boxShadow: "0 18px 44px rgba(15, 23, 42, 0.16)",
  },
  settingsSliderRow: {
    width: "100%",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    gap: 7,
  },
  settingsSliderHeader: {
    width: "100%",
    height: 24,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  settingsSliderIcon: {
    width: 24,
    height: 24,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#111827",
  },
  settingsSliderInput: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    opacity: 0,
    cursor: "pointer",
    margin: 0,
  },
  settingsSliderWrap: {
    position: "relative",
    width: "100%",
    height: 16,
    display: "flex",
    alignItems: "center",
  },
  settingsSliderTrack: {
    position: "relative",
    width: "100%",
    height: 3,
    borderRadius: 999,
    background: "#ECEEF2",
    overflow: "visible",
  },
  settingsSliderFill: {
    position: "absolute",
    left: 0,
    top: 0,
    height: 3,
    borderRadius: 999,
    background: "#7C51F8",
  },
  settingsSliderThumb: {
    position: "absolute",
    top: "50%",
    width: 14,
    height: 14,
    borderRadius: 999,
    background: "#FFFFFF",
    boxShadow: "0 0 0 1px #E5E7EB, 0 1px 2px rgba(15, 23, 42, 0.12)",
    transform: "translate(-50%, -50%)",
    pointerEvents: "none",
  },
  settingsValueBadge: {
    height: 24,
    width: 42,
    boxSizing: "border-box",
    borderRadius: 999,
    border: "1px solid #E5E7EB",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 8px",
    color: "#111827",
    fontFamily:
      "var(--font-inter), -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
    fontSize: 12,
    fontWeight: 400,
    lineHeight: 1,
    whiteSpace: "nowrap",
  },
  settingsBulletActions: {
    width: "100%",
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 10,
  },
  settingsBulletButton: {
    height: 36,
    border: 0,
    borderRadius: 4,
    background: "#F4F4F7",
    color: "#05070A",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    padding: 0,
  },
  settingsBulletButtonActive: {
    background: "#EFEAFF",
    color: "#7C51F8",
  },
  opacityIcon: {
    display: "inline-block",
    width: 19,
    height: 19,
    backgroundImage: "url('/Opacity.svg')",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    backgroundSize: "contain",
    flex: "0 0 auto",
    overflow: "hidden",
  },
  textIcon: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    color: "currentColor",
    fontSize: 18,
    lineHeight: 1,
    fontFamily: "Georgia, 'Times New Roman', serif",
  },
  letterSpacingBar: {
    display: "inline-block",
    width: 1.5,
    height: 22,
    background: "currentColor",
  },
  lineHeightIcon: {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 22,
    height: 24,
    color: "currentColor",
    fontSize: 19,
    lineHeight: 1,
    fontFamily: "Georgia, 'Times New Roman', serif",
  },
  lineHeightLineTop: {
    position: "absolute",
    top: 2,
    width: 18,
    height: 1.5,
    background: "currentColor",
  },
  lineHeightLineBottom: {
    position: "absolute",
    bottom: 1,
    width: 18,
    height: 1.5,
    background: "currentColor",
  },
} satisfies Record<string, CSSProperties>;
