export const CHART_BROWSER_SCRIPT_URL = "/vendor/chart-4.5.1.umd.min.js";
export const CHART_DATALABELS_SCRIPT_URL =
  "/vendor/chartjs-plugin-datalabels-2.2.0.min.js";

export type ChartDatasetLike = {
  backgroundColor?: unknown;
  data?: unknown;
  [key: string]: unknown;
};

export type ChartConfigurationLike = {
  data?: {
    datasets?: ChartDatasetLike[];
    labels?: unknown;
    [key: string]: unknown;
  };
  options?: Record<string, unknown>;
  plugins?: unknown[];
  type?: unknown;
};

export type ChartInstanceLike = {
  destroy(): void;
  update(mode?: string): void;
};

export type ChartConstructorLike = {
  new (
    item: HTMLCanvasElement,
    config: ChartConfigurationLike,
  ): ChartInstanceLike;
  getChart(item: HTMLCanvasElement): ChartInstanceLike | undefined;
  register(...plugins: unknown[]): void;
};

export type DataLabelsContextLike = {
  chart: {
    getDatasetMeta(datasetIndex: number): { type?: unknown };
  };
  dataIndex: number;
  dataset: ChartDatasetLike;
  datasetIndex: number;
};

export type ChartBrowserRuntime = {
  Chart: ChartConstructorLike;
  ChartDataLabels: unknown;
};

declare global {
  interface Window {
    Chart?: ChartConstructorLike;
    ChartDataLabels?: unknown;
    __PRESENTON_CHART_BROWSER_RUNTIME__?: Promise<ChartBrowserRuntime>;
  }
}

function ensureLocalScript(
  src: string,
  marker: string,
  isReady: () => boolean,
) {
  if (isReady()) return Promise.resolve();

  let script = document.querySelector<HTMLScriptElement>(
    `script[data-presenton-chart-runtime="${marker}"]`,
  );
  if (!script) {
    script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.presentonChartRuntime = marker;
    document.head.appendChild(script);
  }

  return new Promise<void>((resolve, reject) => {
    if (isReady()) {
      resolve();
      return;
    }
    const handleLoad = () => {
      if (isReady()) {
        resolve();
        return;
      }
      script.remove();
      reject(new Error(`Local chart runtime did not initialize: ${src}`));
    };
    const handleError = () => {
      script.remove();
      reject(new Error(`Failed to load local chart runtime: ${src}`));
    };
    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });
  });
}

export function loadChartBrowserRuntime(): Promise<ChartBrowserRuntime> {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return Promise.reject(
      new Error("The local Chart.js runtime requires a browser document"),
    );
  }

  const existing = window.__PRESENTON_CHART_BROWSER_RUNTIME__;
  if (existing) return existing;

  const runtime = (async () => {
    await ensureLocalScript(
      CHART_BROWSER_SCRIPT_URL,
      "chartjs",
      () => typeof window.Chart === "function",
    );
    await ensureLocalScript(
      CHART_DATALABELS_SCRIPT_URL,
      "datalabels",
      () => Boolean(window.ChartDataLabels),
    );

    const Chart = window.Chart;
    const ChartDataLabels = window.ChartDataLabels;
    if (!Chart || !ChartDataLabels) {
      throw new Error("The local Chart.js runtime is incomplete");
    }
    Chart.register(ChartDataLabels);
    return { Chart, ChartDataLabels };
  })();

  window.__PRESENTON_CHART_BROWSER_RUNTIME__ = runtime;
  void runtime.catch(() => {
    if (window.__PRESENTON_CHART_BROWSER_RUNTIME__ === runtime) {
      delete window.__PRESENTON_CHART_BROWSER_RUNTIME__;
    }
  });
  return runtime;
}
