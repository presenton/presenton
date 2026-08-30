"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useDispatch, useSelector } from "react-redux";

import IconsEditor from "@/components/slide-editor/images/IconsEditor";
import { useTailwindRuntimeReady } from "@/components/runtime/TailwindBrowserRuntime";
import {
  clearChatHtmlSelection,
  setChatHtmlSelection,
  updateSlideHtmlContent,
} from "@/store/slices/presentationGeneration";
import type { RootState } from "@/store/store";
import { MixpanelEvent, trackEvent } from "@/utils/mixpanel";
import ImageEditor from "./ImageEditor";
import SmartHtmlSelectionOverlay, {
  type SmartSelectionRect,
} from "./SmartHtmlSelectionOverlay";
import SmartHtmlSlide from "./SmartHtmlSlide";
import { useSmartChartInjection } from "./useSmartChartInjection";

type ActiveMedia = {
  element: HTMLImageElement;
  kind: "icon" | "image";
  query: string;
};

const RECT_POSITION_EPSILON = 0.25;

function selectionRectsMatch(
  current: SmartSelectionRect | null,
  next: SmartSelectionRect | null,
) {
  if (current === next) return true;
  if (!current || !next) return false;
  return (
    Math.abs(current.left - next.left) < RECT_POSITION_EPSILON &&
    Math.abs(current.top - next.top) < RECT_POSITION_EPSILON &&
    Math.abs(current.width - next.width) < RECT_POSITION_EPSILON &&
    Math.abs(current.height - next.height) < RECT_POSITION_EPSILON
  );
}

const EXCLUDED_TEXT_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "IFRAME",
  "OBJECT",
  "EMBED",
  "SVG",
  "IMG",
  "VIDEO",
  "AUDIO",
  "CANVAS",
]);

const INLINE_TEXT_TAGS = new Set([
  "B",
  "STRONG",
  "I",
  "EM",
  "SPAN",
  "U",
  "A",
  "SMALL",
  "SUB",
  "SUP",
  "S",
  "MARK",
  "CODE",
  "KBD",
  "VAR",
  "ABBR",
  "CITE",
  "Q",
  "TIME",
  "BR",
  "WBR",
]);

