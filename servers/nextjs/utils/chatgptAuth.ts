import { getApiUrl } from "@/utils/api";
import { MixpanelEvent, trackEvent } from "@/utils/mixpanel";
import { syncStoreAfterCodexSignOut } from "@/utils/storeHelpers";

export const CHATGPT_AUTH_REQUIRED_EVENT = "presenton:chatgpt-auth-required";
export const CHATGPT_AUTH_ACTION_HEADER = "x-presenton-auth-action";
export const CHATGPT_AUTH_ACTION_VALUE = "codex-reauth";
export const CHATGPT_AUTH_REQUIRED_MARKER = "CHATGPT_AUTH_REQUIRED:";

export interface ChatGptAuthRequiredEventDetail {
  message?: string;
  source?: string;
}

interface ApiErrorLike {
  detail?: unknown;
  message?: unknown;
  error?: unknown;
}

function stringifyDetail(detail: unknown): string {
  if (!detail) return "";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((item) => stringifyDetail(item)).filter(Boolean).join(" ");
  }
  if (typeof detail === "object") {
    const record = detail as Record<string, unknown>;
    const message = record.message ?? record.detail ?? record.error ?? record.msg;
    if (message) return stringifyDetail(message);
    try {
      return JSON.stringify(detail);
    } catch {
      return "";
    }
  }
  return String(detail);
}

export function normalizeChatGptAuthMessage(message?: unknown): string {
  const raw = stringifyDetail(message).trim();
  if (!raw) {
    return "Your ChatGPT session expired. Please sign in again from Settings.";
  }

  const markerIndex = raw.indexOf(CHATGPT_AUTH_REQUIRED_MARKER);
  if (markerIndex >= 0) {
    return raw.slice(markerIndex + CHATGPT_AUTH_REQUIRED_MARKER.length).trim();
  }

  return raw;
}

export function isChatGptAuthRequiredMessage(message?: unknown): boolean {
  const raw = stringifyDetail(message).toLowerCase();
  return (
    raw.includes(CHATGPT_AUTH_REQUIRED_MARKER.toLowerCase()) ||
    raw.includes("chatgpt authentication") ||
    raw.includes("chatgpt session") ||
    raw.includes("codex oauth")
  );
}

export function isChatGptAuthRequiredResponse(
  response: Response,
  errorData?: ApiErrorLike | null,
  errorMessage?: string
): boolean {
  const action = response.headers.get(CHATGPT_AUTH_ACTION_HEADER);
  if (action === CHATGPT_AUTH_ACTION_VALUE) {
    return true;
  }

  if (response.status !== 401 && response.status !== 403) {
    return false;
  }

  return (
    isChatGptAuthRequiredMessage(errorMessage) ||
    isChatGptAuthRequiredMessage(errorData?.detail) ||
    isChatGptAuthRequiredMessage(errorData?.message) ||
    isChatGptAuthRequiredMessage(errorData?.error)
  );
}

export function requestChatGptReauth(
  detail: ChatGptAuthRequiredEventDetail = {}
): void {
  if (typeof window === "undefined") return;

  trackEvent(MixpanelEvent.Codex_Reauth_Required, {
    source: detail.source || "unknown",
  });

  window.dispatchEvent(
    new CustomEvent<ChatGptAuthRequiredEventDetail>(
      CHATGPT_AUTH_REQUIRED_EVENT,
      {
        detail: {
          ...detail,
          message: normalizeChatGptAuthMessage(detail.message),
        },
      }
    )
  );
}

export async function logoutChatGptAuth(): Promise<void> {
  let logoutError: unknown = null;

  try {
    const response = await fetch(getApiUrl("/api/v1/ppt/codex/auth/logout"), {
      method: "POST",
    });
    if (!response.ok) {
      logoutError = new Error("ChatGPT logout request failed");
    }
  } catch (error) {
    logoutError = error;
  } finally {
    syncStoreAfterCodexSignOut();
  }

  if (logoutError) {
    throw logoutError;
  }
}
