function isAbsoluteHttpUrl(path: string): boolean {
  return /^https?:\/\//i.test(path);
}

interface ApiErrorResponse {
  detail?: unknown;
  message?: string;
  error?: string;
}

function normalizeApiErrorDetail(detail: unknown): string | null {
  if (!detail) return null;

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    const parts = detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const maybeMsg = (item as { msg?: unknown }).msg;
          const maybeLoc = (item as { loc?: unknown }).loc;
          const locPath = Array.isArray(maybeLoc)
            ? maybeLoc
                .filter((value) => typeof value === "string" || typeof value === "number")
                .join(".")
            : "";
          if (typeof maybeMsg === "string") {
            return locPath ? `${locPath}: ${maybeMsg}` : maybeMsg;
          }
        }
        return null;
      })
      .filter((value): value is string => Boolean(value));

    return parts.length ? parts.join("; ") : JSON.stringify(detail);
  }

  if (typeof detail === "object") {
    return JSON.stringify(detail);
  }

  return String(detail);
}

export async function getApiErrorMessage(
  response: Response,
  fallbackMessage: string
): Promise<string> {
  try {
    const errorData: unknown = await response.clone().json();
    if (errorData && typeof errorData === "object" && !Array.isArray(errorData)) {
      const apiError = errorData as ApiErrorResponse;
      const normalizedDetail = normalizeApiErrorDetail(apiError.detail);
      return normalizedDetail || apiError.message || apiError.error || fallbackMessage;
    }

    return normalizeApiErrorDetail(errorData) || fallbackMessage;
  } catch {
    try {
      const text = await response.text();
      return text || fallbackMessage;
    } catch {
      return fallbackMessage;
    }
  }
}

