import { buildAbsoluteApiRequestUrl, getApiUrl } from "@/utils/api";
import { ApiResponseHandler } from "./api-error-handler";
import { getHeader } from "./header";
import {
  isChatGptAuthRequiredMessage,
  normalizeChatGptAuthMessage,
  requestChatGptReauth,
} from "@/utils/chatgptAuth";

export interface ChatAttachment {
  type: "document";
  name: string;
  file_path: string;
  mime_type?: string | null;
}

export interface ChatMessageRequest {
  presentation_id: string;
  message: string;
  conversation_id?: string;
  attachments?: ChatAttachment[];
}

export interface ChatMessageResponse {
  conversation_id?: string;
  response: string;
  tool_calls?: string[];
}

export interface ChatHistoryMessage {
  role: string;
  content: string;
  created_at?: string;
}

export interface ChatHistoryData {
  presentation_id: string;
  conversation_id: string;
  messages: ChatHistoryMessage[];
}

export interface ChatConversationSummary {
  conversation_id: string;
  updated_at?: string | null;
  last_message_preview?: string | null;
}

export interface ChatStreamTrace {
  kind?: string;
  round?: number;
  tool?: string;
  status?: string;
  message?: string;
  tools?: string[];
  slideIndex?: number;
  slideNumber?: number;
  targetSlideIndices?: number[];
  targetSlideNumbers?: number[];
  componentId?: string;
  elementPath?: string;
}

export interface ChatStreamHandlers {
  onChunk?: (chunk: string) => void;
  onStatus?: (status: string) => void;
  onTrace?: (trace: ChatStreamTrace) => void;
  onComplete?: (response: ChatMessageResponse) => void;
}

interface ChatStreamDataChunk {
  type: "chunk";
  chunk?: unknown;
}

interface ChatStreamDataComplete {
  type: "complete";
  chat?: unknown;
}

interface ChatStreamDataError {
  type: "error";
  detail?: unknown;
}

interface ChatStreamDataStatus {
  type: "status";
  status?: unknown;
}

interface ChatStreamDataTrace {
  type: "trace";
  trace?: unknown;
}

type ChatStreamData =
  | ChatStreamDataChunk
  | ChatStreamDataComplete
  | ChatStreamDataError
  | ChatStreamDataStatus
  | ChatStreamDataTrace
  | Record<string, unknown>;

async function streamChatMessage(
  endpoint: string,
  payload: ChatMessageRequest,
  handlers: ChatStreamHandlers = {},
  options?: { signal?: AbortSignal }
): Promise<ChatMessageResponse> {
  const response = await fetch(getApiUrl(endpoint), {
    method: "POST",
    headers: getHeader(),
    body: JSON.stringify(payload),
    cache: "no-cache",
    signal: options?.signal,
  });

  if (!response.ok) {
    await ApiResponseHandler.handleResponse(
      response,
      "Failed to stream chat message"
    );
    throw new Error("Failed to stream chat message");
  }

  if (!response.body) {
    throw new Error("No response body received from chat stream");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let finalResponse: ChatMessageResponse | null = null;

  const processSseFrame = (frame: string) => {
    const normalized = frame.replaceAll("\r", "");
    const lines = normalized.split("\n");
    let eventName = "";
    const dataLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith("event:")) {
        eventName = line.slice(6).trim();
        continue;
      }
      if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trimStart());
      }
    }

    if (eventName && eventName !== "response") {
      return;
    }
    if (!dataLines.length) {
      return;
    }

    let parsedData: ChatStreamData;
    try {
      parsedData = JSON.parse(dataLines.join("\n")) as ChatStreamData;
    } catch {
      return;
    }

    const payloadType = parsedData.type;
    if (payloadType === "chunk") {
      const chunk = parsedData.chunk;
      if (typeof chunk === "string" && chunk.length > 0) {
        handlers.onChunk?.(chunk);
      }
      return;
    }

    if (payloadType === "complete") {
      const chatPayload = (parsedData as ChatStreamDataComplete).chat;
      if (
        chatPayload &&
        typeof chatPayload === "object" &&
        typeof (chatPayload as { response?: unknown }).response === "string"
      ) {
        const typedResponse: ChatMessageResponse = {
          conversation_id:
            typeof (chatPayload as { conversation_id?: unknown })
              .conversation_id === "string"
              ? (chatPayload as { conversation_id?: string }).conversation_id
              : undefined,
          response: (chatPayload as { response: string }).response,
          tool_calls: Array.isArray(
            (chatPayload as { tool_calls?: unknown }).tool_calls
          )
            ? ((chatPayload as { tool_calls?: unknown[] }).tool_calls ?? []).filter(
              (item): item is string => typeof item === "string"
            )
            : [],
        };
        finalResponse = typedResponse;
        handlers.onComplete?.(typedResponse);
      }
      return;
    }

    if (payloadType === "error") {
      const detail = (parsedData as ChatStreamDataError).detail;
      const message =
        typeof detail === "string" && detail.trim().length > 0
          ? detail
          : "Chat stream failed";
      if (isChatGptAuthRequiredMessage(message)) {
        const authMessage = normalizeChatGptAuthMessage(message);
        requestChatGptReauth({
          message: authMessage,
          source: "chat-stream",
        });
        throw new Error(authMessage);
      }
      throw new Error(message);
    }

    if (payloadType === "status") {
      const status = (parsedData as ChatStreamDataStatus).status;
      if (typeof status === "string" && status.trim().length > 0) {
        handlers.onStatus?.(status);
      }
      return;
    }

    if (payloadType === "trace") {
      const trace = (parsedData as ChatStreamDataTrace).trace;
      if (trace && typeof trace === "object") {
        const typedTrace = trace as Record<string, unknown>;
        handlers.onTrace?.({
          kind:
            typeof typedTrace.kind === "string" ? typedTrace.kind : undefined,
          round:
            typeof typedTrace.round === "number" ? typedTrace.round : undefined,
          tool:
            typeof typedTrace.tool === "string" ? typedTrace.tool : undefined,
          status:
            typeof typedTrace.status === "string" ? typedTrace.status : undefined,
          message:
            typeof typedTrace.message === "string" ? typedTrace.message : undefined,
          tools: Array.isArray(typedTrace.tools)
            ? typedTrace.tools.filter(
              (value): value is string => typeof value === "string"
            )
            : undefined,
          slideIndex:
            typeof typedTrace.slide_index === "number"
              ? typedTrace.slide_index
              : typeof typedTrace.slideIndex === "number"
                ? typedTrace.slideIndex
                : undefined,
          slideNumber:
            typeof typedTrace.slide_number === "number"
              ? typedTrace.slide_number
              : typeof typedTrace.slideNumber === "number"
                ? typedTrace.slideNumber
                : undefined,
          targetSlideIndices: Array.isArray(typedTrace.target_slide_indices)
            ? typedTrace.target_slide_indices.filter(
              (value): value is number => typeof value === "number"
            )
            : Array.isArray(typedTrace.targetSlideIndices)
              ? typedTrace.targetSlideIndices.filter(
                (value): value is number => typeof value === "number"
              )
              : undefined,
          targetSlideNumbers: Array.isArray(typedTrace.target_slide_numbers)
            ? typedTrace.target_slide_numbers.filter(
              (value): value is number => typeof value === "number"
            )
            : Array.isArray(typedTrace.targetSlideNumbers)
              ? typedTrace.targetSlideNumbers.filter(
                (value): value is number => typeof value === "number"
              )
              : undefined,
          componentId:
            typeof typedTrace.component_id === "string"
              ? typedTrace.component_id
              : typeof typedTrace.componentId === "string"
                ? typedTrace.componentId
                : undefined,
          elementPath:
            typeof typedTrace.element_path === "string"
              ? typedTrace.element_path
              : typeof typedTrace.elementPath === "string"
                ? typedTrace.elementPath
                : undefined,
        });
      }
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });

    let delimiterIndex = buffer.indexOf("\n\n");
    while (delimiterIndex >= 0) {
      const frame = buffer.slice(0, delimiterIndex);
      buffer = buffer.slice(delimiterIndex + 2);
      processSseFrame(frame);
      delimiterIndex = buffer.indexOf("\n\n");
    }
  }

  if (buffer.trim().length > 0) {
    processSseFrame(buffer);
  }

  if (finalResponse) {
    return finalResponse;
  }

  throw new Error("Chat stream ended before completion");
}

