import {
  isChatGptAuthRequiredResponse,
  normalizeChatGptAuthMessage,
  requestChatGptReauth,
} from "@/utils/chatgptAuth";
import {
  extractApiErrorMessage,
  extractApiErrorMetadata,
  statusErrorMessage,
  type ApiErrorResponse,
} from "@/utils/apiErrorMessages";

export class ApiResponseError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly retryable: boolean;
  readonly requestId?: string;

  constructor(
    message: string,
    metadata: { status: number; code?: string; retryable: boolean; requestId?: string },
  ) {
    super(message);
    this.name = "ApiResponseError";
    this.status = metadata.status;
    this.code = metadata.code;
    this.retryable = metadata.retryable;
    this.requestId = metadata.requestId;
  }
}

/** Normalize transport errors without retrying potentially mutating requests. */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (error) {
    const timeout = (error instanceof Error && error.name === "TimeoutError") || init?.signal?.reason?.name === "TimeoutError";
    if (!timeout && (init?.signal?.aborted || (error instanceof Error && error.name === "AbortError"))) {
      throw error;
    }
    throw new ApiResponseError(
      timeout
        ? "The request took too long to complete. Please try again."
        : "Could not reach Presenton. Check your connection and that the server is running, then try again.",
      { status: timeout ? 504 : 0, code: timeout ? "request_timeout" : "backend_unreachable", retryable: true },
    );
  }
}

export class ApiResponseHandler {
  static async handleResponse(response: Response, defaultErrorMessage: string): Promise<any> {
    if (response.ok) {
      if (response.status === 204) return true;
      try {
        return await response.json();
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") throw error;
        // Invalid JSON must not become an empty successful object that causes
        // an unrelated rendering failure later.
        throw new ApiResponseError(
          "Presenton returned an incomplete or invalid response. Please try again.",
          { status: 502, code: "invalid_response", retryable: true },
        );
      }
    }

    let errorData: ApiErrorResponse | null = null;
    try {
      errorData = await response.json();
    } catch {
      // Gateways may return HTML or an empty body. Never display that payload.
    }
    const fallback = statusErrorMessage(response.status, defaultErrorMessage);
    let message = extractApiErrorMessage(errorData, fallback, response.status);
    if (isChatGptAuthRequiredResponse(response, errorData, message)) {
      message = normalizeChatGptAuthMessage(message);
      requestChatGptReauth({ message, source: "api-response" });
    }
    throw new ApiResponseError(message, {
      status: response.status,
      ...extractApiErrorMetadata(errorData, response.status),
    });
  }

  static async handleResponseWithResult(response: Response, defaultErrorMessage: string): Promise<{ success: boolean; message?: string }> {
    if (response.ok) return { success: true };
    try {
      await this.handleResponse(response, defaultErrorMessage);
      return { success: true };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : defaultErrorMessage };
    }
  }
}

export type { ApiErrorResponse };
