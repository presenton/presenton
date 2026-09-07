import type { DragEvent } from "react";
import type { ChatAttachment } from "../../../services/api/chat";
import type {
  ChatDocumentAttachment,
  ChatLayoutPreview,
  ChatLink,
} from "./chat-types";

export const createMessageId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const createChatLayoutPreviewSlide = (preview: ChatLayoutPreview) => ({
  id: `chat-layout-preview-${preview.slideIndex ?? "slide"}`,
  content: {},
  ui: preview.layout,
  layout: preview.layoutId || "chat-layout-preview",
  layout_group: "template-v2",
});

export const getPresentationSlide = (
  presentationData: unknown,
  slideIndex: number,
) => {
  if (!presentationData || typeof presentationData !== "object") return null;
  const slides = (presentationData as Record<string, unknown>).slides;
  return Array.isArray(slides) ? slides[slideIndex] ?? null : null;
};

export const getPresentationFonts = (presentationData: unknown) => {
  if (!presentationData || typeof presentationData !== "object") {
    return undefined;
  }
  return (presentationData as Record<string, unknown>).fonts;
};

export const clonePreviewSlide = (slide: unknown) => {
  if (!slide) return null;
  try {
    return structuredClone(slide);
  } catch {
    try {
      return JSON.parse(JSON.stringify(slide)) as unknown;
    } catch {
      return null;
    }
  }
};

const URL_PATTERN =
  /(https?:\/\/[^\s<>"']+\.[^\s<>"']+|www\.[^\s<>"']+\.[^\s<>"']+)/gi;
const IMAGE_READ_INTENT_PATTERN =
  /\b(read|extract|parse|analy[sz]e|summari[sz]e|ocr|text|table|chart|data|numbers?|metrics?)\b/i;
const IMAGE_EXTENSION_PATTERN = /\.(jpe?g|png|gif|bmp|tiff?|webp)$/i;
const ATTACHMENT_CONTENT_LIMIT = 2000;

export function pullLinksFromText(text: string) {
  const links: ChatLink[] = [];
  const cleanText = text.replace(URL_PATTERN, (match) => {
    const url = match.replace(/[.,;:!?)}\]]+$/g, "");
    links.push({
      id: createMessageId(),
      url: url.startsWith("www.") ? `https://${url}` : url,
    });
    return match.slice(url.length);
  });
  return { cleanText, links };
}

export function appendInputText(previous: string, next: string) {
  if (!next) return previous;
  if (!previous) return next.trimStart();
  if (/\s$/.test(previous) || /^\s/.test(next)) return `${previous}${next}`;
  return `${previous} ${next}`;
}

export function isImageFile(file: File) {
  return (
    file.type.startsWith("image/") || IMAGE_EXTENSION_PATTERN.test(file.name)
  );
}

export function shouldReadAttachedImages(message: string) {
  return IMAGE_READ_INTENT_PATTERN.test(message);
}

export function trimAttachmentContent(content: string) {
  if (content.length <= ATTACHMENT_CONTENT_LIMIT) return content;
  return `${content.slice(0, ATTACHMENT_CONTENT_LIMIT)}\n[Attachment truncated]`;
}

export function buildChatDocumentAttachments(
  documents: ChatDocumentAttachment[],
): ChatAttachment[] {
  return documents.map((document) => ({
    type: "document",
    name: document.name,
    file_path: document.filePath,
    mime_type: document.mimeType || null,
  }));
}

export function hasDraggedFiles(event: DragEvent<HTMLElement>) {
  return (
    Array.from(event.dataTransfer.types ?? []).includes("Files") ||
    event.dataTransfer.files.length > 0 ||
    Array.from(event.dataTransfer.items ?? []).some(
      (item) => item.kind === "file",
    )
  );
}

export function getDroppedFileUri(event: DragEvent<HTMLElement>) {
  if (!Array.from(event.dataTransfer.types ?? []).includes("text/uri-list")) {
    return "";
  }
  return event.dataTransfer.getData("text/uri-list");
}

export async function readDecomposedFile(filePath: string) {
  const response = await fetch("/api/read-file", {
    method: "POST",
    body: JSON.stringify({ filePath }),
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result?.error || "Failed to read document.");
  }
  return result?.content || "";
}

export const conversationStorageKey = (
  scope: string,
  resourceId: string,
  presentationType: "standard" | "smart",
) => `presenton:chat:${scope}:${presentationType}:conversationId:${resourceId}`;

export const readStoredConversationId = (key: string) => {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
};

export const storeConversationId = (key: string, conversationId: string) => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, conversationId);
  } catch {
    // Chat history still works from the server when browser storage is blocked.
  }
};

export const removeStoredConversationId = (key: string) => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Nothing else needs to be cleared when browser storage is unavailable.
  }
};