export class PresentationChatApi {
  static async listConversations(
    presentationId: string
  ): Promise<ChatConversationSummary[]> {
    const u = new URL(
      buildAbsoluteApiRequestUrl("/api/v1/ppt/chat/conversations")
    );
    u.searchParams.set("presentation_id", presentationId);
    const response = await fetch(u.toString(), {
      headers: getHeader(),
      cache: "no-cache",
    });
    return await ApiResponseHandler.handleResponse(
      response,
      "Failed to list chat conversations"
    );
  }

  static async getHistory(
    presentationId: string,
    conversationId: string
  ): Promise<ChatHistoryData> {
    const u = new URL(buildAbsoluteApiRequestUrl("/api/v1/ppt/chat/history"));
    u.searchParams.set("presentation_id", presentationId);
    u.searchParams.set("conversation_id", conversationId);
    const response = await fetch(u.toString(), {
      headers: getHeader(),
      cache: "no-cache",
    });
    return await ApiResponseHandler.handleResponse(
      response,
      "Failed to load chat history"
    );
  }

  static async deleteConversation(
    presentationId: string,
    conversationId: string
  ): Promise<void> {
    const u = new URL(
      buildAbsoluteApiRequestUrl("/api/v1/ppt/chat/conversation")
    );
    u.searchParams.set("presentation_id", presentationId);
    u.searchParams.set("conversation_id", conversationId);
    const response = await fetch(u.toString(), {
      method: "DELETE",
      headers: getHeader(),
      cache: "no-cache",
    });
    await ApiResponseHandler.handleResponse(
      response,
      "Failed to delete chat conversation"
    );
  }

  static async sendMessage(
    payload: ChatMessageRequest
  ): Promise<ChatMessageResponse> {
    const response = await fetch(getApiUrl("/api/v1/ppt/chat/message"), {
      method: "POST",
      headers: getHeader(),
      body: JSON.stringify(payload),
      cache: "no-cache",
    });

    return await ApiResponseHandler.handleResponse(
      response,
      "Failed to send chat message"
    );
  }

  static async streamMessage(
    payload: ChatMessageRequest,
    handlers: ChatStreamHandlers = {},
    options?: { signal?: AbortSignal }
  ): Promise<ChatMessageResponse> {
    return streamChatMessage(
      "/api/v1/ppt/chat/message/stream",
      payload,
      handlers,
      options
    );
  }
}
