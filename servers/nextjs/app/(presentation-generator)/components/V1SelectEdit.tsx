"use client";
import React, {
  RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useDispatch, useSelector } from "react-redux";
import { PresentationGenerationApi } from "../services/api/presentation-generation";
import { toast } from "sonner";
import { Edit, Loader2, Sparkles } from "lucide-react";

type HtmlSelectionEditorProps = {
  containerRef: RefObject<HTMLDivElement | null>;
  slide: any;
  enableEditMode?: boolean;
};

const HtmlSelectionEditor = ({
  containerRef,
  slide,
  enableEditMode = false,
}: HtmlSelectionEditorProps) => {
  const dispatch = useDispatch();
  const enableHtmlSelector = useSelector(
    (s: any) => s?.presentationGeneration?.enableHtmlSelector
  ) as boolean | undefined;
  const allowSelection = !!(enableEditMode || enableHtmlSelector);
  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);

  const [hoverRect, setHoverRect] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [promptValue, setPromptValue] = useState("");
  const [updatingSelection, setUpdatingSelection] = useState(false);
  const [inputPos, setInputPos] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const hoveredElRef = useRef<HTMLElement | null>(null);
  const aiEditorButtonRef = useRef<HTMLButtonElement | null>(null);

  const selectedElsRef = useRef<Set<HTMLElement>>(new Set());
  const [selectionRects, setSelectionRects] = useState<
    Array<{ left: number; top: number; width: number; height: number }>
  >([]);

  useEffect(() => {
    setPortalNode(document.body);
  }, []);

  const getContainer = useCallback((): HTMLElement | null => {
    return containerRef.current;
  }, [containerRef]);

  const computeClampedRect = useCallback(
    (el: HTMLElement, container: HTMLElement) => {
      const r = el.getBoundingClientRect();
      const c = container.getBoundingClientRect();
      const left = Math.max(r.left, c.left);
      const top = Math.max(r.top, c.top);
      const right = Math.min(r.right, c.right);
      const bottom = Math.min(r.bottom, c.bottom);
      const width = Math.max(0, right - left);
      const height = Math.max(0, bottom - top);
      if (width === 0 || height === 0) return null;
      return { left, top, width, height, containerRect: c } as const;
    },
    []
  );

  const positionPrompt = useCallback(
    (
      rect: { left: number; top: number; width: number; height: number },
      containerRect: DOMRect
    ) => {
      const viewportW = window.innerWidth;
      const viewportH = window.innerHeight;
      const PROMPT_WIDTH = 440;
      const PROMPT_HEIGHT = 140;
      const MARGIN = 10;
      const OFFSET = 8;

      if (rect.top + rect.height < 0 || rect.top > viewportH) return null;

      let left = rect.left + rect.width - PROMPT_WIDTH + OFFSET;
      // Always position BELOW the selection; clamp within viewport without flipping above
      let top = rect.top + rect.height + OFFSET;
      top = Math.min(top, viewportH - PROMPT_HEIGHT - MARGIN);
      top = Math.max(top, MARGIN);

      const maxLeft = Math.min(
        containerRect.right - PROMPT_WIDTH - MARGIN,
        viewportW - PROMPT_WIDTH - MARGIN
      );
      const minLeft = Math.max(containerRect.left + MARGIN, MARGIN);
      left = Math.min(Math.max(left, minLeft), maxLeft);

      return { left, top };
    },
    []
  );

  // Heuristic to map a raw target to a selectable "card/root" element
  const normalizeSelectableElement = useCallback(
    (el: HTMLElement | null, container: HTMLElement): HTMLElement | null => {
      if (!el) return null;
      // Prefer explicit markers if present
      const marked = el.closest(
        "[data-select-root], [data-card], .card"
      ) as HTMLElement | null;
      if (marked && container.contains(marked)) return marked;
      // Otherwise, use the exact hovered element (do NOT climb), unless it is effectively the container
      const r = el.getBoundingClientRect();
      const c = container.getBoundingClientRect();
      const isContainerSized =
        r.width >= c.width * 0.98 && r.height >= c.height * 0.98;
      if (isContainerSized) {
        return null;
      }
      return el;
    },
    []
  );

  const setFromTarget = useCallback(
    (target: HTMLElement, forcePrompt?: boolean) => {
      const container = getContainer();
      if (!container) {
        setHoverRect(null);
        return;
      }
      const clamped = computeClampedRect(target, container);
      if (!clamped) {
        setHoverRect(null);
        setInputPos(null);
        return;
      }
      const { left, top, width, height, containerRect } = clamped;
      setHoverRect((prev) => {
        if (
          prev &&
          prev.left === left &&
          prev.top === top &&
          prev.width === width &&
          prev.height === height
        )
          return prev;
        return { left, top, width, height };
      });
      if ((showPrompt && selectionRects.length > 0) || forcePrompt) {
        const pos = positionPrompt({ left, top, width, height }, containerRect);
        setInputPos((prev) => {
          if (!pos) return null;
          if (prev && prev.left === pos.left && prev.top === pos.top)
            return prev;
          return pos;
        });
      }
    },
    [
      computeClampedRect,
      getContainer,
      positionPrompt,
      showPrompt,
      selectionRects.length,
    ]
  );

  const computeUnionRect = useCallback(
    (
      rects: Array<{ left: number; top: number; width: number; height: number }>
    ) => {
      if (!rects.length) return null;
      let left = Infinity,
        top = Infinity,
        right = -Infinity,
        bottom = -Infinity;
      rects.forEach((r) => {
        left = Math.min(left, r.left);
        top = Math.min(top, r.top);
        right = Math.max(right, r.left + r.width);
        bottom = Math.max(bottom, r.top + r.height);
      });
      return {
        left,
        top,
        width: Math.max(0, right - left),
        height: Math.max(0, bottom - top),
      };
    },
    []
  );

  const updateHoverForTarget = useCallback(
    (target: Element | null) => {
      if (!target || !(target instanceof HTMLElement)) {
        setHoverRect(null);
        return;
      }
      setFromTarget(target);
    },
    [setFromTarget]
  );

  const recalcOverlay = useCallback(() => {
    if (!allowSelection) {
      setHoverRect(null);
      setSelectionRects([]);
      setInputPos(null);
      return;
    }
    const container = getContainer();
    if (!container) return;

    // Recompute selection rects from accumulated elements
    const sRects: Array<{
      left: number;
      top: number;
      width: number;
      height: number;
    }> = [];
    selectedElsRef.current.forEach((el) => {
      if (!container.contains(el)) return;
      const r = computeClampedRect(el, container);
      if (r)
        sRects.push({
          left: r.left,
          top: r.top,
          width: r.width,
          height: r.height,
        });
    });
    setSelectionRects(sRects);
    if (sRects.length === 0) {
      const target = hoveredElRef.current;
      if (!target || !container.contains(target)) {
        setHoverRect(null);
        setInputPos(null);
        return;
      }
      setFromTarget(target);
    } else if (showPrompt) {
      const union = computeUnionRect(sRects);
      if (union)
        setInputPos(positionPrompt(union, container.getBoundingClientRect()));
    }
  }, [
    computeClampedRect,
    computeUnionRect,
    getContainer,
    positionPrompt,
    setFromTarget,
    showPrompt,
    allowSelection,
  ]);

  // Activates the editor by selecting a target element (or the hovered one) and opening the popover
  const activateEditor = useCallback(
    (seedEl?: HTMLElement) => {
      const container = getContainer();
      if (!container) return;
      const el = seedEl ?? hoveredElRef.current;
      if (!el || !container.contains(el)) return;
      // Prefer normalized "card/root"; if unavailable (e.g., container-sized), fall back to hovered or raw element
      const normalized =
        normalizeSelectableElement(el, container) ||
        (hoveredElRef.current && container.contains(hoveredElRef.current)
          ? hoveredElRef.current
          : null) ||
        el;
      if (!normalized || !container.contains(normalized)) return;
      selectedElsRef.current.clear();
      selectedElsRef.current.add(normalized);
      const sr: Array<{
        left: number;
        top: number;
        width: number;
        height: number;
      }> = [];
      const r = computeClampedRect(normalized, container);
      if (r)
        sr.push({ left: r.left, top: r.top, width: r.width, height: r.height });
      setSelectionRects(sr);
      setShowPrompt(true);
      const union = computeUnionRect(sr);
      if (union)
        setInputPos(positionPrompt(union, container.getBoundingClientRect()));
    },
    [
      getContainer,
      normalizeSelectableElement,
      computeClampedRect,
      computeUnionRect,
      positionPrompt,
    ]
  );
  useEffect(() => {
    const handleMouseOver = (e: Event) => {
      // if (!enableHtmlEditing) return;
      if (!allowSelection) return;
      if (showPrompt) return;

      const container = getContainer();
      if (!container) return;
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const overlay = t.closest(
        '[data-inspector-overlay="1"]'
      ) as HTMLElement | null;
      if (overlay) return;
      hoveredElRef.current = t;
      updateHoverForTarget(t);
    };
    const handleMouseLeave = (e: Event) => {
      if (!allowSelection) return;
      if (showPrompt) return;
      const container = getContainer();
      if (!container) return;
      const me = e as MouseEvent;
      // If moving from container to the AI button, don't clear hover (keep UI stable for click)
      const related = me.relatedTarget as Node | null;
      if (
        aiEditorButtonRef.current &&
        related &&
        (aiEditorButtonRef.current === related ||
          aiEditorButtonRef.current.contains(related))
      ) {
        return;
      }
      const t = me.target as HTMLElement | null;
      if (!t) {
        setHoverRect(null);
        return;
      }
      if (container === t || container.contains(t)) {
        setHoverRect(null);
      }
      hoveredElRef.current = null;
    };
    const handleClick = (e: Event) => {
      // if (!enableHtmlEditing) return;
      if (!allowSelection) return;
      const container = getContainer();
      if (!container) return;
      const me = e as MouseEvent;
      const t = me.target as HTMLElement | null;
      if (!t) return;
      if (!container.contains(t)) return;
      const overlay = t.closest(
        '[data-inspector-overlay="1"]'
      ) as HTMLElement | null;
      if (overlay) return;
      // If this is part of a double-click sequence, let dblclick handler process it
      if ((me.detail || 0) >= 2) {
        return;
      }
      // Allow normal editing: do NOT prevent default or stop propagation.
      // Hide any selection/prompt when clicking into the content.
      setShowPrompt(false);
      setPromptValue("");
      setHoverRect(null);
      selectedElsRef.current.clear();
      setSelectionRects([]);
      setInputPos(null);
    };

    const handleDoubleClick = (e: Event) => {
      if (!allowSelection) return;
      const container = getContainer();
      if (!container) return;
      const me = e as MouseEvent;
      const raw = me.target as Node | null;
      const t =
        raw instanceof HTMLElement
          ? raw
          : raw && ((raw as any).parentElement as HTMLElement | null);
      if (!t) return;
      if (!container.contains(t)) return;
      const overlay = t.closest(
        '[data-inspector-overlay="1"]'
      ) as HTMLElement | null;
      if (overlay) return;
      // Intercept default double-click (e.g., text selection) and open the AI editor
      me.preventDefault();
      me.stopPropagation();
      activateEditor(t);
    };

    const handleMouseDown = (e: any) => {
      // if (!enableHtmlEditing) return;
      if (!allowSelection) return;
      const me = e as MouseEvent;
      if (me.button !== 0) return; // left click only
      const container = getContainer();
      if (!container) return;
      const t = me.target as HTMLElement | null;
      if (!t || !container.contains(t)) return;
      if (t.closest('[data-inspector-overlay="1"]') as HTMLElement | null)
        return;
      // Do not intercept typing/editing; disable drag-selection to allow normal editing.
      return;
    };

    containerRef.current?.addEventListener("mouseover", handleMouseOver, true);
    containerRef.current?.addEventListener(
      "mouseleave",
      handleMouseLeave,
      true
    );
    containerRef.current?.addEventListener("click", handleClick, true);
    containerRef.current?.addEventListener("dblclick", handleDoubleClick, true);
    containerRef.current?.addEventListener("mousedown", handleMouseDown, true);

    return () => {
      containerRef.current?.removeEventListener(
        "mouseover",
        handleMouseOver,
        true
      );
      containerRef.current?.removeEventListener(
        "mouseleave",
        handleMouseLeave,
        true
      );
      containerRef.current?.removeEventListener("click", handleClick, true);
      containerRef.current?.removeEventListener(
        "dblclick",
        handleDoubleClick,
        true
      );
      containerRef.current?.removeEventListener(
        "mousedown",
        handleMouseDown,
        true
      );
    };
  }, [
    containerRef,
    getContainer,
    updateHoverForTarget,
    showPrompt,
    slide?.html,
    setFromTarget,
    computeClampedRect,
    positionPrompt,
    computeUnionRect,
    normalizeSelectableElement,
    activateEditor,
    allowSelection,
  ]);

  // Recalculate overlay position on scroll and resize (debounced via rAF)
  useEffect(() => {
    // if (!enableHtmlEditing) return;
    let rafPending = false;
    const handler = () => {
      if (rafPending) return;
      rafPending = true;
      requestAnimationFrame(() => {
        recalcOverlay();
        rafPending = false;
      });
    };
    window.addEventListener("scroll", handler, true);
    window.addEventListener("resize", handler);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowPrompt(false);
        setPromptValue("");
        setHoverRect(null);
        selectedElsRef.current.clear();
        setSelectionRects([]);
        setInputPos(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", handler, true);
      window.removeEventListener("resize", handler);
      window.removeEventListener("keydown", onKey);
    };
  }, [recalcOverlay]);

  const getSelectionHTMLElement = useCallback((): HTMLElement | null => {
    const container = getContainer();
    if (!container) return null;
    const selected = Array.from(selectedElsRef.current);
    if (selected.length === 0) return null;
    const wrapper = document.createElement("div");
    wrapper.setAttribute("data-multi-select", "1");
    selected.forEach((el) => {
      wrapper.appendChild(el.cloneNode(true));
    });
    return wrapper.childNodes.length > 0 ? wrapper : null;
  }, [getContainer]);

  // Produces a clean HTML snapshot without editor-only DOM (overlays, markers)
  const sanitizeSlideHtml = useCallback((node: HTMLElement): HTMLElement => {
    try {
      const clone = node.cloneNode(true) as HTMLElement;
      // Remove any inspector overlays/prompts/variant panels from the HTML snapshot
      clone.querySelectorAll('[data-inspector-overlay="1"]').forEach((el) => {
        el.parentElement?.removeChild(el);
      });
      clone.querySelectorAll(".editor-enabled").forEach((el) => {
        (el as HTMLElement).classList.remove("editor-enabled");
      });
      const unwrap = (el: Element) => {
        const parent = el.parentNode;
        if (!parent) return;
        while (el.firstChild) parent.insertBefore(el.firstChild, el);
        parent.removeChild(el);
      };

      clone.querySelectorAll('[data-editable-text="1"]').forEach((el) => {
        (el as HTMLElement).removeAttribute("data-editable-text");
        (el as HTMLElement).removeAttribute("contenteditable");
        (el as HTMLElement).removeAttribute("spellcheck");
        (el as HTMLElement).removeAttribute("data-prev-outline");
        (el as HTMLElement).removeAttribute("data-prev-boxshadow");
        (el as HTMLElement).removeAttribute("data-prev-bordercolor");
      });
      clone
        .querySelectorAll("[data-editable-processed], [data-editable-id]")
        .forEach((el) => {
          (el as HTMLElement).removeAttribute("data-editable-processed");
          (el as HTMLElement).removeAttribute("data-editable-id");
        });
      clone
        .querySelectorAll(
          ".html-text-replacer, .html-editable-wrapper, .html-editor"
        )
        .forEach((el) => unwrap(el));
      return clone;
    } catch (error) {
      console.log("error", error);
      return node;
    }
  }, []);

  // activateEditor is declared earlier

  const handleSubmitEdit = useCallback(async () => {
    try {
      if (promptValue.trim().length === 0) {
        toast.error("Please enter a prompt to edit the selection");
        return;
      }
      setUpdatingSelection(true);
      const container = getContainer();
      if (!container) return;
      const target = getSelectionHTMLElement();
      if (!target) return;
      const selectionHtml = target;
      const selectedHtml = sanitizeSlideHtml(
        selectionHtml as unknown as HTMLElement
      );
      const containerHtml = sanitizeSlideHtml(container);

      const params = {
        complete_code: containerHtml.innerHTML,
        section_code: selectedHtml.innerHTML,
        edit_prompt: promptValue,
        slide_id: slide.id,
      };

      // const response = await PresentationGenerationApi.EditSelectionHTML(params);

      setShowPrompt(false);
      // dispatch(updateSlideHtmlContentV1({ slideIndex: slide.index, html: response.html }));
      setUpdatingSelection(false);
      setPromptValue("");
      setHoverRect(null);
      selectedElsRef.current.clear();
      setSelectionRects([]);
      setInputPos(null);

      toast.success("Selection edited successfully", {
        description: "The selection has been edited successfully",
      });
    } catch (error: any) {
      setUpdatingSelection(false);
      console.error("error in editing selection HTML", error);
      toast.error("Error editing selection HTML", {
        description:
          error?.message || "The selection has not been edited successfully",
      });
    }
  }, [
    dispatch,
    getContainer,
    getSelectionHTMLElement,
    promptValue,
    sanitizeSlideHtml,
    slide?.index,
  ]);

  // if (!enableHtmlEditing) return null;

  const overlay = (
    <>
      {/* Hover overlay: visible when no selection is active. The AI button sits above the overlay to be clickable. */}
      {allowSelection && hoverRect && selectionRects.length === 0 && (
        <>
          {hoverRect.width > 50 && hoverRect.height > 50 && (
            <button
              data-inspector-overlay="1"
              ref={aiEditorButtonRef}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 cursor-auto rounded-md text-xs font-medium bg-white text-gray-900/90 backdrop-blur-sm shadow-sm ring-1 ring-gray-300/60 hover:bg-white/80 hover:shadow-md transition-colors"
              style={{
                position: "fixed",
                left: hoverRect.left + hoverRect.width - 8,
                top: Math.max(hoverRect.top + 8, 8),
                transform: "translateX(-100%)",
                zIndex: 41,
                cursor: "pointer",
                pointerEvents: "auto",
              }}
              onClick={(e) => {
                e.stopPropagation();
                activateEditor();
              }}
              aria-label="Open AI Editor"
              title="AI Edit"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>AI Edit</span>
            </button>
          )}
          <div
            data-inspector-overlay="1"
            style={{
              position: "fixed",
              left: hoverRect.left,
              top: hoverRect.top,
              width: hoverRect.width,
              height: hoverRect.height,
              maxWidth: "1280px",
              maxHeight: "720px",
              overflow: "hidden",
              border: "2px solid #3b82f6",
              boxShadow: "0 0 0 2px rgba(59,130,246,0.2)",
              backgroundColor: "rgba(59,130,246,0.1)",
              pointerEvents: "none", // critical: overlay must be non-interactive so the AI button is clickable
              cursor: "auto",
              zIndex: 40,
            }}
          />
          {/* Centered instructional text: simple text with icon, no background */}
          <div
            data-inspector-overlay="1"
            style={{
              position: "fixed",
              left: hoverRect.left,
              top: hoverRect.top,
              width: hoverRect.width,
              height: hoverRect.height,
              pointerEvents: "none",
              zIndex: 41,
            }}
          >
            {hoverRect.width > 250 && hoverRect.height > 100 && (
              <div className="w-full h-full flex items-center justify-center select-none">
                <div
                  data-inspector-overlay="1"
                  className="inline-flex items-center bg-white/80 rounded-md px-2 py-1 gap-2 text-xs font-medium text-gray-900"
                >
                  <Edit className="w-3.5 h-3.5 text-blue-600" />
                  <span>Double-click for AI edit</span>
                </div>
              </div>
            )}
          </div>
        </>
      )}
      {/* Accumulated selection overlays */}
      {allowSelection &&
        selectionRects.map((r, idx) => (
          <div
            key={`sel-${idx}`}
            data-inspector-overlay="1"
            style={{
              position: "fixed",
              left: r.left,
              top: r.top,
              width: r.width,
              height: r.height,
              border: "2px solid #3b82f6",
              boxShadow: "0 0 0 2px rgba(59,130,246,0.2)",
              backgroundColor: "rgba(59,130,246,0.08)",
              pointerEvents: "none", // non-interactive to allow normal editing clicks beneath
              zIndex: 40,
              cursor: "auto",
            }}
          />
        ))}

      {/* Popover: opens only via AI button; clicking content closes it to allow typing */}
      {showPrompt && inputPos && (
        <div
          data-inspector-overlay="1"
          className="shadow-2xl rounded-xl backdrop-blur-sm"
          style={{
            position: "fixed",
            left: inputPos.left + 20,
            top: inputPos.top,
            zIndex: 41,
            backgroundColor: "transparent",
          }}
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <div className="text-black rounded-xl p-4 w-[440px] shadow-xl bg-white ring-1 ring-gray-200 overflow-hidden">
            <div className="h-1 -mx-4 -mt-4 mb-3 bg-gradient-to-r from-blue-500 via-sky-500 to-cyan-400" />
            <div className="flex items-center gap-3">
              <p className="text-sm text-black font-syne font-semibold">
                Edit selection
              </p>
            </div>

            <div className="mt-1.5">
              <textarea
                rows={2}
                autoFocus
                value={promptValue}
                id="selection-editor-prompt"
                name="selection-editor-prompt"
                onChange={(e) => setPromptValue(e.target.value)}
                placeholder="Explain the changes you want to make to the selection eg. make the heading larger"
                className="w-full p-2 rounded-md border border-gray-200 bg-white text-black placeholder-gray-400 outline-none resize-y focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmitEdit();
                  }
                }}
              />
            </div>
            <div className=" mt-1 pt-1 flex justify-end gap-2">
              <button
                disabled={updatingSelection}
                onClick={() => {
                  setShowPrompt(false);
                  setPromptValue("");
                  setHoverRect(null);
                  selectedElsRef.current.clear();
                  setSelectionRects([]);
                  setInputPos(null);
                }}
                style={{ cursor: "pointer" }}
                className="px-4 py-1 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 "
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitEdit}
                style={{ cursor: "pointer" }}
                disabled={updatingSelection}
                className="px-4 py-1 rounded-md bg-[#1D4ED8] text-white hover:bg-[#4336c9] disabled:opacity-50 "
              >
                {updatingSelection ? "Updating..." : "Apply"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  return portalNode ? createPortal(overlay, portalNode) : null;
};

export default HtmlSelectionEditor;