function withLeadingSlash(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

function getConfiguredFastApiUrl(): string | null {
  if (typeof window !== "undefined" && window.env?.NEXT_PUBLIC_FAST_API) {
    return window.env.NEXT_PUBLIC_FAST_API;
  }

  if (process.env.NEXT_PUBLIC_FAST_API) {
    return process.env.NEXT_PUBLIC_FAST_API;
  }

  return null;
}

function getFastApiUrlFromQuery(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const value = params.get("fastapiUrl");
    if (!value) return null;

    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

function isElectronRuntime(): boolean {
  return typeof window !== "undefined" && !!window.electron;
}

function shouldUseDirectFastApiOriginInBrowser(): boolean {
  return isElectronRuntime() || !!getFastApiUrlFromQuery();
}

function resolveBackendPathForRuntime(path: string): string {
  const normalizedPath = withLeadingSlash(path);

  // Docker/web runtime should stay same-origin and use nginx reverse proxy.
  if (
    typeof window !== "undefined" &&
    !shouldUseDirectFastApiOriginInBrowser()
  ) {
    return normalizedPath;
  }

  return `${getFastAPIUrl()}${normalizedPath}`;
}

// Utility to get the backend base URL.
// - Browser web/docker: same origin (nginx proxy).
// - Browser electron or query override: direct FastAPI origin.
// - Server-side: configured FastAPI origin fallback.
export function getFastAPIUrl(): string {
  const queryFastApiUrl = getFastApiUrlFromQuery();
  if (queryFastApiUrl) {
    return queryFastApiUrl;
  }

  if (typeof window !== "undefined") {
    if (isElectronRuntime()) {
      return getConfiguredFastApiUrl() || window.location.origin;
    }
    return window.location.origin;
  }

  return getConfiguredFastApiUrl() || "http://127.0.0.1:5001";
}

// Utility to construct API URL for Docker/web runtime.
export function getApiUrl(path: string): string {
  if (isAbsoluteHttpUrl(path)) {
    return path;
  }

  const normalizedPath = withLeadingSlash(path);
  const isFastApiEndpoint = normalizedPath.startsWith("/api/v1/");
  if (!isFastApiEndpoint) {
    return normalizedPath;
  }

  if (typeof window === "undefined" && !getConfiguredFastApiUrl()) {
    return normalizedPath;
  }

  return resolveBackendPathForRuntime(normalizedPath);
}

/**
 * getApiUrl may return a path without host (e.g. `/api/v1/...`). A single-argument
 * `new URL("/api/...")` call is invalid; use this before `new URL(..., ...)`-style
 * builds or to obtain an absolute string for `URL` + `searchParams`.
 */
export function buildAbsoluteApiRequestUrl(
  path: string,
  baseForRelative: string = typeof window !== "undefined" &&
  window.location?.origin
    ? window.location.origin
    : "http://127.0.0.1:5001"
): string {
  const resolved = getApiUrl(path);
  if (isAbsoluteHttpUrl(resolved)) {
    return resolved;
  }
  return new URL(resolved, baseForRelative).toString();
}

function hasBackendAssetPrefix(path: string): boolean {
  return path.startsWith("/static/") || path.startsWith("/app_data/");
}

function toBackendServedPath(rawPath: string): string {
  const normalized = rawPath.replace(/\\/g, "/");

  // Never rewrite Next.js bundled/static assets.
  if (normalized.startsWith("/_next/static/")) {
    return normalized;
  }

  const appDataIdx = normalized.indexOf("/app_data/");
  if (appDataIdx !== -1) {
    return normalized.slice(appDataIdx);
  }

  const staticIdx = normalized.indexOf("/static/");
  if (staticIdx !== -1) {
    return normalized.slice(staticIdx);
  }

  const imagesIdx = normalized.lastIndexOf("/images/");
  if (imagesIdx !== -1) {
    return `/app_data${normalized.slice(imagesIdx)}`;
  }

  const uploadsIdx = normalized.lastIndexOf("/uploads/");
  if (uploadsIdx !== -1) {
    return `/app_data${normalized.slice(uploadsIdx)}`;
  }

  const fontsIdx = normalized.lastIndexOf("/fonts/");
  if (fontsIdx !== -1) {
    return `/app_data${normalized.slice(fontsIdx)}`;
  }

  return normalized;
}

function splitPathAndSuffix(value: string): { path: string; suffix: string } {
  const hashIdx = value.indexOf("#");
  const queryIdx = value.indexOf("?");
  const firstSuffixIdx =
    hashIdx === -1
      ? queryIdx
      : queryIdx === -1
        ? hashIdx
        : Math.min(queryIdx, hashIdx);

  if (firstSuffixIdx === -1) {
    return { path: value, suffix: "" };
  }

  return {
    path: value.slice(0, firstSuffixIdx),
    suffix: value.slice(firstSuffixIdx),
  };
}

// Resolve backend-served asset paths to the runtime-appropriate backend path.
export function resolveBackendAssetUrl(path?: string): string {
  if (!path) return "";

  const trimmedPath = path.trim();
  if (!trimmedPath) return "";

  if (trimmedPath.startsWith("data:") || trimmedPath.startsWith("blob:")) {
    return trimmedPath;
  }

  if (trimmedPath.startsWith("file:")) {
    try {
      const parsed = new URL(trimmedPath);
      const servedPath = toBackendServedPath(decodeURIComponent(parsed.pathname));
      if (hasBackendAssetPrefix(servedPath)) {
        return resolveBackendPathForRuntime(servedPath);
      }
      return trimmedPath;
    } catch {
      return trimmedPath;
    }
  }

  if (isAbsoluteHttpUrl(trimmedPath)) {
    try {
      const parsed = new URL(trimmedPath);
      const servedPath = toBackendServedPath(parsed.pathname);
      if (hasBackendAssetPrefix(servedPath)) {
        return resolveBackendPathForRuntime(
          `${servedPath}${parsed.search}${parsed.hash}`
        );
      }
      return trimmedPath;
    } catch {
      return trimmedPath;
    }
  }

  const { path: pathPart, suffix } = splitPathAndSuffix(trimmedPath);
  const servedPath = toBackendServedPath(withLeadingSlash(pathPart));
  if (hasBackendAssetPrefix(servedPath)) {
    return resolveBackendPathForRuntime(`${servedPath}${suffix}`);
  }

  return trimmedPath;
}

export type BackendAssetLike = {
  file_url?: string | null;
  path?: string | null;
  url?: string | null;
};

export function getBackendAssetSource(
  asset: BackendAssetLike | string | null | undefined
): string {
  if (typeof asset === "string") {
    return asset;
  }

  if (!asset) {
    return "";
  }

  return (asset.file_url || asset.path || asset.url || "").trim();
}

export function resolveBackendAssetSource(
  asset: BackendAssetLike | string | null | undefined
): string {
  return resolveBackendAssetUrl(getBackendAssetSource(asset));
}

export const normalizeBackendAssetUrls = <T,>(input: T): T => {
  if (Array.isArray(input)) {
    return input.map((item) => normalizeBackendAssetUrls(item)) as T;
  }

  if (input && typeof input === "object") {
    const normalized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(
      input as Record<string, unknown>
    )) {
      normalized[key] =
        typeof value === "string"
          ? resolveBackendAssetUrl(value)
          : normalizeBackendAssetUrls(value);
    }
    return normalized as T;
  }

  return input;
};
