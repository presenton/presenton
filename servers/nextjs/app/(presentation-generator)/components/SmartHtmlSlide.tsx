"use client";

import DOMPurify, { type Config as DOMPurifyConfig } from "dompurify";
import { useEffect, useRef, useState } from "react";

import { useTailwindRuntimeReady } from "@/components/runtime/TailwindBrowserRuntime";
import {
  localFontOptionsFromUnknown,
  renderLocalFontFaceCss,
} from "@/components/slide-editor/text/local-fonts";
import {
  CHART_BROWSER_SCRIPT_URL,
  CHART_DATALABELS_SCRIPT_URL,
} from "@/lib/chart-browser";
import { TAILWIND_BROWSER_SCRIPT_URL } from "@/lib/tailwind-browser";
import { applySmartSlideIconColors } from "@/lib/smart-slide-icons";
import { useSmartChartInjection } from "./useSmartChartInjection";
import SlidePreviewLoader from "./SlidePreviewLoader";

const SLIDE_WIDTH = 1280;
const SLIDE_HEIGHT = 720;
const USE_LINUX_IN_PAGE_RENDERER =
  process.env.NEXT_PUBLIC_PRESENTON_ELECTRON_PLATFORM === "linux";

const SANITIZE_CONFIG: DOMPurifyConfig = {
  USE_PROFILES: { html: true, svg: true, svgFilters: true },
  FORBID_TAGS: [
    "base",
    "embed",
    "form",
    "iframe",
    "link",
    "meta",
    "object",
    "script",
    "style",
  ],
  FORBID_ATTR: ["autofocus", "contenteditable", "srcdoc"],
  ALLOW_DATA_ATTR: true,
};

function fontAssets(fonts: unknown) {
  const css = localFontOptionsFromUnknown(fonts)
    .map(renderLocalFontFaceCss)
    .join("");
  return css ? `<style>${css.replaceAll("</style", "<\\/style")}</style>` : "";
}

