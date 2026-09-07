"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// Bundled-шрифты апстрима: локальные @font-face для превью слайдов.
// Electron/Linux in-page renderer и chart-скрипты удалены нашим P12 (2fb34e93) — графики
// рендерятся скриптами, которые сам template-v2-json-to-html встраивает в HTML слайда.
import {
  localFontOptionsFromUnknown,
  renderLocalFontFaceCss,
} from "@/components/slide-editor/text/local-fonts";

const SLIDE_WIDTH = 1280;
const SLIDE_HEIGHT = 720;

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
      <style>
        html,body{width:1280px;height:720px;min-width:1280px;min-height:720px;margin:0;overflow:hidden;background:#fff}
        *{box-sizing:border-box}
      </style>
    </head>
    <body>${html}</body>
  </html>`;
}

function IframeSmartHtmlSlide({
  html,
  fonts,
  fixedSize,
  title,
}: {
  html: string;
  fonts?: unknown;
  fixedSize: boolean;
  title: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const srcDoc = useMemo(() => previewDocument(html, fonts), [fonts, html]);

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

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden bg-white"
      style={{
        width: fixedSize ? SLIDE_WIDTH : undefined,
        height: fixedSize ? SLIDE_HEIGHT : SLIDE_HEIGHT * (scale || 1),
      }}
    >
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
        <iframe
          className="block h-[720px] w-[1280px] border-0 bg-white"
          sandbox="allow-scripts"
          srcDoc={srcDoc}
          tabIndex={-1}
          title={title}
        />
      </div>
    </div>
  );
}

export default function SmartHtmlSlide({
  html,
  fonts,
  fixedSize = false,
  title = "Smart presentation slide",
}: {
  html: string;
  fonts?: unknown;
  fixedSize?: boolean;
  title?: string;
}) {
  return (
    <IframeSmartHtmlSlide
      fixedSize={fixedSize}
      fonts={fonts}
      html={html}
      title={title}
    />
  );
}
