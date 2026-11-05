export interface ApiErrorResponse {
  detail?: unknown;
  message?: string;
  error?: unknown;
}

export interface ApiErrorMetadata {
  code?: string;
  retryable: boolean;
  requestId?: string;
}

const INVALID_API_KEY_MESSAGE =
  "Invalid API key. Please verify your API key and try again.";
const SAFETY_BLOCK_MESSAGE =
  "The request was blocked by the provider's safety system. Please revise it and try again.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function extractApiErrorMetadata(
  errorData: unknown,
  status?: number
): ApiErrorMetadata {
  const root = isRecord(errorData) ? errorData : null;
  const detail = root && isRecord(root.detail) ? root.detail : null;
  const error = root && isRecord(root.error) ? root.error : null;
  const metadata = { ...root, ...error, ...detail };
  const code =
    metadata && typeof metadata.code === "string" && metadata.code.trim()
      ? metadata.code.trim()
      : undefined;
  const retryable =
    metadata && typeof metadata.retryable === "boolean"
      ? metadata.retryable
      : Boolean(status && [408, 425, 429, 500, 502, 503, 504].includes(status));

  const requestId = typeof metadata.request_id === "string" ? metadata.request_id : undefined;
  return { code, retryable, requestId };
}

function nestedMessage(value: unknown, depth = 0): string | null {
  if (depth > 8) return null;
  if (!value) return null;
  if (typeof value === "string") return value;
  if (!isRecord(value)) return null;

  for (const key of ["message", "detail", "error"]) {
    const nested = value[key];
    if (typeof nested === "string" && nested.trim()) {
      return nested;
    }
    const message = nestedMessage(nested, depth + 1);
    if (message) {
      return message;
    }
  }

  return null;
}

export function normalizeApiErrorDetail(detail: unknown): string | null {
  if (!detail) return null;

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    const parts = detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (isRecord(item)) {
          const maybeMsg = item.msg;
          const maybeLoc = item.loc;
          const locPath = Array.isArray(maybeLoc)
            ? maybeLoc
                .filter(
                  (value) =>
                    typeof value === "string" || typeof value === "number"
                )
                .join(".")
            : "";
          if (typeof maybeMsg === "string") {
            return locPath ? `${locPath}: ${maybeMsg}` : maybeMsg;
          }
          return nestedMessage(item);
        }
        return null;
      })
      .filter((value): value is string => Boolean(value));

    return parts.length ? parts.join("; ") : null;
  }

  if (isRecord(detail)) {
    return nestedMessage(detail);
  }

  return String(detail);
}

function looksLikeProviderAuthError(message: string, status?: number): boolean {
  const text = message.toLowerCase();
  return (
    /invalid[_\s-]*api[_\s-]*key/.test(text) ||
    /incorrect\s+api\s+key/.test(text) ||
    /api\s+key\s+(?:is\s+)?invalid/.test(text) ||
    text.includes("authentication_error") ||
    text.includes("invalid_api_key") ||
    Boolean(status === 401 && text.includes("api key"))
  );
}

function looksLikeSafetyBlock(message: string): boolean {
  const text = message.toLowerCase();
  return text.includes("moderation_blocked") || text.includes("safety system");
}

function looksLikeRawPayload(message: string): boolean {
  const text = message.trim();
  return (
    text.startsWith("{") ||
    text.startsWith("[") ||
    text.toLowerCase().startsWith("<!doctype") ||
    text.toLowerCase().startsWith("<html") ||
    text.includes("{'error'") ||
    text.includes('"error"') ||
    text.includes("Error code:") ||
    text.length > 1500 ||
    /https?:\/\/|traceback|sqlalchemy|cannot read properties|\b(?:authorization|api[_-]?key|password|bearer)\s*[:=]/i.test(text)
  );
}

export function statusErrorMessage(status: number, fallback: string): string {
  switch (status) {
    case 400: return "Please check your input and try again.";
    case 401: return "Your session has expired. Please sign in again.";
    case 403: return "You do not have permission to perform this action. Contact your administrator if you need access.";
    case 404: return "The requested item was not found. It may have been deleted or moved.";
    case 409: return "This item has changed or already exists. Refresh and try again.";
    case 413: return "This request is too large. Try a smaller file or request.";
    case 415: return "This file or request format is not supported.";
    case 422: return "Please check the highlighted fields and try again.";
    case 428: return "This installation needs initial setup. Ask an administrator to complete setup.";
    case 429: return "Too many requests. Please wait a moment and try again.";
    case 500: return "The server could not complete this request. Please try again.";
    case 502: return "Presenton received an invalid response from a service. Please try again shortly.";
    case 503: return "The service is temporarily unavailable. Please try again shortly.";
    case 408:
    case 504: return "The request took too long to complete. Please try again.";
    default: return fallback;
  }
}

export function sanitizeApiErrorMessage(
  message: string,
  fallbackMessage: string,
  status?: number
): string {
  const trimmed = message.trim();
  if (!trimmed) return fallbackMessage;
  if ([401, 403, 428].includes(status || 0) && /^(unauthorized|not authenticated|forbidden|admin browser session required|login setup is required)$/i.test(trimmed)) {
    return statusErrorMessage(status!, fallbackMessage);
  }

  if (looksLikeProviderAuthError(trimmed, status)) {
    return INVALID_API_KEY_MESSAGE;
  }
  if (looksLikeSafetyBlock(trimmed)) {
    return SAFETY_BLOCK_MESSAGE;
  }
  if (looksLikeRawPayload(trimmed)) {
    return fallbackMessage;
  }

  return trimmed;
}

export function extractApiErrorMessage(
  errorData: unknown,
  fallbackMessage: string,
  status?: number
): string {
  let message: string | null = null;

  if (isRecord(errorData)) {
    const apiError = errorData as ApiErrorResponse;
    message =
      normalizeApiErrorDetail(apiError.detail) ||
      (typeof apiError.message === "string" ? apiError.message : null) ||
      normalizeApiErrorDetail(apiError.error);
  } else {
    message = normalizeApiErrorDetail(errorData);
  }

  return sanitizeApiErrorMessage(message || fallbackMessage, fallbackMessage, status);
}
