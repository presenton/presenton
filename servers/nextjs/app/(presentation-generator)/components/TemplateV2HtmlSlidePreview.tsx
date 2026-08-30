"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  loadChartBrowserRuntime,
  type ChartConfigurationLike as ChartConfiguration,
  type ChartInstanceLike as ChartInstance,
} from "@/lib/chart-browser";
import {
  hasTemplateV2RenderableUi,
  TEMPLATE_V2_HTML_HEIGHT,
  TEMPLATE_V2_HTML_WIDTH,
  templateV2UiToHtmlFragment,
} from "@/lib/template-v2-json-to-html";

type PresentonChartGlobalState = {
  status: "pending" | "ready" | "error";
  pending: number;
  rendered: number;
  message?: string;
};

declare global {
  interface Window {
    __PRESENTON_JSON_CHARTS__?: PresentonChartGlobalState;
  }
}

const useChartLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

function chartGlobalState(): PresentonChartGlobalState | null {
  if (typeof window === "undefined") return null;

  const existing = window.__PRESENTON_JSON_CHARTS__;
  if (existing) return existing;

  const state: PresentonChartGlobalState = {
    status: "ready",
    pending: 0,
    rendered: 0,
  };
  window.__PRESENTON_JSON_CHARTS__ = state;
  return state;
}

function markChartsPending(count: number): void {
  if (count <= 0) return;
  const state = chartGlobalState();
  if (!state) return;
  state.pending += count;
  state.status = "pending";
  delete state.message;
}

function markChartsReady(count: number): void {
  if (count <= 0) return;
  const state = chartGlobalState();
  if (!state || state.status === "error") return;
  state.pending = Math.max(0, state.pending - count);
  state.rendered += count;
  if (state.pending === 0) {
    state.status = "ready";
  }
}