export default function SmartHtmlEditor({
  slide,
  renderIndex,
  fonts,
  title,
}: {
  slide: {
    id?: string | null;
    index?: number;
    html_content?: string | null;
  };
  renderIndex?: number;
  fonts?: unknown;
  title: string;
}) {
  const dispatch = useDispatch();
  const { enableHtmlSelector, chatHtmlSelection } = useSelector(
    (state: RootState) => state.presentationGeneration
  );
  const tailwindReady = useTailwindRuntimeReady();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dirtyRef = useRef(false);
  const html = slide.html_content?.trim() ?? "";
  const [instanceId] = useState(
    () =>
      `${slide.id ?? "smart-slide"}-${Math.random()
        .toString(36)
        .slice(2)}`
  );
  const [activeMedia, setActiveMedia] = useState<ActiveMedia | null>(null);
  const hoveredElementRef = useRef<HTMLElement | null>(null);
  const selectedElementRef = useRef<HTMLElement | null>(null);
  const [hoverRect, setHoverRect] = useState<SmartSelectionRect | null>(null);
  const [selectionRect, setSelectionRect] =
    useState<SmartSelectionRect | null>(null);

  const slideIndex = Number.isFinite(Number(renderIndex))
    ? Number(renderIndex)
    : Number.isFinite(Number(slide.index))
      ? Number(slide.index)
      : 0;

  const elementRect = useCallback(
    (element: HTMLElement): SmartSelectionRect | null => {
      const container = containerRef.current;
      if (!container || !container.contains(element)) return null;
      const elementBox = element.getBoundingClientRect();
      const containerBox = container.getBoundingClientRect();
      const left = Math.max(elementBox.left, containerBox.left);
      const top = Math.max(elementBox.top, containerBox.top);
      const right = Math.min(elementBox.right, containerBox.right);
      const bottom = Math.min(elementBox.bottom, containerBox.bottom);
      if (right <= left || bottom <= top) return null;
      return { left, top, width: right - left, height: bottom - top };
    },
    []
  );

  const normalizeSelectableElement = useCallback(
    (target: HTMLElement): HTMLElement | null => {
      const container = containerRef.current;
      if (!container || !container.contains(target)) return null;
      if (target.closest("script, style, noscript")) return null;

      const explicitRoot = target.closest<HTMLElement>(
        "[data-select-root], [data-card], .card"
      );
      let element =
        explicitRoot && container.contains(explicitRoot) ? explicitRoot : target;
      if (element.dataset.smartTextWrapper === "1" && element.parentElement) {
        element = element.parentElement;
      }
      if (element === container || element.tagName === "SECTION") return null;

      const elementBox = element.getBoundingClientRect();
      const containerBox = container.getBoundingClientRect();
      if (
        elementBox.width >= containerBox.width * 0.98 &&
        elementBox.height >= containerBox.height * 0.98
      ) {
        return null;
      }
      return element;
    },
    []
  );

  const cleanSelectedHtml = useCallback((element: HTMLElement) => {
    const clone = element.cloneNode(true) as HTMLElement;
    const unwrap = (node: Element) => {
      const parent = node.parentNode;
      if (!parent) return;
      while (node.firstChild) parent.insertBefore(node.firstChild, node);
      parent.removeChild(node);
    };
    clone
      .querySelectorAll<HTMLElement>("[data-smart-text-wrapper='1']")
      .forEach(unwrap);
    [clone, ...Array.from(clone.querySelectorAll<HTMLElement>("*"))].forEach(
      (node) => {
        node.removeAttribute("data-editable-text");
        node.removeAttribute("data-smart-text-wrapper");
        node.removeAttribute("data-smart-editable-media");
        node.removeAttribute("contenteditable");
        node.removeAttribute("spellcheck");
      }
    );
    return clone.outerHTML.trim();
  }, []);

  const saveHtml = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const clone = container.cloneNode(true) as HTMLElement;
    const unwrap = (element: Element) => {
      const parent = element.parentNode;
      if (!parent) return;
      while (element.firstChild) parent.insertBefore(element.firstChild, element);
      parent.removeChild(element);
    };

    clone.querySelectorAll('[data-smart-text-wrapper="1"]').forEach(unwrap);
    clone.querySelectorAll<HTMLElement>('[data-editable-text="1"]').forEach((element) => {
      element.removeAttribute("data-editable-text");
      element.removeAttribute("data-smart-text-wrapper");
      element.removeAttribute("contenteditable");
      element.removeAttribute("spellcheck");
    });
    clone
      .querySelectorAll<HTMLElement>("[data-smart-editable-media]")
      .forEach((element) => element.removeAttribute("data-smart-editable-media"));

    const nextHtml = clone.innerHTML.trim();
    dirtyRef.current = false;
    if (!nextHtml || nextHtml === html) return;

    dispatch(
      updateSlideHtmlContent({
        slideIndex: slide.index ?? 0,
        slideId: slide.id,
        html: nextHtml,
      })
    );
  }, [dispatch, html, slide.id, slide.index]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !tailwindReady) return;
    container.innerHTML = html;
    dirtyRef.current = false;

    const cleanups: Array<() => void> = [];
    const markEditable = (element: HTMLElement, isWrapper = false) => {
      if (element.closest('[data-editable-text="1"]')) return;
      element.setAttribute("data-editable-text", "1");
      if (isWrapper) element.setAttribute("data-smart-text-wrapper", "1");
      element.setAttribute("contenteditable", "true");
      element.setAttribute("spellcheck", "false");

      const markDirty = () => {
        dirtyRef.current = true;
      };
      const handleBlur = () => {
        if (dirtyRef.current) saveHtml();
      };
      element.addEventListener("input", markDirty);
      element.addEventListener("cut", markDirty);
      element.addEventListener("paste", markDirty);
      element.addEventListener("drop", markDirty);
      element.addEventListener("blur", handleBlur);
      cleanups.push(() => {
        element.removeEventListener("input", markDirty);
        element.removeEventListener("cut", markDirty);
        element.removeEventListener("paste", markDirty);
        element.removeEventListener("drop", markDirty);
        element.removeEventListener("blur", handleBlur);
      });
    };

    const allElements = Array.from(
      container.querySelectorAll<HTMLElement>("*")
    );
    allElements.forEach((element) => {
      if (EXCLUDED_TEXT_TAGS.has(element.tagName)) return;
      const text = element.textContent?.replace(/\s+/g, " ").trim();
      if (!text) return;
      const descendants = Array.from(element.querySelectorAll<HTMLElement>("*"));
      if (
        descendants.length > 0 &&
        descendants.every((descendant) => INLINE_TEXT_TAGS.has(descendant.tagName))
      ) {
        markEditable(element);
      }
    });
    allElements.forEach((element) => {
      if (
        EXCLUDED_TEXT_TAGS.has(element.tagName) ||
        element.children.length > 0 ||
        element.closest('[data-editable-text="1"]')
      ) {
        return;
      }
      if (element.textContent?.replace(/\s+/g, " ").trim()) markEditable(element);
    });
    allElements.forEach((element) => {
      if (
        EXCLUDED_TEXT_TAGS.has(element.tagName) ||
        element.closest('[data-editable-text="1"]')
      ) {
        return;
      }
      Array.from(element.childNodes).forEach((node) => {
        if (
          node.nodeType !== Node.TEXT_NODE ||
          !node.textContent?.replace(/\s+/g, " ").trim()
        ) {
          return;
        }
        const wrapper = document.createElement("span");
        wrapper.textContent = node.textContent;
        element.replaceChild(wrapper, node);
        markEditable(wrapper, true);
      });
    });

    container.querySelectorAll<HTMLImageElement>("img").forEach((image) => {
      if (!image.getAttribute("src")) return;
      image.setAttribute("data-smart-editable-media", "true");
      const handleClick = (event: MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        const isIcon =
          image.getAttribute("image-type") === "icon" ||
          image.src.includes(".svg") ||
          image.alt.toLowerCase().includes("icon");
        setActiveMedia({
          element: image,
          kind: isIcon ? "icon" : "image",
          query:
            image.getAttribute(isIcon ? "query" : "prompt")?.trim() ?? "",
        });
      };
      image.addEventListener("click", handleClick);
      cleanups.push(() => image.removeEventListener("click", handleClick));
    });

    return () => {
      cleanups.forEach((cleanup) => cleanup());
      if (dirtyRef.current) saveHtml();
    };
  }, [html, saveHtml, tailwindReady]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !tailwindReady || !enableHtmlSelector) {
      hoveredElementRef.current = null;
      selectedElementRef.current = null;
      setHoverRect(null);
      setSelectionRect(null);
      return;
    }

    const refreshRects = () => {
      const selected = selectedElementRef.current;
      const hovered =
        hoveredElementRef.current === selected
          ? null
          : hoveredElementRef.current;
      const nextHoverRect = hovered ? elementRect(hovered) : null;
      const nextSelectionRect = selected ? elementRect(selected) : null;
      setHoverRect((current) =>
        selectionRectsMatch(current, nextHoverRect) ? current : nextHoverRect
      );
      setSelectionRect((current) =>
        selectionRectsMatch(current, nextSelectionRect)
          ? current
          : nextSelectionRect
      );
    };
    const handleMouseOver = (event: MouseEvent) => {
      const target =
        event.target instanceof HTMLElement
          ? normalizeSelectableElement(event.target)
          : null;
      hoveredElementRef.current = target;
      if (target === selectedElementRef.current) {
        setHoverRect(null);
        return;
      }
      setHoverRect(target ? elementRect(target) : null);
    };
    const handleMouseLeave = () => {
      hoveredElementRef.current = null;
      setHoverRect(null);
    };
    const handleClick = (event: MouseEvent) => {
      if (!(event.target instanceof HTMLElement)) return;
      const target = normalizeSelectableElement(event.target);
      if (!target) return;

      event.preventDefault();
      event.stopPropagation();

      const selectionBelongsToSlide =
        chatHtmlSelection?.slideIndex === slideIndex &&
        (!chatHtmlSelection.slideId ||
          !slide.id ||
          chatHtmlSelection.slideId === slide.id);
      if (selectionBelongsToSlide && selectedElementRef.current === target) {
        selectedElementRef.current = null;
        setSelectionRect(null);
        dispatch(clearChatHtmlSelection());
        return;
      }

      const selectedHtml = cleanSelectedHtml(target);
      if (!selectedHtml) return;
      selectedElementRef.current = target;
      setHoverRect(null);
      setSelectionRect(elementRect(target));
      dispatch(
        setChatHtmlSelection({
          slideId: slide.id ?? null,
          slideIndex,
          slideNumber: slideIndex + 1,
          html: selectedHtml,
          elementTag: target.tagName.toLowerCase(),
          selectedText:
            target.textContent?.replace(/\s+/g, " ").trim().slice(0, 240) ??
            "",
          selectedAt: Date.now(),
        })
      );
      trackEvent(MixpanelEvent.Smart_Mode_Element_Selected, {
        slide_id: slide.id ?? null,
        slide_index: slideIndex,
        element_tag: target.tagName.toLowerCase(),
        has_text: Boolean(target.textContent?.trim()),
        selected_text_char_count:
          target.textContent?.replace(/\s+/g, " ").trim().length ?? 0,
      });
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      selectedElementRef.current = null;
      setSelectionRect(null);
      dispatch(clearChatHtmlSelection());
    };

    container.addEventListener("mouseover", handleMouseOver, true);
    container.addEventListener("mouseleave", handleMouseLeave, true);
    container.addEventListener("click", handleClick, true);
    window.addEventListener("scroll", refreshRects, true);
    window.addEventListener("resize", refreshRects);
    window.addEventListener("keydown", handleKeyDown);

    // The assistant panel changes the slide's position and scale without
    // always emitting a window resize. Track the live DOM bounds so fixed
    // overlays remain attached throughout those layout transitions.
    let animationFrameId = 0;
    const trackLiveRects = () => {
      refreshRects();
      animationFrameId = window.requestAnimationFrame(trackLiveRects);
    };
    animationFrameId = window.requestAnimationFrame(trackLiveRects);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      container.removeEventListener("mouseover", handleMouseOver, true);
      container.removeEventListener("mouseleave", handleMouseLeave, true);
      container.removeEventListener("click", handleClick, true);
      window.removeEventListener("scroll", refreshRects, true);
      window.removeEventListener("resize", refreshRects);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    chatHtmlSelection,
    cleanSelectedHtml,
    dispatch,
    elementRect,
    enableHtmlSelector,
    normalizeSelectableElement,
    slide.id,
    slideIndex,
    tailwindReady,
  ]);

  useEffect(() => {
    const selectionBelongsToSlide =
      chatHtmlSelection?.slideIndex === slideIndex &&
      (!chatHtmlSelection.slideId ||
        !slide.id ||
        chatHtmlSelection.slideId === slide.id);
    if (selectionBelongsToSlide) return;
    selectedElementRef.current = null;
    setSelectionRect(null);
  }, [chatHtmlSelection, slide.id, slideIndex]);

  useEffect(() => {
    if (!tailwindReady || !fonts || typeof fonts !== "object" || Array.isArray(fonts)) {
      return;
    }

    const assets: HTMLElement[] = [];
    Object.entries(fonts as Record<string, unknown>).forEach(([family, source]) => {
      if (typeof source !== "string" || !source.trim()) return;
      if (source.includes("fonts.googleapis.com") || source.endsWith(".css")) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = source;
        document.head.appendChild(link);
        assets.push(link);
        return;
      }
      const style = document.createElement("style");
      const safeFamily = family.replaceAll("'", "\\'");
      const safeSource = source.replaceAll("'", "\\'");
      style.textContent = `@font-face{font-family:'${safeFamily}';src:url('${safeSource}');font-display:swap}`;
      document.head.appendChild(style);
      assets.push(style);
    });
    return () => assets.forEach((asset) => asset.remove());
  }, [fonts, tailwindReady]);

  useSmartChartInjection({
    html: tailwindReady ? html : "",
    instanceId,
    domRevision: `${slide.index ?? "none"}:${slideIndex}`,
    containerRef,
  });

  const replaceMedia = (url: string, query?: string) => {
    if (!activeMedia) return;
    activeMedia.element.src = url;
    if (query) {
      activeMedia.element.setAttribute(
        activeMedia.kind === "icon" ? "query" : "prompt",
        query
      );
    }
    dirtyRef.current = true;
    setActiveMedia(null);
    window.setTimeout(saveHtml, 0);
  };

  if (!tailwindReady) {
    return <SmartHtmlSlide fixedSize fonts={fonts} html={html} title={title} />;
  }

  return (
    <>
      <div
        ref={containerRef}
        data-smart-slide-instance={instanceId}
        data-smart-selecting={enableHtmlSelector ? "true" : undefined}
        className="smart-html-editor relative h-full w-full overflow-hidden bg-white"
        aria-label={title}
      />
      <style jsx global>{`
        .smart-html-editor [contenteditable="true"] {
          cursor: text;
          user-select: text;
          -webkit-user-select: text;
        }
        .smart-html-editor [contenteditable="true"]:focus {
          outline: none;
        }
        .smart-html-editor [data-smart-editable-media="true"] {
          cursor: pointer;
          transition: opacity 160ms ease;
        }
        .smart-html-editor [data-smart-editable-media="true"]:hover {
          opacity: 0.86;
        }
        .smart-html-editor[data-smart-selecting="true"],
        .smart-html-editor[data-smart-selecting="true"] * {
          cursor: crosshair !important;
        }
      `}</style>
      {enableHtmlSelector &&
        typeof document !== "undefined" &&
        createPortal(
          <SmartHtmlSelectionOverlay
            hoverRect={hoverRect}
            selectionRect={selectionRect}
          />,
          document.body
        )}
      {activeMedia?.kind === "image" && (
        <ImageEditor
          initialImage={activeMedia.element.src}
          slideIndex={slide.index ?? 0}
          promptContent={activeMedia.query}
          onClose={() => setActiveMedia(null)}
          onImageChange={replaceMedia}
        />
      )}
      {activeMedia?.kind === "icon" && (
        <IconsEditor
          currentIconUrl={activeMedia.element.src}
          icon_prompt={activeMedia.query ? [activeMedia.query] : []}
          onClose={() => setActiveMedia(null)}
          onIconChange={replaceMedia}
        />
      )}
    </>
  );
}