function previewDocument(html: string, fonts: unknown) {
  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=1280, initial-scale=1">
      ${fontAssets(fonts)}
      <script src="${TAILWIND_BROWSER_SCRIPT_URL}"></script>
      <script src="${CHART_BROWSER_SCRIPT_URL}"></script>
      <script src="${CHART_DATALABELS_SCRIPT_URL}"></script>
      <script>
        if (window.Chart && window.ChartDataLabels) {
          window.Chart.register(window.ChartDataLabels);
        }
      </script>
      <style>
        html,body{width:1280px;height:720px;min-width:1280px;min-height:720px;margin:0;overflow:hidden;background:#fff}
        *{box-sizing:border-box}
      </style>
    </head>
    <body>${html}</body>
  </html>`;
}

function useSlideFontAssets(fonts: unknown, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const css = localFontOptionsFromUnknown(fonts)
      .map(renderLocalFontFaceCss)
      .join("");
    if (!css) return;

    const style = document.createElement("style");
    style.dataset.slideFontAssets = "true";
    style.textContent = css;
    document.head.appendChild(style);
    return () => style.remove();
  }, [enabled, fonts]);
}

function LinuxInPageSmartHtmlSlide({
  html,
  fonts,
  fixedSize,
  title,
  executeScripts,
  showLoader,
  loaderLabel,
}: {
  html: string;
  fonts?: unknown;
  fixedSize: boolean;
  title: string;
  executeScripts: boolean;
  showLoader: boolean;
  loaderLabel?: string;
}) {
  const tailwindReady = useTailwindRuntimeReady();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const slideRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const [instanceId] = useState(
    () => `smart-slide-preview-${Math.random().toString(36).slice(2)}`
  );
  const [sanitizedHtml, setSanitizedHtml] = useState("");
  const [loadedHtml, setLoadedHtml] = useState<string | null>(null);

  useEffect(() => {
    const template = document.createElement("template");
    template.innerHTML = html;
    applySmartSlideIconColors(template.content, window.location.href);
    setSanitizedHtml(DOMPurify.sanitize(template.innerHTML, SANITIZE_CONFIG));
  }, [html]);

  useSlideFontAssets(fonts, executeScripts);
  useSmartChartInjection({
    html: executeScripts && tailwindReady && sanitizedHtml ? html : "",
    instanceId,
    domRevision: sanitizedHtml,
    containerRef: slideRef,
  });

  useEffect(() => {
    const root = slideRef.current;
    if (!showLoader || !root || !sanitizedHtml || !tailwindReady) return;

    let cancelled = false;
    let frame: number | undefined;
    const cleanups: Array<() => void> = [];
    const images = Array.from(root.querySelectorAll("img"));
    const pendingImages = images.map((image) => {
      if (image.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        const done = () => resolve();
        image.addEventListener("load", done, { once: true });
        image.addEventListener("error", done, { once: true });
        cleanups.push(() => {
          image.removeEventListener("load", done);
          image.removeEventListener("error", done);
        });
      });
    });
    void Promise.all([...pendingImages, document.fonts.ready]).then(() => {
      if (cancelled) return;
      frame = window.requestAnimationFrame(() => setLoadedHtml(sanitizedHtml));
    });

    return () => {
      cancelled = true;
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [sanitizedHtml, showLoader, tailwindReady]);

  useEffect(() => {
    if (fixedSize) return;
    const element = containerRef.current;
    if (!element) return;
    const update = () => setWidth(element.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [fixedSize]);

  const scale = fixedSize ? 1 : width ? Math.min(width / SLIDE_WIDTH, 1) : 0;
  const isLoading = !tailwindReady || !sanitizedHtml || loadedHtml !== sanitizedHtml;

  return (
    <div
      ref={containerRef}
      aria-busy={showLoader ? isLoading : undefined}
      className="relative w-full overflow-hidden bg-white"
      style={{
        width: fixedSize ? SLIDE_WIDTH : undefined,
        height: fixedSize ? SLIDE_HEIGHT : SLIDE_HEIGHT * (scale || 1),
      }}
    >
      {showLoader && isLoading && <SlidePreviewLoader label={loaderLabel} />}
      <div
        ref={slideRef}
        data-smart-slide-instance={instanceId}
        data-tailwind-runtime-scope
        className="pointer-events-none absolute left-1/2 top-0 h-[720px] w-[1280px] select-none overflow-hidden bg-white"
        aria-label={title}
        style={{
          transform: `translateX(-50%) scale(${scale || 1})`,
          transformOrigin: "top center",
          opacity: scale ? 1 : 0,
        }}
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      />
    </div>
  );
}

function IframeSmartHtmlSlide({
  html,
  fonts,
  fixedSize,
  title,
  showLoader,
  loaderLabel,
}: {
  html: string;
  fonts?: unknown;
  fixedSize: boolean;
  title: string;
  showLoader: boolean;
  loaderLabel?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const [srcDoc, setSrcDoc] = useState("");
  const [loadedSrcDoc, setLoadedSrcDoc] = useState<string | null>(null);

  useEffect(() => {
    const document = new DOMParser().parseFromString(
      previewDocument(html, fonts),
      "text/html",
    );
    applySmartSlideIconColors(document, window.location.href);
    setSrcDoc(`<!doctype html>${document.documentElement.outerHTML}`);
  }, [fonts, html]);

  useEffect(() => {
    if (fixedSize) return;
    const element = containerRef.current;
    if (!element) return;
    const update = () => setWidth(element.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [fixedSize]);

  const scale = fixedSize ? 1 : width ? Math.min(width / SLIDE_WIDTH, 1) : 0;
  const isLoading = !srcDoc || loadedSrcDoc !== srcDoc;

  return (
    <div
      ref={containerRef}
      aria-busy={showLoader ? isLoading : undefined}
      className="relative w-full overflow-hidden bg-white"
      style={{
        width: fixedSize ? SLIDE_WIDTH : undefined,
        height: fixedSize ? SLIDE_HEIGHT : SLIDE_HEIGHT * (scale || 1),
      }}
    >
      {showLoader && isLoading && <SlidePreviewLoader label={loaderLabel} />}
      <div
        className="absolute left-1/2 top-0"
        style={{
          width: SLIDE_WIDTH,
          height: SLIDE_HEIGHT,
          transform: `translateX(-50%) scale(${scale || 1})`,
          transformOrigin: "top center",
          opacity: scale ? 1 : 0,
        }}
      >
        {srcDoc && (
          <iframe
            key={srcDoc}
            className="block h-[720px] w-[1280px] border-0 bg-white"
            sandbox="allow-scripts"
            srcDoc={srcDoc}
            tabIndex={-1}
            title={title}
            onLoad={() => setLoadedSrcDoc(srcDoc)}
          />
        )}
      </div>
    </div>
  );
}

export default function SmartHtmlSlide({
  html,
  fonts,
  fixedSize = false,
  title = "Smart presentation slide",
  executeScripts = true,
  showLoader = false,
  loaderLabel,
}: {
  html: string;
  fonts?: unknown;
  fixedSize?: boolean;
  title?: string;
  executeScripts?: boolean;
  showLoader?: boolean;
  loaderLabel?: string;
}) {
  if (USE_LINUX_IN_PAGE_RENDERER) {
    return (
      <LinuxInPageSmartHtmlSlide
        key={showLoader ? html : undefined}
        fixedSize={fixedSize}
        fonts={fonts}
        html={html}
        title={title}
        executeScripts={executeScripts}
        showLoader={showLoader}
        loaderLabel={loaderLabel}
      />
    );
  }

  return (
    <IframeSmartHtmlSlide
      key={showLoader ? html : undefined}
      fixedSize={fixedSize}
      fonts={fonts}
      html={html}
      title={title}
      showLoader={showLoader}
      loaderLabel={loaderLabel}
    />
  );
}