function markChartsError(message: string): void {
  const state = chartGlobalState();
  if (!state) return;
  state.pending = 0;
  state.status = "error";
  state.message = message;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function readNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function chartValue(raw: unknown): number {
  if (typeof raw === "number") return raw;
  const record = readRecord(raw);
  const value = record.y ?? record.value ?? record.data;
  const numeric = readNumber(value);
  if (numeric != null) return numeric;
  const parsed = readNumber(raw);
  return parsed ?? 0;
}

function formatChartValue(value: number): string {
  if (!Number.isFinite(value)) return "";
  if (
    Math.abs(value) >= 1000 &&
    typeof Intl !== "undefined" &&
    Intl.NumberFormat
  ) {
    return Intl.NumberFormat("en", { notation: "compact" }).format(value);
  }
  return Math.abs(value) % 1 === 0
    ? String(value)
    : String(Math.round(value * 10) / 10).replace(/\.0$/, "");
}

function formatAxisTick(value: unknown): string {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? formatChartValue(numeric) : String(value);
}

function hydrateScales(scales: unknown): void {
  const scaleRecords = readRecord(scales);
  Object.values(scaleRecords).forEach((scaleValue) => {
    const scale = readRecord(scaleValue);
    const ticks = readRecord(scale.ticks);
    if (ticks.presentonFormat) {
      ticks.callback = formatAxisTick;
      delete ticks.presentonFormat;
    }

    const radial = readRecord(scale.r);
    const radialTicks = readRecord(radial.ticks);
    if (radialTicks.presentonFormat) {
      radialTicks.callback = formatAxisTick;
      delete radialTicks.presentonFormat;
    }
  });
}

function barBorderRadius(rawValue: unknown, horizontal: boolean, radius = 7) {
  const value = chartValue(rawValue);

  if (horizontal) {
    return value < 0
      ? {
          bottomLeft: radius,
          bottomRight: 0,
          topLeft: radius,
          topRight: 0,
        }
      : {
          bottomLeft: 0,
          bottomRight: radius,
          topLeft: 0,
          topRight: radius,
        };
  }

  return value < 0
    ? {
        bottomLeft: radius,
        bottomRight: radius,
        topLeft: 0,
        topRight: 0,
      }
    : {
        bottomLeft: 0,
        bottomRight: 0,
        topLeft: radius,
        topRight: radius,
      };
}

function hydrateBarBorderRadii(config: ChartConfiguration): void {
  const datasets = Array.isArray(config.data?.datasets)
    ? config.data.datasets
    : [];

  datasets.forEach((dataset) => {
    const record = dataset as {
      borderRadius?: unknown;
      presentonBarRadius?: unknown;
    };
    const options = readRecord(record.presentonBarRadius);
    if (!Object.keys(options).length) return;

    const horizontal = Boolean(options.horizontal);
    const radius = readNumber(options.radius) ?? 7;
    record.borderRadius = (context: { raw?: unknown }) =>
      barBorderRadius(context?.raw, horizontal, radius);
    delete record.presentonBarRadius;
  });
}

function hydrateDataLabels(config: ChartConfiguration): void {
  const plugins = config.options?.plugins as
    | Record<string, unknown>
    | undefined;
  const options = readRecord(plugins?.datalabels);
  if (!Object.keys(options).length) return;

  options.formatter = (value: unknown) => formatChartValue(chartValue(value));
  delete options.presentonOutsideColor;
  delete options.presentonPosition;
}

export function shouldRenderTemplateV2HtmlPreview(
  slide: unknown,
  presentationVersion?: unknown
): boolean {
  if (!slide || typeof slide !== "object") return false;
  const record = slide as Record<string, unknown>;
  const isTemplateV2Presentation = presentationVersion === "v2-standard";
  return (
    (isTemplateV2Presentation || hasTemplateV2RenderableUi(record.ui)) &&
    hasTemplateV2RenderableUi(record.ui)
  );
}

export function TemplateV2HtmlSlidePreview({
  slide,
  fonts,
  fixedSize = false,
  fitBounds,
  fitPadding,
  fitMaxScale,
  className = "",
  contentClassName = "",
}: {
  slide: unknown;
  fonts?: unknown;
  fixedSize?: boolean;
  fitBounds?: { left: number; top: number; right: number; bottom: number };
  fitPadding?: { x: number; y: number };
  fitMaxScale?: number;
  className?: string;
  contentClassName?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);


  const html = useMemo(() => {
    if (!slide || typeof slide !== "object") return null;
    return templateV2UiToHtmlFragment((slide as Record<string, unknown>).ui, {
      fonts,
    });
  }, [fonts, slide]);
  const htmlMarkup = useMemo(
    () => ({ __html: html ?? "" }),
    [html]
  );

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const updateWidth = () => setContainerWidth(element.clientWidth);
    updateWidth();

    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(element);
    return () => resizeObserver.disconnect();
  }, []);

  useChartLayoutEffect(() => {
    const element = contentRef.current;
    if (!element || !html) return;

    let disposed = false;
    const charts: ChartInstance[] = [];
    let completed = false;
    let registeredPendingCount = 0;

    const finishReady = () => {
      if (completed) return;
      completed = true;
      element.dataset.presentonCharts = "ready";
      markChartsReady(registeredPendingCount);
    };

    const finishError = (message: string) => {
      if (completed) return;
      completed = true;
      element.dataset.presentonCharts = "error";
      markChartsError(message);
    };

    const renderCharts = async () => {
      const canvases = Array.from(
        element.querySelectorAll<HTMLCanvasElement>("canvas[data-presenton-chart]")
      ).filter((canvas) => canvas.getAttribute("data-chart-config"));

      if (!canvases.length) {
        element.dataset.presentonCharts = "ready";
        return;
      }

      registeredPendingCount = canvases.length;
      element.dataset.presentonCharts = "pending";
      markChartsPending(registeredPendingCount);

      try {
        const { Chart } = await loadChartBrowserRuntime();
        if (disposed) return;

        canvases.forEach((canvas) => {
          const configText = canvas.getAttribute("data-chart-config");
          if (!configText) return;

          const existing = Chart.getChart(canvas);
          existing?.destroy();

          const config = JSON.parse(configText) as ChartConfiguration;
          config.options = {
            ...(config.options ?? {}),
            animation: false,
            responsive: false,
            maintainAspectRatio: false,
          };
          hydrateScales(
            config.options?.scales,
          );
          hydrateBarBorderRadii(config);
          hydrateDataLabels(config);

          const chart = new Chart(canvas, config);
          chart.update("none");
          canvas.dataset.presentonChartRendered = "true";
          charts.push(chart);
        });

        if (!disposed) finishReady();
      } catch (error) {
        if (disposed) return;
        const message = errorMessage(error);
        finishError(message);
        console.error("Failed to render template v2 charts:", error);
      }
    };

    void renderCharts();

    return () => {
      disposed = true;
      if (!completed) {
        markChartsReady(registeredPendingCount);
      }
      charts.forEach((chart) => chart.destroy());
    };
  }, [html]);

  const hasFitBounds = Boolean(
    !fixedSize &&
      fitBounds &&
      fitBounds.right > fitBounds.left &&
      fitBounds.bottom > fitBounds.top,
  );
  const naturalScale = fixedSize
    ? 1
    : containerWidth
      ? Math.min((containerWidth / TEMPLATE_V2_HTML_WIDTH) * 0.98, 1)
      : 0;
  const fittedViewport = useMemo(() => {
    if (!hasFitBounds || !fitBounds || !containerWidth) return null;

    const viewportHeight =
      (containerWidth * TEMPLATE_V2_HTML_HEIGHT) / TEMPLATE_V2_HTML_WIDTH;
    const paddingX = Math.max(0, Math.min(fitPadding?.x ?? 0.08, 0.4));
    const paddingY = Math.max(0, Math.min(fitPadding?.y ?? 0.1, 0.4));
    const contentWidth = fitBounds.right - fitBounds.left;
    const contentHeight = fitBounds.bottom - fitBounds.top;
    const scale = Math.min(
      (containerWidth * (1 - paddingX * 2)) / contentWidth,
      (viewportHeight * (1 - paddingY * 2)) / contentHeight,
      fitMaxScale ?? Number.POSITIVE_INFINITY,
    );

    return {
      height: viewportHeight,
      offsetX:
        (containerWidth - contentWidth * scale) / 2 - fitBounds.left * scale,
      offsetY:
        (viewportHeight - contentHeight * scale) / 2 - fitBounds.top * scale,
      scale,
    };
  }, [
    containerWidth,
    fitBounds,
    fitMaxScale,
    fitPadding?.x,
    fitPadding?.y,
    hasFitBounds,
  ]);
  const renderScale = fittedViewport?.scale ?? naturalScale;
  const previewHeight =
    fittedViewport?.height ?? TEMPLATE_V2_HTML_HEIGHT * (naturalScale || 1);

  if (!html) {
    return (
      <div
        ref={containerRef}
        className={`relative flex aspect-video w-full items-center justify-center bg-white text-xs text-gray-500 ${className}`}
        style={
          fixedSize
            ? {
              width: TEMPLATE_V2_HTML_WIDTH,
              height: TEMPLATE_V2_HTML_HEIGHT,
            }
            : undefined
        }
      >
        Preview unavailable
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden bg-white ${className}`}
      style={
        fixedSize
          ? {
            width: TEMPLATE_V2_HTML_WIDTH,
            height: TEMPLATE_V2_HTML_HEIGHT,
          }
          : {
            height: renderScale ? previewHeight : undefined,
            aspectRatio: renderScale ? undefined : "16 / 9",
          }
      }
    >
      <div
        className={
          fixedSize || fittedViewport
            ? "absolute left-0 top-0"
            : "absolute left-1/2 top-0"
        }
        style={{
          width: TEMPLATE_V2_HTML_WIDTH,
          height: TEMPLATE_V2_HTML_HEIGHT,
          transform: fixedSize
            ? undefined
            : fittedViewport
              ? `translate(${fittedViewport.offsetX}px, ${fittedViewport.offsetY}px) scale(${fittedViewport.scale})`
              : `translateX(-50%) scale(${naturalScale || 1})`,
          transformOrigin:
            fixedSize || fittedViewport ? "top left" : "top center",
          opacity: renderScale ? 1 : 0,
        }}
      >
        <div
          ref={contentRef}
          aria-label="Template v2 slide preview"
          className={`block h-full w-full bg-white ${contentClassName}`}
          style={{ pointerEvents: "none" }}
          dangerouslySetInnerHTML={htmlMarkup}
        />
      </div>
    </div>
  );
}
