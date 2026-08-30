import { extractApiErrorMessage } from "@/utils/apiErrorMessages";

export const BACKEND_CONNECTION_ERROR_MESSAGE =
  "Check that the FastAPI backend is running and that the frontend can reach it.";

export class BackendConnectionError extends Error {
  constructor(message = BACKEND_CONNECTION_ERROR_MESSAGE) {
    super(message);
    this.name = "BackendConnectionError";
  }
}

export function isBackendConnectionError(
  error: unknown
): error is BackendConnectionError {
  return error instanceof BackendConnectionError;
}

function isAbsoluteHttpUrl(path: string): boolean {
  return /^https?:\/\//i.test(path);
}

export async function getApiErrorMessage(
  response: Response,
  fallbackMessage: string
): Promise<string> {
  try {
    const errorData: unknown = await response.clone().json();
    return extractApiErrorMessage(errorData, fallbackMessage, response.status);
  } catch {
    try {
      const text = await response.text();
      return extractApiErrorMessage(text, fallbackMessage, response.status);
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
  const isFastApiEndpoint =
    normalizedPath.startsWith("/api/v1/") ||
    normalizedPath.startsWith("/api/v2/");
  if (!isFastApiEndpoint) {
    return normalizedPath;
  }

  if (typeof window === "undefined" && !getConfiguredFastApiUrl()) {
    return normalizedPath;
  }

  return resolveBackendPathForRuntime(normalizedPath);
}

function isJsonResponse(response: Response): boolean {
  const contentType = response.headers.get("content-type")?.toLowerCase() || "";
  return (
    contentType.includes("application/json") || contentType.includes("+json")
  );
}

/**
 * Verify the browser-to-FastAPI path before configuration bootstrap makes any
 * provider decisions. A same-origin frontend 404/500 is commonly HTML, so it
 * must not be mistaken for a valid backend response.
 */
export async function assertBackendReachable(): Promise<void> {
  let response: Response;
  try {
    response = await fetch(getApiUrl("/api/v1/auth/status"), {
      cache: "no-store",
      credentials: "include",
    });
  } catch {
    throw new BackendConnectionError();
  }

  if (!response.ok || !isJsonResponse(response)) {
    throw new BackendConnectionError();
  }

  try {
    const status: unknown = await response.json();
    if (!status || typeof status !== "object" || Array.isArray(status)) {
      throw new BackendConnectionError();
    }
  } catch (error) {
    if (isBackendConnectionError(error)) throw error;
    throw new BackendConnectionError();
  }
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

function getHttpOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed.origin
      : null;
  } catch {
    return null;
  }
}

function isLocalBackendOrigin(origin: string): boolean {
  const localOrigins = new Set<string>();
  const configuredOrigin = getHttpOrigin(getConfiguredFastApiUrl());
  const queryOrigin = getHttpOrigin(getFastApiUrlFromQuery());
  const runtimeOrigin = getHttpOrigin(getFastAPIUrl());

  if (configuredOrigin) localOrigins.add(configuredOrigin);
  if (queryOrigin) localOrigins.add(queryOrigin);
  if (runtimeOrigin) localOrigins.add(runtimeOrigin);
  if (typeof window !== "undefined" && window.location?.origin) {
    localOrigins.add(window.location.origin);
  }

  return localOrigins.has(origin);
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
      // Assets returned by Presenton cloud (or any other remote origin) must
      // retain their complete URL. Only URLs that point at this deployment's
      // own backend are normalized to the runtime's local/reverse-proxy path.
      if (!isLocalBackendOrigin(parsed.origin)) {
        return trimmedPath;
      }
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

function isAssetLikeString(value: string): boolean {
  const candidate = value.trim();
  if (!candidate) return false;

  if (/^(?:https?:|data:|blob:|file:)/i.test(candidate)) {
    return true;
  }

  const { path } = splitPathAndSuffix(candidate);
  const normalizedPath = path.replace(/\\/g, "/");
  const startsLikePath =
    normalizedPath.startsWith("/") ||
    normalizedPath.startsWith("./") ||
    normalizedPath.startsWith("../") ||
    /^[A-Za-z]:\//.test(normalizedPath) ||
    /^(?:static|app_data|images|uploads|fonts)\//.test(normalizedPath);

  if (!startsLikePath) return false;

  return hasBackendAssetPrefix(
    toBackendServedPath(withLeadingSlash(normalizedPath))
  );
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
          ? isAssetLikeString(value)
            ? resolveBackendAssetUrl(value)
            : value
          : normalizeBackendAssetUrls(value);
    }
    return normalized as T;
  }

  return input;
};
