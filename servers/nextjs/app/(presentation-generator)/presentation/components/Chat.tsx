"use client";

import {
  ArrowUp,
  ChevronDown,
  ChevronRight,
  FileText,
  Image as ImageIcon,
  Link as LinkIcon,
  Loader2,
  Plus,
  RefreshCw,
  Square,
  X,
  UserRound,
} from "lucide-react";
import React, {
  ChangeEvent,
  ClipboardEvent,
  DragEvent,
  FormEvent,
  KeyboardEvent,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import { notify } from "@/components/ui/sonner";
import { useDispatch, useSelector } from "react-redux";
import MarkdownRenderer from "@/components/MarkDownRender";
import { ImagesApi } from "../../services/api/images";
import { PresentationGenerationApi } from "../../services/api/presentation-generation";
import { PresentationChatApi } from "../../services/api/chat";
import {
  PRESENTON_BLANK_SLIDE_PROMPT_EVENT,
  type BlankSlidePromptEventDetail,
} from "../../_shared/blank-slide-prompt-event";
import type {
  ChatAttachment,
  ChatConversationSummary,
  ChatHistoryMessage,
  ChatMessageResponse,
  ChatStreamHandlers,
  ChatStreamTrace,
} from "../../services/api/chat";
import ToolTip from "@/components/ToolTip";
import { cn } from "@/lib/utils";
import type { TemplateV2SurfaceSelectedDetail } from "@/components/slide-editor/events/events";
import type { TemplateV2Layout } from "@/components/slide-editor/importing/template-v2-import";
import {
  MAX_NUMBER_OF_SLIDES,
  MAX_OUTLINE_CONTENT_WORDS,
} from "@/utils/presentationLimits";
import { bucketMessageLength, sanitizeAnalyticsError } from "@/utils/analytics";
import { MixpanelEvent, trackEvent } from "@/utils/mixpanel";
import { TemplateV2HtmlSlidePreview } from "../../components/TemplateV2HtmlSlidePreview";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { LLM_PROVIDERS } from "@/utils/providerConstants";
import type { LLMConfig } from "@/types/llm_config";
import type { AppDispatch, RootState } from "@/store/store";
import {
  setPresentationData,
  type PresentationData,
} from "@/store/slices/presentationGeneration";

const suggestions: { id: string; icon: ReactNode; suggestion: string }[] = [
  {
    id: "generate",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        aria-hidden="true"
      >
        <g clipPath="url(#chat-suggestion-generate)">
          <path
            d="M10.82 1.82039L10.18 1.18039C10.1238 1.12355 10.0568 1.07842 9.98299 1.04763C9.90918 1.01683 9.83 1.00098 9.75002 1.00098C9.67005 1.00098 9.59087 1.01683 9.51706 1.04763C9.44325 1.07842 9.37628 1.12355 9.32002 1.18039L1.18002 9.32039C1.12318 9.37665 1.07806 9.44362 1.04726 9.51743C1.01647 9.59123 1.00061 9.67041 1.00061 9.75039C1.00061 9.83036 1.01647 9.90954 1.04726 9.98335C1.07806 10.0572 1.12318 10.1241 1.18002 10.1804L1.82002 10.8204C1.87593 10.8778 1.94279 10.9235 2.01664 10.9547C2.0905 10.9859 2.16985 11.0019 2.25002 11.0019C2.33019 11.0019 2.40955 10.9859 2.4834 10.9547C2.55726 10.9235 2.62411 10.8778 2.68002 10.8204L10.82 2.68039C10.8775 2.62448 10.9231 2.55762 10.9543 2.48377C10.9855 2.40991 11.0016 2.33056 11.0016 2.25039C11.0016 2.17022 10.9855 2.09087 10.9543 2.01701C10.9231 1.94316 10.8775 1.8763 10.82 1.82039Z"
            stroke="#7F22FE"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M7 3.5L8.5 5"
            stroke="#7F22FE"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M2.5 3V5"
            stroke="#7F22FE"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M9.5 7V9"
            stroke="#7F22FE"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M5 1V2"
            stroke="#7F22FE"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M3.5 4H1.5"
            stroke="#7F22FE"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M10.5 8H8.5"
            stroke="#7F22FE"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M5.5 1.5H4.5"
            stroke="#7F22FE"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
        <defs>
          <clipPath id="chat-suggestion-generate">
            <rect width="12" height="12" fill="white" />
          </clipPath>
        </defs>
      </svg>
    ),
    suggestion: "Generate a full presentation from my topic",
  },
  {
    id: "improve",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        aria-hidden="true"
      >
        <g clipPath="url(#chat-suggestion-improve)">
          <path
            d="M4.96847 7.75012C4.92383 7.57709 4.83364 7.41918 4.70728 7.29282C4.58092 7.16646 4.42301 7.07626 4.24997 7.03162L1.18247 6.24062C1.13014 6.22577 1.08407 6.19425 1.05128 6.15085C1.01848 6.10744 1.00073 6.05453 1.00073 6.00012C1.00073 5.94572 1.01848 5.89281 1.05128 5.8494C1.08407 5.806 1.13014 5.77448 1.18247 5.75962L4.24997 4.96812C4.42294 4.92353 4.58082 4.83341 4.70717 4.70714C4.83353 4.58088 4.92375 4.42307 4.96847 4.25012L5.75947 1.18262C5.77417 1.13008 5.80566 1.0838 5.84913 1.05082C5.8926 1.01785 5.94566 1 6.00022 1C6.05478 1 6.10784 1.01785 6.15131 1.05082C6.19478 1.0838 6.22627 1.13008 6.24097 1.18262L7.03147 4.25012C7.07611 4.42316 7.1663 4.58107 7.29266 4.70743C7.41902 4.83379 7.57693 4.92399 7.74997 4.96862L10.8175 5.75912C10.8702 5.77367 10.9167 5.80513 10.9499 5.84866C10.983 5.8922 11.001 5.94541 11.001 6.00012C11.001 6.05484 10.983 6.10805 10.9499 6.15159C10.9167 6.19512 10.8702 6.22657 10.8175 6.24112L7.74997 7.03162C7.57693 7.07626 7.41902 7.16646 7.29266 7.29282C7.1663 7.41918 7.07611 7.57709 7.03147 7.75012L6.24047 10.8176C6.22577 10.8702 6.19428 10.9165 6.15081 10.9494C6.10734 10.9824 6.05428 11.0002 5.99972 11.0002C5.94516 11.0002 5.8921 10.9824 5.84863 10.9494C5.80516 10.9165 5.77367 10.8702 5.75897 10.8176L4.96847 7.75012Z"
            stroke="#155DFC"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M10 1.5V3.5"
            stroke="#155DFC"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M11 2.5H9"
            stroke="#155DFC"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M2 8.5V9.5"
            stroke="#155DFC"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M2.5 9H1.5"
            stroke="#155DFC"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
        <defs>
          <clipPath id="chat-suggestion-improve">
            <rect width="12" height="12" fill="white" />
          </clipPath>
        </defs>
      </svg>
    ),
    suggestion: "Improve this slide content",
  },
  {
    id: "rewrite",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M6 10H10.5"
          stroke="#009966"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M8.18799 1.81087C8.38703 1.61182 8.657 1.5 8.93849 1.5C9.21998 1.5 9.48994 1.61182 9.68899 1.81087C9.88803 2.00991 9.99986 2.27988 9.99986 2.56137C9.99986 2.84286 9.88803 3.11282 9.68899 3.31187L3.68399 9.31737C3.56504 9.43632 3.418 9.52333 3.25649 9.57037L1.82049 9.98937C1.77746 10.0019 1.73186 10.0027 1.68844 9.99155C1.64503 9.98042 1.6054 9.95783 1.57371 9.92614C1.54202 9.89445 1.51943 9.85483 1.50831 9.81141C1.49719 9.768 1.49794 9.72239 1.51049 9.67937L1.92949 8.24337C1.9766 8.08203 2.06361 7.93518 2.18249 7.81637L8.18799 1.81087Z"
          stroke="#009966"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    suggestion: "Rewrite this content professionally",
  },
  {
    id: "notes",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M1.5 1.5V9.5C1.5 9.76522 1.60536 10.0196 1.79289 10.2071C1.98043 10.3946 2.23478 10.5 2.5 10.5H10.5"
          stroke="#E17100"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M9 8.5V4.5"
          stroke="#E17100"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M6.5 8.5V2.5"
          stroke="#E17100"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M4 8.5V7"
          stroke="#E17100"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    suggestion: "Add speaker notes to this slide",
  },
];

const outlineQuickPrompts = [
  "Expand outline",
  "Shorten outline",
  "Reorder sections",
  "Merge similar slides",
  "Split large sections",
  "Improve conclusion",
  "Improve introduction",
];

const presentationQuickPrompts = [
  "Create an executive summary",
  "Strengthen the story flow",
  "Add data and citations",
  "Create speaker notes",
];

const templateV2QuickPrompts = [
  "Improve this slide's layout",
  "Rewrite this slide for executives",
  "Add a supporting visual",
  "Make the deck visually consistent",
  "Add data and source citations",
  "Create speaker notes for this slide",
];

const editorQuickPrompts = [
  "Rewrite for executives",
  "Improve slide layout",
  "Add data & citations",
  "Create speaker notes",
  "Make the deck consistent",
];

const outlineEditorQuickPrompts = [
  "Strengthen the story flow",
  "Make the outline concise",
  "Reorder the sections",
  "Merge similar slides",
  "Improve the conclusion",
];

const quickPromptGroups = [
  {
    label: "Popular",
    prompts: ["Make it shorter", "Make this smaller", "Generate a new image and replace this one"],
  },
  {
    label: "Add Data",
    prompts: ["Add data and citations", "Add a chart", "Add a table"],
  },
  {
    label: "Add Visuals",
    prompts: ["Generate a new image and replace this one", "Add a chart", "Add a table"],
  },
];

const outlineQuickPromptGroups = [
  {
    label: "Popular",
    prompts: [
      "Make the outline shorter",
      "Expand the outline",
      "Strengthen the story flow",
    ],
  },
  {
    label: "Structure",
    prompts: [
      "Reorder the sections",
      "Merge similar slides",
      "Split large sections",
    ],
  },
  {
    label: "Refine Content",
    prompts: [
      "Rewrite for executives",
      "Improve the introduction",
      "Improve the conclusion",
    ],
  },
];

const getSelectedTextModel = (config: LLMConfig) => {
  switch (config.LLM) {
    case "openai":
      return config.OPENAI_MODEL;
    case "deepseek":
      return config.DEEPSEEK_MODEL;
    case "google":
      return config.GOOGLE_MODEL;
    case "vertex":
      return config.VERTEX_MODEL;
    case "azure":
      return config.AZURE_OPENAI_MODEL;
    case "bedrock":
      return config.BEDROCK_MODEL;
    case "openrouter":
      return config.OPENROUTER_MODEL;
    case "fireworks":
      return config.FIREWORKS_MODEL;
    case "together":
      return config.TOGETHER_MODEL;
    case "cerebras":
      return config.CEREBRAS_MODEL;
    case "litellm":
      return config.LITELLM_MODEL;
    case "lmstudio":
      return config.LMSTUDIO_MODEL;
    case "anthropic":
      return config.ANTHROPIC_MODEL;
    case "ollama":
      return config.OLLAMA_MODEL;
    case "custom":
      return config.CUSTOM_MODEL;
    case "codex":
      return config.CODEX_MODEL;
    default:
      return undefined;
  }
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "error";
  content: string;
  toolCalls?: string[];
  activity?: AssistantActivity[];
  layoutPreview?: ChatLayoutPreview;
  editPreview?: ChatEditPreview;
};

type ChatEditPreview = {
  originalSlides: unknown[];
  modifiedSlides?: unknown[];
  slideIndices: number[];
  changeCount: number;
};

type ChatLayoutPreview = {
  layout: TemplateV2Layout;
  layoutId?: string | null;
  slideIndex?: number | null;
};

type SubmitMessageOptions = {
  backendContext?: string;
  layoutPreview?: ChatLayoutPreview;
};

type PastedChatImage = {
  id: string;
  name: string;
  url: string;
  file?: File;
  extractedText?: string;
};

type ChatLink = {
  id: string;
  url: string;
};

type ChatDocumentAttachment = {
  id: string;
  name: string;
  filePath: string;
  mimeType?: string;
};

type ChatProps = {
  presentationId: string;
  presentationData?: unknown;
  resourceId?: string;
  chatAdapter?: ChatApiAdapter;
  conversationStorageScope?: string;
  resourceLabel?: string;
  variant?: "presentation" | "outline" | "template-v2";
  useEditorLayout?: boolean;
  inputDisabled?: boolean;
  currentSlide?: number;
  selectedTemplateV2Target?: TemplateV2SurfaceSelectedDetail["selection"];
  onClearChatSlideReference?: () => void;
  onClearChatTargetReference?: () => void;
  onBeforeSend?: () => Promise<void> | void;
  onPresentationChanged?: () => Promise<void> | void;
  onChatMutationStateChange?: (isMutating: boolean) => void;
  onAgentSlideFocus?: (focus: {
    slideIndex: number;
    eventId: string;
    tool?: string;
    status?: string;
    isMutatingTool: boolean;
  }) => void;
  onChatSendingStateChange?: (isSending: boolean) => void;
  onFollowModeChange?: (isEnabled: boolean) => void;
};

export type ChatApiAdapter = {
  listConversations: (resourceId: string) => Promise<ChatConversationSummary[]>;
  getHistory: (
    resourceId: string,
    conversationId: string
  ) => Promise<{ messages: ChatHistoryMessage[] }>;
  deleteConversation: (
    resourceId: string,
    conversationId: string
  ) => Promise<void>;
  streamMessage: (
    payload: {
      resourceId: string;
      message: string;
      conversation_id?: string;
      attachments?: ChatAttachment[];
    },
    handlers?: ChatStreamHandlers,
    options?: { signal?: AbortSignal }
  ) => Promise<ChatMessageResponse>;
};

const presentationChatAdapter: ChatApiAdapter = {
  listConversations: (resourceId) =>
    PresentationChatApi.listConversations(resourceId),
  getHistory: (resourceId, conversationId) =>
    PresentationChatApi.getHistory(resourceId, conversationId),
  deleteConversation: (resourceId, conversationId) =>
    PresentationChatApi.deleteConversation(resourceId, conversationId),
  streamMessage: (payload, handlers, options) =>
    PresentationChatApi.streamMessage(
      {
        presentation_id: payload.resourceId,
        message: payload.message,
        conversation_id: payload.conversation_id,
        attachments: payload.attachments,
      },
      handlers,
      options
    ),
};

type AssistantActivity = {
  id: string;
  label: string;
  kind?: string;
  round?: number;
  tool?: string;
  state: "running" | "success" | "error" | "info";
};

type AssistantPromptMetrics = {
  startedAt: number;
  attachmentImageCount: number;
  attachmentDocumentCount: number;
  linkCount: number;
  mutatingToolCount: number;
  readToolCount: number;
  uniqueTools: Set<string>;
  mutatedSlides: Set<number>;
};

const createMessageId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const createChatLayoutPreviewSlide = (preview: ChatLayoutPreview) => ({
  id: `chat-layout-preview-${preview.slideIndex ?? "slide"}`,
  content: {},
  ui: preview.layout,
  layout: preview.layoutId || "chat-layout-preview",
  layout_group: "template-v2",
});

const getPresentationSlide = (presentationData: unknown, slideIndex: number) => {
  if (!presentationData || typeof presentationData !== "object") return null;
  const slides = (presentationData as Record<string, unknown>).slides;
  return Array.isArray(slides) ? slides[slideIndex] ?? null : null;
};

const getPresentationFonts = (presentationData: unknown) => {
  if (!presentationData || typeof presentationData !== "object") return undefined;
  return (presentationData as Record<string, unknown>).fonts;
};

const clonePreviewSlide = (slide: unknown) => {
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

function pullLinksFromText(text: string) {
  const links: ChatLink[] = [];
  const cleanText = text
    .replace(URL_PATTERN, (match) => {
      const url = match.replace(/[.,;:!?)}\]]+$/g, "");
      links.push({
        id: createMessageId(),
        url: url.startsWith("www.") ? `https://${url}` : url,
      });
      return match.slice(url.length);
    });
  return { cleanText, links };
}

function appendInputText(previous: string, next: string) {
  if (!next) return previous;
  if (!previous) return next.trimStart();
  if (/\s$/.test(previous) || /^\s/.test(next)) return `${previous}${next}`;
  return `${previous} ${next}`;
}

function isImageFile(file: File) {
  return (
    file.type.startsWith("image/") || IMAGE_EXTENSION_PATTERN.test(file.name)
  );
}

function shouldReadAttachedImages(message: string) {
  return IMAGE_READ_INTENT_PATTERN.test(message);
}

function trimAttachmentContent(content: string) {
  if (content.length <= ATTACHMENT_CONTENT_LIMIT) return content;
  return `${content.slice(0, ATTACHMENT_CONTENT_LIMIT)}\n[Attachment truncated]`;
}

function buildChatDocumentAttachments(
  documents: ChatDocumentAttachment[]
): ChatAttachment[] {
  return documents.map((document) => ({
    type: "document",
    name: document.name,
    file_path: document.filePath,
    mime_type: document.mimeType || null,
  }));
}

function hasDraggedFiles(event: DragEvent<HTMLElement>) {
  return (
    Array.from(event.dataTransfer.types ?? []).includes("Files") ||
    event.dataTransfer.files.length > 0 ||
    Array.from(event.dataTransfer.items ?? []).some(
      (item) => item.kind === "file"
    )
  );
}

function getDroppedFileUri(event: DragEvent<HTMLElement>) {
  if (!Array.from(event.dataTransfer.types ?? []).includes("text/uri-list")) {
    return "";
  }
  return event.dataTransfer.getData("text/uri-list");
}

async function readDecomposedFile(filePath: string) {
  if (typeof window !== "undefined" && window.electron?.readFile) {
    const result = await window.electron.readFile(filePath);
    return typeof result === "string" ? result : result?.content || "";
  }

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

const conversationStorageKey = (scope: string, resourceId: string) =>
  `presenton:chat:${scope}:conversationId:${resourceId}`;

const readStoredConversationId = (key: string) => {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
};

const storeConversationId = (key: string, conversationId: string) => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, conversationId);
  } catch {
    // Chat history still works from the server when browser storage is blocked.
  }
};

const removeStoredConversationId = (key: string) => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Nothing else needs to be cleared when browser storage is unavailable.
  }
};

const AssistantSparkleIcon = ({ size = 14 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 14 14"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M6.9 1.1c.22 3.03 1.37 4.17 4.4 4.4-3.03.22-4.18 1.37-4.4 4.4-.22-3.03-1.37-4.18-4.4-4.4 3.03-.23 4.18-1.37 4.4-4.4Z"
      fill="#7A5AF8"
    />
    <path
      d="M11.2 9.4c.1 1.42.64 1.96 2.06 2.06-1.42.1-1.96.64-2.06 2.06-.1-1.42-.64-1.96-2.06-2.06 1.42-.1 1.96-.64 2.06-2.06Z"
      fill="#6172F3"
    />
  </svg>
);

const AssistantMarker = () => (
  <div className="mb-2 flex items-center gap-1.5 text-[#8A8F98]">
    <AssistantSparkleIcon size={14} />
    <span className="text-[11px] font-medium leading-4">Assistant</span>
  </div>
);

const ActivityStatusIcon = ({ activity }: { activity: AssistantActivity }) => {
  if (activity.state === "running") {
    return (
      <span
        className="activity-flow-dots mt-1 relative h-[9px] w-[22px] shrink-0"
        aria-label="Working"
      >
        <span className="absolute left-0 top-[1.5px] h-[6px] w-[6px] rounded-full bg-[#C3C3CB]" />
        <span className="absolute left-[8px] top-[1.5px] h-[6px] w-[6px] rounded-full bg-[#C3C3CB]" />
        <span className="absolute left-[16px] top-[1.5px] h-[6px] w-[6px] rounded-full bg-[#C3C3CB]" />
      </span>
    );
  }

  if (activity.state === "error") {
    return <span className="h-2 w-2 shrink-0 rounded-full bg-[#F04438]" />;
  }

  return <span className="h-2 w-2 shrink-0 rounded-full bg-[#E6E6E6]" />;
};

const QuickPromptsPanel = ({
  onPromptSelect,
  groups = quickPromptGroups,
}: {
  onPromptSelect: (prompt: string) => void;
  groups?: typeof quickPromptGroups;
}) => (
  <div className="flex flex-col gap-6 font-syne">
    <AssistantSparkleIcon size={24} />
    <div className="flex flex-col gap-5">
      {groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-2">
          <p className="text-sm font-normal tracking-[0.28px] text-[#333333]">
            {group.label}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {group.prompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => onPromptSelect(prompt)}
                className="rounded-full border border-black/[0.04] bg-black/[0.02] px-4 py-1.5 font-manrope text-xs font-normal tracking-[0.24px] text-[#333333] outline-none transition-colors hover:border-[#D9D6FE] hover:bg-[#FAFAFF] hover:text-[#7A5AF8] focus:border-[#7A5AF8] focus:outline-none focus:ring-0 focus-visible:border-[#7A5AF8] focus-visible:text-[#7A5AF8] focus-visible:outline-none focus-visible:ring-0 active:border-[#7A5AF8] active:text-[#7A5AF8]"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);

const EditComparisonPreview = ({
  preview,
  fonts,
  selectedVersion,
  isApplying,
  onSelectVersion,
}: {
  preview: ChatEditPreview;
  fonts?: unknown;
  selectedVersion: "original" | "modified";
  isApplying: boolean;
  onSelectVersion: (version: "original" | "modified") => void;
}) => {
  if (!preview.modifiedSlides?.length) return null;

  const cards = [
    { label: "Original", slides: preview.originalSlides, version: "original" as const },
    { label: "Modified", slides: preview.modifiedSlides, version: "modified" as const },
  ];

  return (
    <div className="flex w-full flex-col gap-2 font-manrope">
      <div className="flex items-center gap-1 text-[13px] leading-[18px]">
        <Image
          src="/frame.svg"
          alt=""
          width={14}
          height={14}
          className="h-[14px] w-[14px] shrink-0"
        />
        <span className="font-semibold text-[#191919]">Select edits</span>
        <span className="ml-auto text-[11px] font-medium leading-[normal] text-[#7A5AF8]">
          {preview.changeCount} {preview.changeCount === 1 ? "Change" : "Changes"}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-[5px]">
        {cards.map((card) => (
          <button
            key={card.label}
            type="button"
            onClick={() => onSelectVersion(card.version)}
            disabled={isApplying}
            className={cn(
              "min-w-0 overflow-hidden rounded-[6px] border bg-[#F9FAFB] px-[6px] py-[10px] text-left transition-[border-color,background-color,box-shadow,opacity] hover:border-[#B7ACFC] disabled:cursor-wait disabled:opacity-70",
              selectedVersion === card.version
                ? "border-[#7A5AF8] bg-[#FAFAFF]"
                : "border-[#EDEEEF]",
            )}
            aria-pressed={selectedVersion === card.version}
            aria-label={`Restore ${card.label.toLowerCase()} slide state`}
          >
            <span className="mb-[7px] flex items-center justify-center gap-1 truncate text-center text-[13px] font-medium leading-[normal] text-[#191919]">
              {isApplying && selectedVersion === card.version && (
                <Loader2 className="h-3 w-3 animate-spin text-[#7A5AF8]" />
              )}
              <span>{card.label}</span>
            </span>
            <span className="flex flex-col gap-[3px]">
              {card.slides.slice(0, 2).map((slide, index) => (
                <TemplateV2HtmlSlidePreview
                  key={`${card.label}-${index}`}
                  slide={slide}
                  fonts={fonts}
                  className="overflow-hidden rounded-[2px] border border-[#EDEEEF] bg-white"
                />
              ))}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

const TOOL_LABELS: Record<string, string> = {
  addOutline: "Outline adder",
  updateOutline: "Outline editor",
  deleteOutline: "Outline remover",
  addNewSlide: "Blank slide adder",
  addNewSlideLayout: "Layout slide adder",
  getAvailableLayouts: "Layout finder",
  getTemplateSummary: "Template reader",
  readSourceDocuments: "Source document reader",
  searchSlide: "Slide search",
  getSlideAtIndex: "Slide reader",
  saveSlide: "Slide saver",
  updateSlide: "Slide updater",
  deleteSlide: "Slide remover",
  addElement: "Element adder",
  updateElement: "Element updater",
  deleteElement: "Element remover",
  addComponent: "Component adder",
  createComponent: "Component creator",
  updateComponent: "Component updater",
  deleteComponent: "Component remover",
  getPresentationTheme: "Theme reader",
  setPresentationTheme: "Theme applier",
  generateAssets: "Asset generator",
};

const MUTATING_TOOLS = new Set([
  "addOutline",
  "updateOutline",
  "deleteOutline",
  "addNewSlide",
  "addNewSlideLayout",
  "saveSlide",
  "updateSlide",
  "deleteSlide",
  "addElement",
  "updateElement",
  "deleteElement",
  "addComponent",
  "createComponent",
  "updateComponent",
  "deleteComponent",
  "setPresentationTheme",
]);
// Only focus slides when the agent is actively mutating them.
// Read/open traces (e.g. getSlideAtIndex) can happen ahead of edits and feel jumpy.
const SLIDE_FOCUS_TOOLS = new Set([
  "addNewSlide",
  "addNewSlideLayout",
  "saveSlide",
  "updateSlide",
  "deleteSlide",
  "addElement",
  "updateElement",
  "deleteElement",
  "addComponent",
  "createComponent",
  "updateComponent",
  "deleteComponent",
]);
const SLIDE_FOCUS_STATUSES = new Set(["start"]);
const MIN_SLIDE_FOCUS_DWELL_MS = 700;

const getToolLabel = (tool?: string) => {
  if (!tool) {
    return "";
  }
  return TOOL_LABELS[tool] ?? tool;
};

const humanizeTraceMessage = (message: string, tool?: string) => {
  const trimmed = message.trim();
  if (!trimmed) {
    return "";
  }

  const lower = trimmed.toLowerCase();
  if (lower === "reading deck context") {
    return "Reviewing your presentation context.";
  }
  if (lower === "reading the presentation outline") {
    return "Reading the presentation outline.";
  }
  if (lower === "reading the outline draft") {
    return "Reading the outline draft.";
  }
  if (lower === "adding an outline slide") {
    return "Adding an outline slide.";
  }
  if (lower === "updating the outline slide") {
    return "Updating the outline slide.";
  }
  if (lower === "deleting the outline slide") {
    return "Deleting the outline slide.";
  }
  if (lower === "reordering outline slides") {
    return "Reordering outline slides.";
  }
  if (lower === "searching relevant slides") {
    return "Searching slides for relevant content.";
  }
  if (lower === "opening the requested slide") {
    return "Opening the selected slide.";
  }
  if (lower === "checking available themes") {
    return "Checking available color themes.";
  }
  if (lower === "checking available layouts") {
    return "Checking available layouts.";
  }
  if (lower === "checking the layout schema") {
    return "Validating the slide schema.";
  }
  if (lower === "generating slide assets") {
    return "Generating images and icons.";
  }
  if (lower === "saving the slide") {
    return "Saving slide updates.";
  }
  if (lower === "deleting the slide") {
    return "Deleting the slide.";
  }
  if (lower === "applying presentation theme") {
    return "Applying the selected theme.";
  }
  if (lower === "reading template structure") {
    return "Reading the template structure.";
  }
  if (lower === "reading source documents") {
    return "Reading the source documents.";
  }
  if (lower === "opening the requested template slide") {
    return "Opening the selected template slide.";
  }
  if (lower === "searching template content") {
    return "Searching template content.";
  }
  if (lower === "finding editable elements") {
    return "Finding editable elements.";
  }
  if (lower === "updating template content") {
    return "Updating template content.";
  }
  if (lower === "deleting the template component") {
    return "Deleting the selected component.";
  }
  if (lower === "swapping component variant") {
    return "Swapping the component variant.";
  }
  if (lower.startsWith("using tools:")) {
    const toolNames = trimmed
      .slice("using tools:".length)
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => getToolLabel(entry));
    return toolNames.length === 0
      ? "Planning the next step."
      : "Choosing the best way to help.";
  }
  if (lower.includes("found requested data")) {
    if (tool === "getSlideAtIndex") {
      return "Found the requested slide details.";
    }
    return "Found the requested information.";
  }
  if (lower.endsWith("completed.")) {
    return trimmed;
  }
  if (lower.includes("failed")) {
    return trimmed;
  }
  return trimmed;
};

const inferStatusState = (status: string): AssistantActivity["state"] => {
  const normalized = status.trim().toLowerCase();
  if (
    normalized.includes("preparing") ||
    normalized.includes("thinking") ||
    normalized.includes("reading") ||
    normalized.includes("searching") ||
    normalized.includes("opening") ||
    normalized.includes("generating") ||
    normalized.includes("processing") ||
    normalized.includes("finalizing") ||
    normalized.includes("saving")
  ) {
    return "running";
  }

  return "info";
};

const isAbortError = (error: unknown) =>
  (error instanceof DOMException && error.name === "AbortError") ||
  (error instanceof Error &&
    error.message.toLowerCase().includes("aborted") &&
    error.message.toLowerCase().includes("request"));

const stripBackendContextFromUserMessage = (rawMessage: string) => {
  const message = rawMessage ?? "";
  if (!message.startsWith("UI context:")) {
    return message;
  }

  const marker = "\nUser message:";
  const markerIndex = message.indexOf(marker);
  if (markerIndex === -1) {
    return message;
  }

  return message.slice(markerIndex + marker.length).trimStart();
};

const formatTraceActivity = (
  trace: ChatStreamTrace
): Omit<AssistantActivity, "id"> | null => {
  if (typeof trace.message === "string" && trace.message.trim().length > 0) {
    return {
      label: humanizeTraceMessage(trace.message, trace.tool),
      kind: trace.kind,
      round: trace.round,
      tool: trace.tool,
      state:
        trace.status === "error"
          ? "error"
          : trace.status === "success"
            ? "success"
            : trace.status === "ready" || trace.status === "info"
              ? "info"
              : "running",
    };
  }

  if (trace.tool && trace.status === "start") {
    return {
      label: humanActivityForTool(trace.tool, "start"),
      kind: trace.kind,
      round: trace.round,
      tool: trace.tool,
      state: "running",
    };
  }

  if (trace.tool && trace.status === "success") {
    return {
      label: humanActivityForTool(trace.tool, "success"),
      kind: trace.kind,
      round: trace.round,
      tool: trace.tool,
      state: "success",
    };
  }

  if (trace.tool && trace.status === "error") {
    return {
      label: "I could not finish that step.",
      kind: trace.kind,
      round: trace.round,
      tool: trace.tool,
      state: "error",
    };
  }

  if (
    trace.kind === "tool_plan" &&
    Array.isArray(trace.tools) &&
    trace.tools.length
  ) {
    return {
      label: "Planning the next step.",
      kind: trace.kind,
      round: trace.round,
      state: "info",
    };
  }

  return null;
};

const humanActivityForTool = (
  tool: string | undefined,
  state: "start" | "success"
) => {
  const isDone = state === "success";
  switch (tool) {
    case "searchSlide":
      return isDone ? "Found the relevant content." : "Looking through the content.";
    case "getSlideAtIndex":
      return isDone ? "Checked the slide." : "Checking the slide.";
    case "addNewSlide":
    case "addNewSlideLayout":
    case "updateElement":
    case "updateComponent":
    case "addElement":
    case "addComponent":
    case "createComponent":
    case "updateSlide":
    case "saveSlide":
      return isDone ? "Applied the change." : "Applying the change.";
    case "deleteComponent":
    case "deleteElement":
    case "deleteSlide":
      return isDone ? "Removed the selected item." : "Removing the selected item.";
    case "generateAssets":
      return isDone ? "Prepared the visual assets." : "Preparing visual assets.";
    case "setPresentationTheme":
      return isDone ? "Updated the theme." : "Updating the theme.";
    default:
      return isDone ? "Finished that step." : "Working on it.";
  }
};

const readTraceSlideIndex = (trace: ChatStreamTrace) => {
  if (typeof trace.slideIndex === "number" && trace.slideIndex >= 0) {
    return trace.slideIndex;
  }
  if (typeof trace.slideNumber === "number" && trace.slideNumber > 0) {
    return trace.slideNumber - 1;
  }
  return null;
};

const Chat = ({
  presentationId,
  presentationData,
  resourceId,
  chatAdapter = presentationChatAdapter,
  conversationStorageScope = "presentation",
  resourceLabel = "presentation",
  variant = "presentation",
  useEditorLayout = false,
  inputDisabled = false,
  currentSlide,
  selectedTemplateV2Target,
  onClearChatSlideReference,
  onClearChatTargetReference,
  onBeforeSend,
  onPresentationChanged,
  onChatMutationStateChange,
  onAgentSlideFocus,
  onChatSendingStateChange,
  onFollowModeChange,
}: ChatProps) => {
  const dispatch = useDispatch<AppDispatch>();
  const llmConfig = useSelector(
    (state: RootState) => state.userConfig.llm_config,
  );
  const selectedTextModel =
    getSelectedTextModel(llmConfig)?.trim() ||
    LLM_PROVIDERS[llmConfig.LLM || "openai"]?.label ||
    llmConfig.LLM ||
    "AI model";
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isFollowAgentEnabled, setIsFollowAgentEnabled] = useState(true);
  const [hasChatMutationStarted, setHasChatMutationStarted] = useState(false);
  const [activeAssistantMessageId, setActiveAssistantMessageId] = useState<
    string | null
  >(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pastedImages, setPastedImages] = useState<PastedChatImage[]>([]);
  const [attachedDocuments, setAttachedDocuments] = useState<
    ChatDocumentAttachment[]
  >([]);
  const [chatLinks, setChatLinks] = useState<ChatLink[]>([]);
  const [isUploadingPastedImage, setIsUploadingPastedImage] = useState(false);
  const [isDraggingAttachment, setIsDraggingAttachment] = useState(false);
  const [isQuickPromptsOpen, setIsQuickPromptsOpen] = useState(false);
  const [expandedEditPreviewByMessage, setExpandedEditPreviewByMessage] =
    useState<Record<string, boolean>>({});
  const [selectedEditVersionByMessage, setSelectedEditVersionByMessage] =
    useState<Record<string, "original" | "modified">>({});
  const [applyingEditPreviewMessageId, setApplyingEditPreviewMessageId] =
    useState<string | null>(null);
  const chatInputDisabled = inputDisabled || isSending || isHistoryLoading;
  const [expandedActivityByMessage, setExpandedActivityByMessage] = useState<
    Record<string, boolean>
  >({});
  const [hiddenOverlaySlideReference, setHiddenOverlaySlideReference] = useState<
    number | null
  >(null);

  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const submitMessageRef = useRef<
    (message: string, options?: SubmitMessageOptions) => Promise<void>
  >(
    async () => undefined,
  );
  const lastFollowedTraceRef = useRef<string | null>(null);
  const focusEventSequenceRef = useRef(0);
  const activeFocusedSlideRef = useRef<number | null>(null);
  const pendingFocusTraceRef = useRef<ChatStreamTrace | null>(null);
  const lastFocusDispatchAtRef = useRef<number>(0);
  const focusDispatchTimerRef = useRef<number | null>(null);
  const refreshInFlightRef = useRef(false);
  const refreshQueuedRef = useRef(false);
  const didIncrementalRefreshRef = useRef(false);
  const openedAnalyticsKeyRef = useRef<string | null>(null);
  const promptMetricsRef = useRef<AssistantPromptMetrics | null>(null);
  const activeEditPreviewRef = useRef<{
    assistantMessageId: string;
    originalSlidesByIndex: Record<number, unknown>;
    mutatedSlideIndices: number[];
    mutationObserved: boolean;
    changeCount: number;
  } | null>(null);
  const activeResourceId = resourceId ?? presentationId;

  const baseAnalyticsProps = useCallback(
    () => ({
      variant,
      presentation_id: presentationId,
      resource_id: activeResourceId,
      conversation_scope: conversationStorageScope,
    }),
    [activeResourceId, conversationStorageScope, presentationId, variant]
  );

  useEffect(() => {
    if (!activeResourceId) return;
    const key = `${variant}:${activeResourceId}`;
    if (openedAnalyticsKeyRef.current === key) return;
    openedAnalyticsKeyRef.current = key;
    trackEvent(MixpanelEvent.AI_Assistant_Opened, baseAnalyticsProps());
  }, [activeResourceId, baseAnalyticsProps, variant]);

  useEffect(() => {
    let cancelled = false;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setMessages([]);
    setInput("");
    setConversationId(null);
    setIsSending(false);
    setHasChatMutationStarted(false);
    setActiveAssistantMessageId(null);
    setErrorMessage(null);
    setPastedImages([]);
    setAttachedDocuments([]);
    setChatLinks([]);
    setIsUploadingPastedImage(false);
    setIsDraggingAttachment(false);
    setIsQuickPromptsOpen(false);
    setExpandedEditPreviewByMessage({});
    setSelectedEditVersionByMessage({});
    setApplyingEditPreviewMessageId(null);
    setExpandedActivityByMessage({});
    setHiddenOverlaySlideReference(null);
    promptMetricsRef.current = null;
    activeEditPreviewRef.current = null;

    if (!activeResourceId) {
      return;
    }

    setIsHistoryLoading(true);
    const run = async () => {
      try {
        const sKey = conversationStorageKey(
          conversationStorageScope,
          activeResourceId
        );
        const storedId = readStoredConversationId(sKey);
        let conversations: ChatConversationSummary[] | null = null;
        let conversationListError: unknown = null;

        try {
          const listedConversations =
            await chatAdapter.listConversations(activeResourceId);
          conversations = Array.isArray(listedConversations)
            ? listedConversations
            : [];
        } catch (error) {
          conversationListError = error;
        }

        const listedIds = (conversations ?? [])
          .map((conversation) => conversation.conversation_id)
          .filter((id): id is string => typeof id === "string" && id.length > 0);
        const candidateIds = Array.from(
          new Set([...(storedId ? [storedId] : []), ...listedIds])
        );

        if (candidateIds.length === 0) {
          removeStoredConversationId(sKey);
          if (conversationListError) {
            throw conversationListError;
          }
          return;
        }

        let historyError: unknown = null;
        let loadedHistory:
          | { conversationId: string; messages: ChatHistoryMessage[] }
          | null = null;

        for (const candidateId of candidateIds) {
          try {
            const data = await chatAdapter.getHistory(
              activeResourceId,
              candidateId
            );
            if (cancelled) {
              return;
            }
            const rows = Array.isArray(data?.messages) ? data.messages : [];
            if (rows.length > 0) {
              loadedHistory = {
                conversationId: candidateId,
                messages: rows,
              };
              break;
            }
          } catch (error) {
            historyError = error;
          }
        }

        if (!loadedHistory) {
          removeStoredConversationId(sKey);
          if (historyError || conversationListError) {
            throw historyError ?? conversationListError;
          }
          return;
        }

        if (cancelled) {
          return;
        }
        storeConversationId(sKey, loadedHistory.conversationId);
        setConversationId(loadedHistory.conversationId);
        setMessages(
          loadedHistory.messages.map((m) => ({
            id: createMessageId(),
            role:
              m.role === "assistant"
                ? "assistant"
                : m.role === "user"
                  ? "user"
                  : "user",
            content:
              m.role === "user"
                ? stripBackendContextFromUserMessage(m.content)
                : m.content,
          }))
        );
      } catch (error) {
        console.error("Failed to load chat history:", error);
        const detail =
          error instanceof Error
            ? error.message
            : "Could not load previous chat";
        notify.error("Could not load chat", detail);
      } finally {
        if (!cancelled) {
          setIsHistoryLoading(false);
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [activeResourceId, chatAdapter, conversationStorageScope]);

  useEffect(() => {
    const activePreview = activeEditPreviewRef.current;
    if (!activePreview?.mutationObserved) return;
    const modifiedSlides = activePreview.mutatedSlideIndices
      .map((slideIndex) =>
        clonePreviewSlide(getPresentationSlide(presentationData, slideIndex)),
      )
      .filter(Boolean);
    if (modifiedSlides.length === 0) return;

    setMessages((previous) =>
      previous.map((message) =>
        message.id === activePreview.assistantMessageId
          ? {
            ...message,
            editPreview: {
              originalSlides: activePreview.mutatedSlideIndices
                .map(
                  (slideIndex) =>
                    activePreview.originalSlidesByIndex[slideIndex],
                )
                .filter(Boolean),
              modifiedSlides,
              slideIndices: activePreview.mutatedSlideIndices,
              changeCount: Math.max(1, activePreview.changeCount),
            },
          }
          : message,
      ),
    );
    setSelectedEditVersionByMessage((previous) => ({
      ...previous,
      [activePreview.assistantMessageId]:
        previous[activePreview.assistantMessageId] ?? "modified",
    }));
    setExpandedEditPreviewByMessage((previous) => ({
      ...previous,
      [activePreview.assistantMessageId]:
        previous[activePreview.assistantMessageId] ?? true,
    }));
  }, [presentationData]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages, isSending]);

  useEffect(() => {
    setHiddenOverlaySlideReference(null);
  }, [currentSlide]);

  useEffect(() => {
    onChatMutationStateChange?.(hasChatMutationStarted);
  }, [hasChatMutationStarted, onChatMutationStateChange]);

  useEffect(() => {
    onFollowModeChange?.(isFollowAgentEnabled);
  }, [isFollowAgentEnabled, onFollowModeChange]);

  useEffect(() => {
    onChatSendingStateChange?.(isSending);
    if (!isSending) {
      lastFollowedTraceRef.current = null;
      activeFocusedSlideRef.current = null;
      pendingFocusTraceRef.current = null;
      lastFocusDispatchAtRef.current = 0;
      if (focusDispatchTimerRef.current !== null) {
        window.clearTimeout(focusDispatchTimerRef.current);
        focusDispatchTimerRef.current = null;
      }
    }
  }, [isSending, onChatSendingStateChange]);

  useEffect(
    () => () => {
      if (focusDispatchTimerRef.current !== null) {
        window.clearTimeout(focusDispatchTimerRef.current);
      }
    },
    []
  );

  const markChatMutationStarted = (tool: string | undefined) => {
    if (!tool || !MUTATING_TOOLS.has(tool)) {
      return;
    }
    setHasChatMutationStarted(true);
  };

  const emitAgentSlideFocus = useCallback(
    (trace: ChatStreamTrace, targetSlideIndex: number) => {
      if (!onAgentSlideFocus) {
        return;
      }
      focusEventSequenceRef.current += 1;
      onAgentSlideFocus({
        slideIndex: targetSlideIndex,
        eventId: `${Date.now()}-${focusEventSequenceRef.current}`,
        tool: trace.tool,
        status: trace.status,
        isMutatingTool: Boolean(trace.tool && MUTATING_TOOLS.has(trace.tool)),
      });
      activeFocusedSlideRef.current = targetSlideIndex;
      lastFocusDispatchAtRef.current = Date.now();
    },
    [onAgentSlideFocus]
  );

  const flushPendingSlideFocus = useCallback(() => {
    focusDispatchTimerRef.current = null;
    const pendingTrace = pendingFocusTraceRef.current;
    pendingFocusTraceRef.current = null;
    if (!pendingTrace) {
      return;
    }
    const targetSlideIndex = readTraceSlideIndex(pendingTrace);
    if (targetSlideIndex === null) {
      return;
    }
    emitAgentSlideFocus(pendingTrace, targetSlideIndex);
  }, [emitAgentSlideFocus]);

  const schedulePendingSlideFocus = useCallback(() => {
    if (focusDispatchTimerRef.current !== null) {
      return;
    }
    const elapsed = Date.now() - lastFocusDispatchAtRef.current;
    const waitMs = Math.max(MIN_SLIDE_FOCUS_DWELL_MS - elapsed, 0);
    focusDispatchTimerRef.current = window.setTimeout(
      flushPendingSlideFocus,
      waitMs
    );
  }, [flushPendingSlideFocus]);

  const maybeFollowAgentSlide = useCallback(
    (trace: ChatStreamTrace) => {
      if (!trace.tool || !SLIDE_FOCUS_TOOLS.has(trace.tool)) {
        return;
      }
      if (!trace.status || !SLIDE_FOCUS_STATUSES.has(trace.status)) {
        return;
      }

      const targetSlideIndex = readTraceSlideIndex(trace);
      if (targetSlideIndex === null) {
        return;
      }

      const traceSignature = `${trace.round ?? "?"}:${trace.tool}:${trace.status
        }:${targetSlideIndex}`;
      if (lastFollowedTraceRef.current === traceSignature) {
        return;
      }
      lastFollowedTraceRef.current = traceSignature;

      const activeFocusedSlide = activeFocusedSlideRef.current;
      const elapsed = Date.now() - lastFocusDispatchAtRef.current;
      const shouldDispatchImmediately =
        activeFocusedSlide === null ||
        activeFocusedSlide === targetSlideIndex ||
        elapsed >= MIN_SLIDE_FOCUS_DWELL_MS;

      if (shouldDispatchImmediately) {
        pendingFocusTraceRef.current = null;
        if (focusDispatchTimerRef.current !== null) {
          window.clearTimeout(focusDispatchTimerRef.current);
          focusDispatchTimerRef.current = null;
        }
        emitAgentSlideFocus(trace, targetSlideIndex);
        return;
      }

      pendingFocusTraceRef.current = trace;
      schedulePendingSlideFocus();
    },
    [emitAgentSlideFocus, schedulePendingSlideFocus]
  );

  const buildBackendMessage = (
    message: string,
    images = pastedImages,
    additionalContext?: string,
  ) => {
    const contextLines: string[] = [];

    if (variant === "outline") {
      contextLines.push(
        `UI context: the user is editing the outline draft. Use addOutline, updateOutline, and deleteOutline for outline edits. Keep at most ${MAX_NUMBER_OF_SLIDES} outline slides, and keep each outline content within ${MAX_OUTLINE_CONTENT_WORDS} words.`
      );
    }
    if (variant === "template-v2") {
      contextLines.push(
        "UI context: the user is editing a rendered TemplateV2 presentation with the v2 assistant. Use getTemplateSummary, getAvailableLayouts, getAvailableBlocks, searchSlide, getSlideAtIndex, getContentSchemaFromLayoutId, addNewSlide, addNewSlideLayout, saveSlide, updateSlide, deleteSlide, addElement, updateElement, deleteElement, addComponent, createComponent, updateComponent, deleteComponent, getPresentationTheme, setPresentationTheme, readSourceDocuments, and generateAssets. For visible edits inside an existing slide, inspect with getSlideAtIndex and use the returned componentId/elementPath exactly. Use updateElement for element toolbar-style properties and updateComponent for component move, resize, duplicate, layer order, group, and ungroup actions. When adding or creating rendered elements/components, prefer reusable template blocks over primitives: for custom new slides, search getAvailableBlocks for a title/header text block first, then requested chart/table/content blocks, adapt their component JSON, and include the final requested content instead of placeholder blocks. Keep new rendered elements/components strictly inside the 1280x720 visible slide window."
      );
    }

    if (typeof currentSlide === "number") {
      contextLines.push(
        `UI context: the currently selected slide is slide ${currentSlide + 1
        } (zero-based index ${currentSlide}).`
      );
    }

    const trimmedAdditionalContext = additionalContext?.trim();
    if (trimmedAdditionalContext) {
      contextLines.push(
        trimmedAdditionalContext.startsWith("UI context:")
          ? trimmedAdditionalContext
          : `UI context: ${trimmedAdditionalContext}`,
      );
    }

    if (selectedTemplateV2Target?.kind === "multi-component") {
      const target = selectedTemplateV2Target;
      const componentIds = target.componentIds?.filter(Boolean) ?? [];
      const labels =
        target.componentLabels?.filter(Boolean) ??
        target.components.map((component) => component.componentLabel).filter(Boolean);
      contextLines.push(
        `UI context: the user has selected ${target.components.length} TemplateV2 components${labels.length ? ` (${labels.join(", ")})` : ""
        }${componentIds.length ? ` with componentIds=${componentIds.join(",")}` : ""
        }. These selected components are the primary target for short edits like "these", "group these", "remove these", "move them", or "resize them"; do not apply those requests to the whole slide unless the user explicitly says slide. For grouping selected components, inspect the selected slide with getSlideAtIndex, then call updateComponent with action=group, componentId set to one selected component id, and componentIds set to all selected component ids exactly.`
      );
    } else if (selectedTemplateV2Target) {
      const target = selectedTemplateV2Target;
      const targetParts = [
        `kind=${target.kind}`,
        typeof target.slideIndex === "number"
          ? `slideIndex=${target.slideIndex}`
          : "",
        typeof target.componentIndex === "number"
          ? `componentIndex=${target.componentIndex}`
          : "",
        target.componentId ? `componentId=${target.componentId}` : "",
        target.componentLabel ? `componentLabel=${target.componentLabel}` : "",
        target.elementPath ? `elementPath=${target.elementPath}` : "",
        target.elementType ? `elementType=${target.elementType}` : "",
        target.elementName ? `elementName=${target.elementName}` : "",
        target.targetLabel ? `targetLabel=${target.targetLabel}` : "",
      ].filter(Boolean);
      contextLines.push(
        `UI context: the user has selected this TemplateV2 ${target.kind}: ${targetParts.join(
          ", "
        )}. This selected ${target.kind} is the primary target for short edits like "this", "it", "make it smaller", "rewrite it", or "remove it"; do not apply those requests to the whole slide unless the user explicitly says slide. For visible slide edits, inspect the selected slide with getSlideAtIndex and use matching componentId/elementPath exactly. If the selected element is content_editable:false, use position/size for that element or target a content_editable descendant for text/content changes.`
      );
    }

    if (images.length > 0) {
      contextLines.push(
        [
          "UI context: the user attached image(s) to chat for this request. If they ask to add or replace an image, use addElement/updateElement with the exact image URL. If extracted text is provided, use it only for requests that ask to read or analyze the image.",
          ...images.map(
            (image, index) =>
              [
                `Image ${index + 1} (${image.name}): ${image.url}`,
                image.extractedText
                  ? `Extracted image text ${index + 1}:\n${trimAttachmentContent(
                    image.extractedText
                  )}`
                  : "",
              ]
                .filter(Boolean)
                .join("\n")
          ),
        ].join("\n")
      );
    }

    if (chatLinks.length > 0) {
      contextLines.push(
        [
          "UI context: the user added link(s) to chat for this request. Use the exact URL when the user refers to the link.",
          ...chatLinks.map((link, index) => `Link ${index + 1}: ${link.url}`),
        ].join("\n")
      );
    }

    if (contextLines.length === 0) {
      return message;
    }

    return [...contextLines, `User message: ${message}`].join("\n");
  };

  const clearChatUi = () => {
    setMessages([]);
    setInput("");
    setPastedImages([]);
    setAttachedDocuments([]);
    setChatLinks([]);
    setConversationId(null);
    setHasChatMutationStarted(false);
    setErrorMessage(null);
    setExpandedActivityByMessage({});
    setHiddenOverlaySlideReference(null);
    setExpandedEditPreviewByMessage({});
    setSelectedEditVersionByMessage({});
    setApplyingEditPreviewMessageId(null);
    if (activeResourceId) {
      removeStoredConversationId(
        conversationStorageKey(conversationStorageScope, activeResourceId)
      );
    }
    inputRef.current?.focus();
  };

  const resetChat = async () => {
    const conversationIdToDelete = conversationId;
    trackEvent(MixpanelEvent.AI_Assistant_Chat_Reset, {
      ...baseAnalyticsProps(),
      delete_saved_conversation: true,
    });
    clearChatUi();

    if (activeResourceId) {
      const conversationIdsToDelete = new Set<string>();
      if (conversationIdToDelete) {
        conversationIdsToDelete.add(conversationIdToDelete);
      }

      try {
        const savedConversations =
          await chatAdapter.listConversations(activeResourceId);
        savedConversations.forEach((savedConversation) => {
          conversationIdsToDelete.add(savedConversation.conversation_id);
        });
        await Promise.all(
          Array.from(conversationIdsToDelete, (savedConversationId) =>
            chatAdapter.deleteConversation(
              activeResourceId,
              savedConversationId
            )
          )
        );
      } catch (error) {
        console.error("Failed to delete chat conversations:", error);
        const detail =
          error instanceof Error
            ? error.message
            : "Could not delete the saved chat conversations";
        notify.error("Could not delete chat", detail);
      }
    }
  };

  const applyEditPreviewVersion = async (
    messageId: string,
    preview: ChatEditPreview,
    version: "original" | "modified",
  ) => {
    if (applyingEditPreviewMessageId) return;
    if (!presentationData || typeof presentationData !== "object") {
      notify.error("Preview unavailable", "The presentation is not ready yet.");
      return;
    }

    const currentPresentation = presentationData as Record<string, unknown>;
    if (!Array.isArray(currentPresentation.slides)) {
      notify.error("Preview unavailable", "No slide data is available.");
      return;
    }

    const selectedSlides =
      version === "original" ? preview.originalSlides : preview.modifiedSlides;
    if (!selectedSlides?.length) return;

    const previousVersion =
      selectedEditVersionByMessage[messageId] ?? "modified";
    const nextSlides = [...currentPresentation.slides];
    preview.slideIndices.forEach((slideIndex, index) => {
      if (selectedSlides[index]) {
        nextSlides[slideIndex] = clonePreviewSlide(selectedSlides[index]);
      }
    });
    const nextPresentation = {
      ...currentPresentation,
      slides: nextSlides,
    } as unknown as PresentationData;

    if (activeEditPreviewRef.current?.assistantMessageId === messageId) {
      activeEditPreviewRef.current = null;
    }

    setApplyingEditPreviewMessageId(messageId);
    setSelectedEditVersionByMessage((previous) => ({
      ...previous,
      [messageId]: version,
    }));
    onChatMutationStateChange?.(true);
    dispatch(setPresentationData(nextPresentation));

    try {
      for (const slideIndex of preview.slideIndices) {
        const slide = nextSlides[slideIndex];
        if (slide) {
          await PresentationGenerationApi.updatePresentationSlide(slide);
        }
      }
      await onPresentationChanged?.();
      notify.success(
        version === "original" ? "Original restored" : "Changes restored",
        `${preview.slideIndices.length} ${preview.slideIndices.length === 1 ? "slide" : "slides"
        } updated.`,
      );
    } catch (error) {
      dispatch(setPresentationData(presentationData as PresentationData));
      setSelectedEditVersionByMessage((previous) => ({
        ...previous,
        [messageId]: previousVersion,
      }));
      notify.error(
        "Could not restore slides",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      onChatMutationStateChange?.(false);
      setApplyingEditPreviewMessageId(null);
    }
  };

  const refreshPresentationIncrementally = useCallback(async () => {
    if (!onPresentationChanged) {
      return;
    }
    if (refreshInFlightRef.current) {
      refreshQueuedRef.current = true;
      return;
    }

    refreshInFlightRef.current = true;
    didIncrementalRefreshRef.current = true;
    try {
      await onPresentationChanged();
    } catch (error) {
      console.error(
        "Failed to refresh presentation after tool mutation:",
        error
      );
      notify.error("Refresh failed", "Changes were saved, but refresh failed.");
    } finally {
      refreshInFlightRef.current = false;
      if (refreshQueuedRef.current) {
        refreshQueuedRef.current = false;
        void refreshPresentationIncrementally();
      }
    }
  }, [onPresentationChanged]);

  const refreshPresentationIfNeeded = async (toolCalls: string[]) => {
    const hasMutation = toolCalls.some((tool) => MUTATING_TOOLS.has(tool));
    if (
      !hasMutation ||
      !onPresentationChanged ||
      didIncrementalRefreshRef.current
    ) {
      return;
    }

    try {
      await onPresentationChanged();
    } catch (error) {
      console.error("Failed to refresh presentation after chat update:", error);
      notify.error("Refresh failed", "Chat completed, but refresh failed.");
    }
  };

  const appendAssistantActivity = (
    assistantMessageId: string,
    activity: Omit<AssistantActivity, "id">
  ) => {
    const normalizedLabel = activity.label.trim();
    if (!normalizedLabel) {
      return;
    }

    setMessages((previous) =>
      previous.map((message) => {
        if (message.id !== assistantMessageId) {
          return message;
        }

        const currentActivity = message.activity ?? [];
        const lastActivity = currentActivity[currentActivity.length - 1];
        if (
          lastActivity &&
          lastActivity.label === normalizedLabel &&
          lastActivity.state === activity.state
        ) {
          return message;
        }

        const settledActivity: AssistantActivity[] =
          lastActivity && lastActivity.state === "running"
            ? [
              ...currentActivity.slice(0, -1),
              {
                ...lastActivity,
                state:
                  activity.state === "error"
                    ? "error"
                    : ("success" as AssistantActivity["state"]),
              },
            ]
            : currentActivity;

        const lastSettledActivity = settledActivity[settledActivity.length - 1];
        if (
          lastSettledActivity &&
          lastSettledActivity.label === normalizedLabel &&
          lastSettledActivity.state !== activity.state
        ) {
          return {
            ...message,
            activity: [
              ...settledActivity.slice(0, -1),
              {
                ...lastSettledActivity,
                ...activity,
                label: normalizedLabel,
                state: activity.state,
              },
            ],
          };
        }

        return {
          ...message,
          activity: [
            ...settledActivity,
            {
              id: createMessageId(),
              ...activity,
              label: normalizedLabel,
              state: activity.state,
            },
          ],
        };
      })
    );
  };

  const toggleActivityExpanded = (messageId: string) => {
    setExpandedActivityByMessage((previous) => ({
      ...previous,
      [messageId]: !previous[messageId],
    }));
  };

  const stopStreaming = () => {
    abortControllerRef.current?.abort();
  };

  const processTemplateV2Files = async (
    files: File[],
    source: "file_input" | "paste" | "drop" = "file_input"
  ) => {
    if (files.length === 0 || chatInputDisabled) {
      return;
    }
    if (variant !== "template-v2") {
      notify.info("Attachments are available in Template V2 chat.");
      return;
    }

    const imageFiles = files.filter(isImageFile);
    const documentFiles = files.filter((file) => !isImageFile(file));

    setIsUploadingPastedImage(true);
    try {
      if (imageFiles.length > 0) {
        const uploads = await Promise.all(
          imageFiles.map((file) => ImagesApi.uploadImage(file))
        );
        const nextImages = uploads.flatMap((upload, index) => {
          const file = imageFiles[index];
          const url = upload.file_url || upload.path;
          if (!file || !url) return [];
          return [
            {
              id: upload.id || createMessageId(),
              name: file.name || `Image ${index + 1}`,
              url,
              file,
            },
          ];
        });
        if (nextImages.length === 0) {
          throw new Error("Image upload did not return a URL.");
        }
        setPastedImages((previous) => [...previous, ...nextImages]);
      }

      if (documentFiles.length > 0) {
        const paths = (await PresentationGenerationApi.uploadDoc(
          documentFiles
        )) as string[];
        const documents = paths.flatMap((filePath, index) => {
          const file = documentFiles[index];
          if (!file || !filePath) return [];
          return [
            {
              id: createMessageId(),
              name: file.name || `Document ${index + 1}`,
              filePath,
              mimeType: file.type || undefined,
            },
          ];
        });
        if (documents.length === 0) {
          throw new Error("Document upload did not return a file path.");
        }
        setAttachedDocuments((previous) => [...previous, ...documents]);
      }

      notify.success(
        "Attachment ready",
        `${files.length} file${files.length === 1 ? "" : "s"} attached.`
      );
      trackEvent(MixpanelEvent.AI_Assistant_Attachment_Added, {
        ...baseAnalyticsProps(),
        source,
        image_count: imageFiles.length,
        document_count: documentFiles.length,
        total_count: files.length,
      });
    } catch (error) {
      trackEvent(MixpanelEvent.AI_Assistant_Attachment_Failed, {
        ...baseAnalyticsProps(),
        source,
        file_count: files.length,
        error_message: sanitizeAnalyticsError(error, "Attachment upload failed"),
      });
      notify.error(
        "Could not attach file",
        error instanceof Error ? error.message : "Upload failed."
      );
    } finally {
      setIsUploadingPastedImage(false);
    }
  };

  const extractImageTextContext = async (images: PastedChatImage[]) => {
    const imagesToRead = images.filter(
      (image) => image.file && !image.extractedText
    );
    if (imagesToRead.length === 0) {
      return images;
    }

    setIsUploadingPastedImage(true);
    try {
      const paths = (await PresentationGenerationApi.uploadDoc(
        imagesToRead.map((image) => image.file!)
      )) as string[];
      const decomposed = (await PresentationGenerationApi.decomposeDocuments(
        paths,
        null
      )) as { name: string; file_path: string }[];
      const extracted = await Promise.all(
        decomposed.map((item) => readDecomposedFile(item.file_path))
      );
      const extractedById = new Map(
        imagesToRead.map((image, index) => [image.id, extracted[index] || ""])
      );
      const nextImages = images.map((image) => ({
        ...image,
        extractedText: extractedById.get(image.id) || image.extractedText,
      }));
      setPastedImages(nextImages);
      return nextImages;
    } finally {
      setIsUploadingPastedImage(false);
    }
  };

  const submitMessage = async (
    rawMessage: string,
    options: SubmitMessageOptions = {},
  ) => {
    const trimmedMessage = rawMessage.trim();
    const hasAttachedContext =
      pastedImages.length > 0 ||
      attachedDocuments.length > 0 ||
      chatLinks.length > 0;
    const outboundMessage =
      trimmedMessage ||
      (attachedDocuments.length > 0
        ? "Use the attached document."
        : chatLinks.length > 0
          ? "Use the provided link."
          : "Use the pasted image.");

    if (
      (!trimmedMessage && !hasAttachedContext) ||
      chatInputDisabled ||
      isUploadingPastedImage
    ) {
      return;
    }

    if (!activeResourceId) {
      notify.error(
        `${resourceLabel.charAt(0).toUpperCase()}${resourceLabel.slice(1)} not ready`,
        `The ${resourceLabel} is not ready yet.`
      );
      return;
    }

    let imagesForMessage = pastedImages;
    if (
      variant === "template-v2" &&
      pastedImages.length > 0 &&
      shouldReadAttachedImages(outboundMessage)
    ) {
      // ponytail: keyword heuristic, replace with explicit user-controlled "read image" mode if it misclassifies.
      try {
        imagesForMessage = await extractImageTextContext(pastedImages);
      } catch (error) {
        trackEvent(MixpanelEvent.AI_Assistant_Attachment_Failed, {
          ...baseAnalyticsProps(),
          source: "image_ocr",
          file_count: pastedImages.length,
          error_message: sanitizeAnalyticsError(error, "Image processing failed"),
        });
        notify.error(
          "Could not read image",
          error instanceof Error ? error.message : "Image processing failed."
        );
        return;
      }
    }

    const userMessage: ChatMessage = {
      id: createMessageId(),
      role: "user",
      content: outboundMessage,
      layoutPreview: options.layoutPreview,
    };

    const assistantMessageId = createMessageId();
    const previewSlideIndex = typeof currentSlide === "number" ? currentSlide : 0;
    const originalPreviewSlide = clonePreviewSlide(
      getPresentationSlide(presentationData, previewSlideIndex),
    );
    activeEditPreviewRef.current = originalPreviewSlide
      ? {
        assistantMessageId,
        originalSlidesByIndex: { [previewSlideIndex]: originalPreviewSlide },
        mutatedSlideIndices: [],
        mutationObserved: false,
        changeCount: 0,
      }
      : null;
    setMessages((previous) => [
      ...previous,
      userMessage,
      {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        toolCalls: [],
        activity: [],
      },
    ]);
    setExpandedActivityByMessage((previous) => ({
      ...previous,
      [assistantMessageId]: false,
    }));
    setInput("");
    setErrorMessage(null);
    setHasChatMutationStarted(false);
    setIsSending(true);
    setActiveAssistantMessageId(assistantMessageId);
    didIncrementalRefreshRef.current = false;
    refreshQueuedRef.current = false;
    refreshInFlightRef.current = false;
    promptMetricsRef.current = {
      startedAt: Date.now(),
      attachmentImageCount: imagesForMessage.length,
      attachmentDocumentCount: attachedDocuments.length,
      linkCount: chatLinks.length,
      mutatingToolCount: 0,
      readToolCount: 0,
      uniqueTools: new Set<string>(),
      mutatedSlides: new Set<number>(),
    };
    trackEvent(MixpanelEvent.AI_Assistant_Prompt_Submitted, {
      ...baseAnalyticsProps(),
      has_text: trimmedMessage.length > 0,
      message_length_bucket: bucketMessageLength(outboundMessage.length),
      attachment_image_count: imagesForMessage.length,
      attachment_document_count: attachedDocuments.length,
      link_count: chatLinks.length,
      has_selected_slide: typeof currentSlide === "number",
      has_selected_template_target: Boolean(selectedTemplateV2Target),
    });
    const streamAbortController = new AbortController();
    abortControllerRef.current = streamAbortController;

    try {
      await onBeforeSend?.();
      const response = await chatAdapter.streamMessage(
        {
          resourceId: activeResourceId,
          message: buildBackendMessage(
            outboundMessage,
            imagesForMessage,
            options.backendContext,
          ),
          conversation_id: conversationId ?? undefined,
          attachments: buildChatDocumentAttachments(attachedDocuments),
        },
        {
          onChunk: (chunk) => {
            setMessages((previous) =>
              previous.map((message) =>
                message.id === assistantMessageId
                  ? {
                    ...message,
                    content: `${message.content}${chunk}`,
                  }
                  : message
              )
            );
          },
          onStatus: (status) => {
            appendAssistantActivity(assistantMessageId, {
              label: status,
              state: inferStatusState(status),
            });
          },
          onTrace: (trace) => {
            const metrics = promptMetricsRef.current;
            if (metrics && trace.tool && trace.status === "start") {
              metrics.uniqueTools.add(trace.tool);
              if (MUTATING_TOOLS.has(trace.tool)) {
                metrics.mutatingToolCount += 1;
                const slideIndex = readTraceSlideIndex(trace);
                if (slideIndex !== null) {
                  metrics.mutatedSlides.add(slideIndex);
                }
              } else {
                metrics.readToolCount += 1;
              }
            }
            if (
              trace.tool &&
              trace.status === "start" &&
              MUTATING_TOOLS.has(trace.tool) &&
              activeEditPreviewRef.current?.assistantMessageId ===
              assistantMessageId
            ) {
              const activePreview = activeEditPreviewRef.current;
              const tracedSlideIndex = readTraceSlideIndex(trace);
              const effectiveSlideIndex =
                tracedSlideIndex ??
                (typeof currentSlide === "number" ? currentSlide : 0);
              if (!activePreview.originalSlidesByIndex[effectiveSlideIndex]) {
                const tracedOriginalSlide = clonePreviewSlide(
                  getPresentationSlide(presentationData, effectiveSlideIndex),
                );
                if (tracedOriginalSlide) {
                  activePreview.originalSlidesByIndex[effectiveSlideIndex] =
                    tracedOriginalSlide;
                }
              }
              if (!activePreview.mutatedSlideIndices.includes(effectiveSlideIndex)) {
                activePreview.mutatedSlideIndices.push(effectiveSlideIndex);
              }
              activePreview.mutationObserved = true;
              activePreview.changeCount += 1;
              setMessages((previous) =>
                previous.map((message) =>
                  message.id === assistantMessageId
                    ? {
                      ...message,
                      editPreview: {
                        originalSlides: activePreview.mutatedSlideIndices
                          .map(
                            (slideIndex) =>
                              activePreview.originalSlidesByIndex[slideIndex],
                          )
                          .filter(Boolean),
                        slideIndices: activePreview.mutatedSlideIndices,
                        changeCount: activePreview.changeCount,
                      },
                    }
                    : message,
                ),
              );
            }
            maybeFollowAgentSlide(trace);
            if (
              trace.status === "success" &&
              trace.tool &&
              MUTATING_TOOLS.has(trace.tool)
            ) {
              void refreshPresentationIncrementally();
            }
            if (trace.status === "start") {
              markChatMutationStarted(trace.tool);
            }
            const traceActivity = formatTraceActivity(trace);
            if (!traceActivity) {
              return;
            }
            appendAssistantActivity(assistantMessageId, traceActivity);
          },
        },
        { signal: streamAbortController.signal }
      );

      setMessages((previous) =>
        previous.map((message) =>
          message.id === assistantMessageId
            ? {
              ...message,
              content: response.response,
              toolCalls: [],
              activity: (message.activity ?? []).map((activity) => ({
                ...activity,
                state:
                  activity.state === "running" ? "success" : activity.state,
              })),
            }
            : message
        )
      );
      setExpandedActivityByMessage((previous) => {
        const next = { ...previous };
        delete next[assistantMessageId];
        return next;
      });
      setConversationId((previous) => {
        const next =
          typeof response.conversation_id === "string"
            ? response.conversation_id
            : previous;
        if (next && activeResourceId) {
          storeConversationId(
            conversationStorageKey(conversationStorageScope, activeResourceId),
            next
          );
        }
        return next;
      });

      await refreshPresentationIfNeeded(
        Array.isArray(response.tool_calls) ? response.tool_calls : []
      );
      const metrics = promptMetricsRef.current;
      const responseToolCalls = Array.isArray(response.tool_calls)
        ? response.tool_calls
        : [];
      responseToolCalls.forEach((tool) => metrics?.uniqueTools.add(tool));
      trackEvent(MixpanelEvent.AI_Assistant_Prompt_Completed, {
        ...baseAnalyticsProps(),
        conversation_id_present: Boolean(response.conversation_id ?? conversationId),
        duration_ms: metrics ? Date.now() - metrics.startedAt : null,
        mutating_tool_count:
          metrics?.mutatingToolCount ??
          responseToolCalls.filter((tool) => MUTATING_TOOLS.has(tool)).length,
        read_tool_count:
          metrics?.readToolCount ??
          responseToolCalls.filter((tool) => !MUTATING_TOOLS.has(tool)).length,
        unique_tools: metrics
          ? Array.from(metrics.uniqueTools)
          : Array.from(new Set(responseToolCalls)),
        mutated_slide_count: metrics?.mutatedSlides.size ?? 0,
        attachment_image_count: metrics?.attachmentImageCount ?? imagesForMessage.length,
        attachment_document_count:
          metrics?.attachmentDocumentCount ?? attachedDocuments.length,
        link_count: metrics?.linkCount ?? chatLinks.length,
      });
      setPastedImages([]);
      setAttachedDocuments([]);
      setChatLinks([]);
    } catch (error) {
      if (isAbortError(error)) {
        const metrics = promptMetricsRef.current;
        trackEvent(MixpanelEvent.AI_Assistant_Prompt_Stopped, {
          ...baseAnalyticsProps(),
          duration_ms: metrics ? Date.now() - metrics.startedAt : null,
        });
        setMessages((previous) =>
          previous.map((message) =>
            message.id === assistantMessageId
              ? {
                ...message,
                toolCalls: [],
                activity: [],
              }
              : message
          )
        );
        setExpandedActivityByMessage((previous) => {
          const next = { ...previous };
          delete next[assistantMessageId];
          return next;
        });
        return;
      }

      const message =
        error instanceof Error ? error.message : "Failed to send chat message";
      const metrics = promptMetricsRef.current;
      trackEvent(MixpanelEvent.AI_Assistant_Prompt_Failed, {
        ...baseAnalyticsProps(),
        duration_ms: metrics ? Date.now() - metrics.startedAt : null,
        error_message: sanitizeAnalyticsError(message, "Failed to send chat message"),
        mutating_tool_count: metrics?.mutatingToolCount ?? 0,
        unique_tools: metrics ? Array.from(metrics.uniqueTools) : [],
      });

      setMessages((previous) =>
        previous.map((entry) =>
          entry.id === assistantMessageId
            ? {
              ...entry,
              toolCalls: [],
              activity: [],
            }
            : entry
        )
      );
      setExpandedActivityByMessage((previous) => {
        const next = { ...previous };
        delete next[assistantMessageId];
        return next;
      });
      setErrorMessage(message);
      setMessages((previous) => [
        ...previous,
        {
          id: createMessageId(),
          role: "error",
          content: message,
        },
      ]);
      notify.error("Chat error", message);
    } finally {
      setHasChatMutationStarted(false);
      if (abortControllerRef.current === streamAbortController) {
        abortControllerRef.current = null;
      }
      setActiveAssistantMessageId((current) =>
        current === assistantMessageId ? null : current
      );
      setIsSending(false);
      promptMetricsRef.current = null;
    }
  };

  useEffect(() => {
    submitMessageRef.current = submitMessage;
  });

  useEffect(() => {
    if (variant !== "template-v2" || typeof window === "undefined") return;

    const handleBlankSlidePrompt = (event: Event) => {
      const detail = (event as CustomEvent<BlankSlidePromptEventDetail>).detail;
      const prompt = typeof detail?.prompt === "string" ? detail.prompt.trim() : "";
      if (!prompt) return;

      const target =
        typeof detail.slideIndex === "number"
          ? `slide ${detail.slideIndex + 1}`
          : "the current blank slide";
      const layoutReference =
        typeof detail.layoutId === "string" && detail.layoutId.trim()
          ? ` (layout id: ${detail.layoutId.trim()})`
          : "";
      const instruction =
        detail.promptKind === "layout"
          ? `Fill the existing selected ${target} using its selected layout${layoutReference} as the layout reference. Preserve the layout structure and update this slide; do not add another slide.`
          : `Create content on the existing selected ${target}. Update this slide; do not add another slide.`;
      if (typeof detail.slideIndex === "number") {
        setHiddenOverlaySlideReference(detail.slideIndex);
      }
      void submitMessageRef.current(prompt, {
        backendContext: instruction,
        layoutPreview:
          detail.promptKind === "layout" && detail.layout
            ? {
              layout: detail.layout,
              layoutId: detail.layoutId,
              slideIndex: detail.slideIndex,
            }
            : undefined,
      });
    };

    window.addEventListener(
      PRESENTON_BLANK_SLIDE_PROMPT_EVENT,
      handleBlankSlidePrompt,
    );
    return () => {
      window.removeEventListener(
        PRESENTON_BLANK_SLIDE_PROMPT_EVENT,
        handleBlankSlidePrompt,
      );
    };
  }, [variant]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submitMessage(input);
  };

  const addChatLinks = (links: ChatLink[]) => {
    if (links.length === 0) return;
    setChatLinks((previous) => {
      const seen = new Set(previous.map((link) => link.url));
      return [
        ...previous,
        ...links.filter((link) => {
          if (seen.has(link.url)) return false;
          seen.add(link.url);
          return true;
        }),
      ];
    });
  };

  const handleInputChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const { cleanText, links } = pullLinksFromText(event.target.value);
    if ((variant !== "outline" || useEditorLayout) && cleanText === "/") {
      setInput("");
      setIsQuickPromptsOpen(true);
      return;
    }
    setInput(cleanText);
    addChatLinks(links);
  };

  const handleAttachmentInputChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    void processTemplateV2Files(files, "file_input");
  };

  const handlePaste = async (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(event.clipboardData.files);
    if (chatInputDisabled) {
      return;
    }

    const pastedText = event.clipboardData.getData("text");
    const { cleanText, links } = pullLinksFromText(pastedText);

    if (variant === "template-v2" && files.length > 0) {
      event.preventDefault();
      addChatLinks(links);
      if (cleanText) {
        setInput((previous) => appendInputText(previous, cleanText));
      }
      void processTemplateV2Files(files, "paste");
      return;
    }

    const imageFiles = files.filter((file) => file.type.startsWith("image/"));

    if (imageFiles.length === 0 && links.length > 0) {
      event.preventDefault();
      setInput((previous) => appendInputText(previous, cleanText));
      addChatLinks(links);
      return;
    }

    if (imageFiles.length === 0) {
      return;
    }

    event.preventDefault();
    addChatLinks(links);
    if (cleanText) {
      setInput((previous) => appendInputText(previous, cleanText));
    }
    setIsUploadingPastedImage(true);
    try {
      const uploads = await Promise.all(
        imageFiles.map((file) => ImagesApi.uploadImage(file))
      );
      const nextImages = uploads
        .map((upload, index) => ({
          id: upload.id || createMessageId(),
          name: imageFiles[index]?.name || `Pasted image ${index + 1}`,
          url: upload.file_url || upload.path,
          file: imageFiles[index],
        }))
        .filter((image) => image.url);
      if (nextImages.length === 0) {
        throw new Error("Image upload did not return a URL.");
      }
      setPastedImages((previous) => [...previous, ...nextImages]);
      trackEvent(MixpanelEvent.AI_Assistant_Attachment_Added, {
        ...baseAnalyticsProps(),
        source: "paste",
        image_count: nextImages.length,
        document_count: 0,
        total_count: nextImages.length,
      });
      notify.success(
        "Image pasted",
        `${nextImages.length} image${nextImages.length === 1 ? "" : "s"} ready to use.`
      );
    } catch (error) {
      trackEvent(MixpanelEvent.AI_Assistant_Attachment_Failed, {
        ...baseAnalyticsProps(),
        source: "paste",
        file_count: imageFiles.length,
        error_message: sanitizeAnalyticsError(error, "Image upload failed"),
      });
      notify.error(
        "Could not paste image",
        error instanceof Error ? error.message : "Image upload failed."
      );
    } finally {
      setIsUploadingPastedImage(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (chatInputDisabled) return;
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitMessage(input);
    }
  };

  const applyPrompt = (prompt: string) => {
    setInput(prompt);
    setIsQuickPromptsOpen(false);
    setErrorMessage(null);
    inputRef.current?.focus();
  };

  const handleDragOver = (event: DragEvent<HTMLElement>) => {
    if (chatInputDisabled) return;
    if (variant !== "template-v2") return;
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
    setIsDraggingAttachment(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLElement>) => {
    if (variant !== "template-v2") return;
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsDraggingAttachment(false);
    }
  };

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    if (chatInputDisabled) return;
    if (variant !== "template-v2") return;
    const files = Array.from(event.dataTransfer.files);
    const fileUri = getDroppedFileUri(event);
    if (files.length === 0 && !hasDraggedFiles(event) && !fileUri.startsWith("file:")) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingAttachment(false);
    if (files.length === 0) {
      notify.warning("Drop unavailable", "Use the attach button for this file.");
      return;
    }
    void processTemplateV2Files(files, "drop");
  };

  const isOutlineVariant = variant === "outline";
  const isTemplateV2Variant = variant === "template-v2";
  const usesEditorLayout = !isOutlineVariant || useEditorLayout;
  const showEditorEmptyState =
    usesEditorLayout && !isHistoryLoading && messages.length === 0;
  const chatSlideReference =
    typeof currentSlide === "number" &&
      hiddenOverlaySlideReference !== currentSlide
      ? `Slide ${currentSlide + 1}`
      : "";
  const chatTargetReference = selectedTemplateV2Target
    ? selectedTemplateV2Target.kind === "multi-component"
      ? selectedTemplateV2Target.targetLabel ||
      `${selectedTemplateV2Target.components.length} components selected`
      : selectedTemplateV2Target.targetLabel ||
      selectedTemplateV2Target.componentLabel ||
      selectedTemplateV2Target.elementName ||
      selectedTemplateV2Target.elementType ||
      selectedTemplateV2Target.componentId ||
      selectedTemplateV2Target.kind
    : "";

  if (usesEditorLayout) {
    const previewFonts = getPresentationFonts(presentationData);

    return (
      <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#FEFEFF] font-syne">
        <Image
          src="/bg_chat.svg"
          alt=""
          width={294}
          height={458}
          loading="eager"
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 h-[457.951px] w-[293.611px] max-w-none object-cover opacity-40"
        />

        <div className="sticky top-0 z-20 flex shrink-0 items-center justify-end border-b border-[#F1F1F3] bg-white/90 px-3 py-2 backdrop-blur-sm">
          <button
            type="button"
            onClick={() => void resetChat()}
            disabled={isSending || isHistoryLoading}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#E5E5E8] bg-white px-3 font-manrope text-xs font-medium text-[#55555F] shadow-sm transition-colors hover:border-[#D7D7DC] hover:bg-[#F7F7F8] hover:text-[#252529] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Start a new chat"
            title="Start a new chat"
          >
            <Plus className="h-3.5 w-3.5" />
            New chat
          </button>
        </div>

        <div className="relative z-10 min-h-0 flex-1 overflow-x-hidden overflow-y-auto [scrollbar-color:#D7D9DF_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#D7D9DF] [&::-webkit-scrollbar-track]:bg-transparent">
          {isHistoryLoading && messages.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-[#999999]">
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              Loading chat…
            </div>
          ) : messages.length > 0 ? (
            <div className="flex flex-col gap-0">
              {messages.map((message) => {
                if (message.role === "user") {
                  return (
                    <div key={message.id} className="flex justify-end p-4">
                      <div className="flex max-w-[92%] flex-col items-end gap-2">
                        {message.layoutPreview && (
                          <div className="w-[220px] overflow-hidden rounded-[8px] border border-[#EDEEEF] bg-white p-1.5">
                            <TemplateV2HtmlSlidePreview
                              slide={createChatLayoutPreviewSlide(
                                message.layoutPreview,
                              )}
                              fonts={previewFonts}
                              className="rounded-[4px]"
                            />
                          </div>
                        )}
                        <div className="flex min-h-[30px] w-fit max-w-full items-center gap-2.5 rounded-[8px] bg-[#F3F4F7] px-3 py-1.5 font-manrope text-[13px] font-medium leading-[normal] text-[#333333] [overflow-wrap:anywhere] [word-break:break-word]">
                          <p className="min-w-0 whitespace-pre-wrap">
                            {stripBackendContextFromUserMessage(message.content)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                }

                const normalizedMessageContent = message.content
                  .trim()
                  .replace(/\s+/g, " ")
                  .toLowerCase();
                const visibleActivity = (message.activity ?? [])
                  .filter((activity) => {
                    const normalizedLabel = activity.label
                      .trim()
                      .replace(/\s+/g, " ")
                      .toLowerCase();
                    if (!normalizedMessageContent || normalizedLabel.length < 12) {
                      return true;
                    }
                    return !(
                      normalizedMessageContent.startsWith(normalizedLabel) ||
                      normalizedLabel.startsWith(normalizedMessageContent)
                    );
                  })
                  .slice(-2);
                const showFallbackActivity =
                  isSending &&
                  message.id === activeAssistantMessageId &&
                  visibleActivity.length === 0 &&
                  !message.content;
                const isEditPreviewExpanded =
                  expandedEditPreviewByMessage[message.id] !== false;

                return (
                  <div
                    key={message.id}
                    className="flex flex-col gap-[10px] px-3 py-4 font-manrope [overflow-wrap:anywhere] [word-break:break-word]"
                  >
                    <div className="flex min-h-[17px] items-center">
                      <p
                        className="min-w-0 max-w-full truncate text-xs font-bold leading-[normal] text-[#333333]"
                        title={selectedTextModel}
                      >
                        {selectedTextModel}
                      </p>
                    </div>

                    <div className="flex w-full flex-col gap-1">
                      {(visibleActivity.length > 0 || showFallbackActivity) && (
                        <div className="flex flex-col gap-1">
                          {visibleActivity.map((activity, index) => {
                            const useSparkle =
                              Boolean(
                                activity.tool && MUTATING_TOOLS.has(activity.tool),
                              ) ||
                              /edit|updat|sav|chang|creat|add/i.test(
                                activity.label,
                              );
                            return (
                              <React.Fragment key={activity.id}>
                                <div className="flex min-w-0 items-start gap-1 text-[13px] font-medium leading-[18px] text-[#808080]">
                                  <span className="flex h-[14px] w-[14px] shrink-0 items-start justify-center pt-0.5">
                                    {useSparkle ? (
                                      <Image
                                        src="/vector.svg"
                                        alt=""
                                        width={12}
                                        height={12}
                                        className="h-[12px] w-[12px]"
                                      />
                                    ) : (
                                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#E6E6E6]" />
                                    )}
                                  </span>
                                  <span className="min-w-0 truncate">
                                    {activity.label}
                                  </span>
                                  {activity.state === "running" && (
                                    <ActivityStatusIcon activity={activity} />
                                  )}
                                </div>
                                {(index < visibleActivity.length - 1 ||
                                  Boolean(message.content) ||
                                  Boolean(message.editPreview)) && (
                                    <span className="ml-[6.5px] h-[13px] w-px bg-[#E6E6E6]" />
                                  )}
                              </React.Fragment>
                            );
                          })}
                          {showFallbackActivity && (
                            <div className="flex items-start gap-1 text-[13px] font-medium leading-[18px] text-[#808080]">
                              <span className="flex h-[14px] w-[14px] items-start justify-center pt-0.5">
                                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#E6E6E6]" />
                              </span>
                              <span>Understanding</span>
                              <ActivityStatusIcon
                                activity={{
                                  id: "fallback",
                                  label: "Understanding",
                                  state: "running",
                                }}
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {message.content && (
                        <>
                          <div
                            className={cn(
                              "flex min-w-0 items-start gap-1 font-manrope text-[13px] font-medium leading-none",
                              message.role === "error"
                                ? "text-[#B42318]"
                                : "text-[#808080]",
                            )}
                          >
                            <span className="mt-1 flex h-[14px] w-[14px] shrink-0 items-start justify-center pt-0.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-[#E6E6E6]" />
                            </span>
                            <MarkdownRenderer
                              content={message.content}
                              className="chat-markdown mb-0 min-w-0 flex-1 font-manrope text-[13px] font-medium leading-[18px] text-inherit [&_*]:text-[13px] [&_*]:font-medium [&_*]:leading-[18px] [&_*]:text-inherit"
                            />
                            {message.editPreview?.modifiedSlides?.length ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedEditPreviewByMessage((previous) => ({
                                    ...previous,
                                    [message.id]: !isEditPreviewExpanded,
                                  }))
                                }
                                className="flex h-[14px] w-[14px] shrink-0 items-center justify-center text-[#808080] transition-colors hover:text-[#333333]"
                                aria-label={
                                  isEditPreviewExpanded
                                    ? "Hide edit comparison"
                                    : "Show edit comparison"
                                }
                                aria-expanded={isEditPreviewExpanded}
                              >
                                <ChevronDown
                                  className={cn(
                                    "h-[14px] w-[14px] transition-transform duration-200",
                                    !isEditPreviewExpanded && "-rotate-90",
                                  )}
                                />
                              </button>
                            ) : null}
                          </div>
                          {message.editPreview && isEditPreviewExpanded && (
                            <span className="ml-[6.5px] h-[13px] w-px bg-[#E6E6E6]" />
                          )}
                        </>
                      )}

                      {message.editPreview && isEditPreviewExpanded && (
                        <EditComparisonPreview
                          preview={message.editPreview}
                          fonts={previewFonts}
                          selectedVersion={
                            selectedEditVersionByMessage[message.id] ?? "modified"
                          }
                          isApplying={
                            applyingEditPreviewMessageId === message.id
                          }
                          onSelectVersion={(version) =>
                            void applyEditPreviewVersion(
                              message.id,
                              message.editPreview!,
                              version,
                            )
                          }
                        />
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          ) : (
            <div className="flex h-full items-center justify-center px-6 pb-4">
              <h3 className="-translate-y-2 text-center text-[22px] font-normal leading-[1.12] tracking-[-0.66px] text-[#4A4A4A]">
                {isOutlineVariant ? "How can I improve" : "What can I do"}
                <br />
                {isOutlineVariant
                  ? "your outline today?"
                  : "for your deck today?"}
              </h3>
            </div>
          )}
        </div>
        <div className="relative z-20 flex shrink-0 flex-col gap-[10px] bg-[#FFFEFF] px-3 py-[14px]">
          <form
            onSubmit={handleSubmit}
            onDragEnterCapture={handleDragOver}
            onDragOverCapture={handleDragOver}
            onDragLeave={handleDragLeave}
            onDropCapture={handleDrop}
            className={cn(
              "rounded-[8px] border bg-white px-[10px] py-3 transition-colors",
              isDraggingAttachment
                ? "border-[#7A5AF8] bg-[#F7F5FF]"
                : "border-[#DBDBDB]/60",
            )}
            style={{ boxShadow: "0 4px 7px rgba(0, 0, 0, 0.04)" }}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              disabled={chatInputDisabled}
              accept="image/*,.pdf,.txt,.doc,.docx,.docm,.odt,.rtf,.ppt,.pptx,.pptm,.odp,.xls,.xlsx,.xlsm,.ods,.csv,.tsv,.tif,.tiff"
              className="hidden"
              onChange={handleAttachmentInputChange}
              aria-hidden="true"
              tabIndex={-1}
            />

            {(chatSlideReference || chatTargetReference) && (
              <div
                className="mb-2 flex max-w-full items-center gap-1.5 overflow-hidden"
                aria-label="Current editor selection"
              >
                {chatSlideReference && (
                  <span
                    className="inline-flex h-7 max-w-[86px] shrink-0 items-center gap-1 rounded-full border border-[#E8E3FF] bg-[#F8F6FF] pl-2.5 pr-1 font-manrope text-[11px] font-semibold text-[#6941C6] shadow-[0_1px_2px_rgba(105,65,198,0.06)]"
                    title={chatSlideReference}
                  >
                    <span className="truncate">{chatSlideReference}</span>
                    {onClearChatSlideReference && (
                      <button
                        type="button"
                        onClick={onClearChatSlideReference}
                        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[#8069C5] transition-colors hover:bg-[#E4DFFF] hover:text-[#5235A8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7A5AF8]/40"
                        aria-label={`Remove ${chatSlideReference} from context`}
                        title={`Remove ${chatSlideReference} from context`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                )}
                {chatTargetReference && (
                  <span
                    className="inline-flex h-7 min-w-0 max-w-[138px] items-center gap-1 rounded-full border border-[#DDD6FE] bg-[#F5F3FF] pl-2.5 pr-1 font-manrope text-[11px] font-semibold text-[#6941C6] shadow-[0_1px_2px_rgba(105,65,198,0.08)]"
                    title={chatTargetReference}
                  >
                    <span className="truncate">{chatTargetReference}</span>
                    {onClearChatTargetReference && (
                      <button
                        type="button"
                        onClick={onClearChatTargetReference}
                        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[#8069C5] transition-colors hover:bg-[#E4DFFF] hover:text-[#5235A8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7A5AF8]/40"
                        aria-label="Remove selected element from context"
                        title="Remove selected element from context"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                )}
              </div>
            )}

            {(pastedImages.length > 0 ||
              attachedDocuments.length > 0 ||
              chatLinks.length > 0 ||
              isUploadingPastedImage) && (
                <div className="mb-2 flex max-w-full flex-wrap items-center gap-1.5">
                  {chatLinks.map((link) => (
                    <span
                      key={link.id}
                      className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-[8px] border border-[#DBEAFE] bg-[#EFF6FF] px-2 py-1 text-[10px] font-medium text-[#1D4ED8]"
                    >
                      <LinkIcon className="h-3 w-3 shrink-0" />
                      <span className="truncate">{link.url}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setChatLinks((previous) =>
                            previous.filter((item) => item.id !== link.id),
                          )
                        }
                        aria-label="Remove link"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  {pastedImages.map((image) => (
                    <span
                      key={image.id}
                      className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-[8px] border border-[#EDEEEF] bg-[#F9FAFB] px-2 py-1 text-[10px] font-medium text-[#344054]"
                    >
                      <ImageIcon className="h-3 w-3 shrink-0" />
                      <span className="truncate">{image.name}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setPastedImages((previous) =>
                            previous.filter((item) => item.id !== image.id),
                          )
                        }
                        aria-label="Remove pasted image"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  {attachedDocuments.map((document) => (
                    <span
                      key={document.id}
                      className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-[8px] border border-[#EDEEEF] bg-[#F9FAFB] px-2 py-1 text-[10px] font-medium text-[#344054]"
                    >
                      <FileText className="h-3 w-3 shrink-0" />
                      <span className="truncate">{document.name}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setAttachedDocuments((previous) =>
                            previous.filter((item) => item.id !== document.id),
                          )
                        }
                        aria-label="Remove attached document"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  {isUploadingPastedImage && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-[#808080]">
                      <Loader2 className="h-3 w-3 animate-spin" /> Processing
                    </span>
                  )}
                </div>
              )}

            <textarea
              ref={inputRef}
              name="chat-input"
              id="chat-input"
              className="h-[79px] min-h-[79px] w-full resize-none overflow-x-hidden bg-transparent font-syne text-sm font-normal leading-[normal] text-[#191919] placeholder:text-[#999999] focus:outline-none focus:ring-0 [overflow-wrap:anywhere] [word-break:break-word]"
              rows={3}
              wrap="soft"
              value={input}
              disabled={chatInputDisabled}
              onChange={handleInputChange}
              onPaste={handlePaste}
              onDragEnterCapture={handleDragOver}
              onDragOverCapture={handleDragOver}
              onDropCapture={handleDrop}
              onKeyDown={handleKeyDown}
              placeholder={
                isOutlineVariant
                  ? "Ask about your outline.\nType / to get Quick prompts."
                  : "Ask anything.\nType / to get Quick prompts."
              }
              aria-invalid={Boolean(errorMessage)}
            />

            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <div className="flex h-[28px] items-center gap-[10px] rounded-full border border-[#EDEEEF] bg-white px-[11px]">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={!isTemplateV2Variant || chatInputDisabled}
                    className="inline-flex h-[14px] w-[14px] items-center justify-center disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Attach files"
                  >
                    <Plus className="h-[14px] w-[14px] text-black" />
                  </button>
                  <span className="h-[17px] w-px bg-[#EDECEC]" />
                  <ToolTip
                    content={
                      isFollowAgentEnabled
                        ? "Disable follow AI mode"
                        : "Enable follow AI mode"
                    }
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setIsFollowAgentEnabled((previous) => !previous)
                      }
                      disabled={isHistoryLoading || isSending}
                      className="inline-flex h-[14px] w-[14px] items-center justify-center disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label={
                        isFollowAgentEnabled
                          ? "Disable follow AI mode"
                          : "Enable follow AI mode"
                      }
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 14 14"
                        fill="none"
                        aria-hidden="true"
                      >
                        <circle
                          cx="7"
                          cy="7"
                          r="4.7"
                          stroke={isFollowAgentEnabled ? "#7A5AF8" : "#191919"}
                          strokeWidth="1.15"
                        />
                        <path
                          d="M7 0.8v2.3M7 10.9v2.3M.8 7h2.3M10.9 7h2.3"
                          stroke={isFollowAgentEnabled ? "#7A5AF8" : "#191919"}
                          strokeWidth="1.15"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  </ToolTip>
                </div>

                <Popover
                  open={isQuickPromptsOpen}
                  onOpenChange={setIsQuickPromptsOpen}
                >
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      disabled={chatInputDisabled}
                      className="inline-flex h-[28px] items-center gap-1.5 rounded-full border border-[#EDEEEF] bg-white px-[11px] font-syne text-xs font-medium tracking-[0.16px] text-[#191919] transition-colors hover:bg-[#FAFAFF] disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Open quick prompts"
                    >
                      <Image
                        src="/ai-star.svg"
                        alt=""
                        width={13}
                        height={14}
                        className="h-[14px] w-[13px] shrink-0"
                      />
                      Prompt
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    side="top"
                    align="end"
                    sideOffset={14}
                    className="z-[120] w-[328px] rounded-[12px] border border-[#EDEEEF] bg-white px-5 pb-[30px] pt-5 shadow-[0_0_14px_rgba(0,0,0,0.08)]"
                  >
                    <QuickPromptsPanel
                      onPromptSelect={applyPrompt}
                      groups={
                        isOutlineVariant
                          ? outlineQuickPromptGroups
                          : quickPromptGroups
                      }
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {isSending ? (
                <button
                  type="button"
                  onClick={stopStreaming}
                  className="flex h-8 w-10 shrink-0 items-center justify-center rounded-full bg-[#EDEEEF] text-[#191919]"
                  aria-label="Stop chat response"
                >
                  <Square className="h-3 w-3 fill-current" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={
                    (!input.trim() &&
                      pastedImages.length === 0 &&
                      attachedDocuments.length === 0 &&
                      chatLinks.length === 0) ||
                    chatInputDisabled ||
                    isUploadingPastedImage
                  }
                  className="flex h-8 w-10 shrink-0 items-center justify-center rounded-full text-[#191919] transition-opacity disabled:cursor-not-allowed"
                  style={{
                    background: input.trim()
                      ? "linear-gradient(270deg, #D5CAFC 2.4%, #E3D2EB 27.88%, #F4DCD3 69.23%, #FDE4C2 100%)"
                      : "#EDEEEF",
                  }}
                  aria-label="Send prompt"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              )}
            </div>
          </form>

          <div className="flex h-[28px] w-full gap-2 overflow-hidden">
            {(isOutlineVariant
              ? outlineEditorQuickPrompts
              : editorQuickPrompts
            ).map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => applyPrompt(prompt)}
                className="h-[28px] shrink-0 rounded-full border-[1.345px] border-[#F4F4F4] bg-[#F9FAFB] px-3 font-syne text-xs font-medium leading-5 tracking-[0.16px] text-[#666666] transition-colors hover:border-[#D9D6FE] hover:bg-[#FAFAFF]"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex h-full w-full flex-col bg-white"
      style={
        showEditorEmptyState
          ? {
            background:
              "radial-gradient(ellipse 90% 42% at 66% 18%, rgba(218, 243, 255, 0.78) 0, rgba(230, 242, 255, 0.42) 35%, transparent 72%), radial-gradient(ellipse 85% 38% at 35% 47%, rgba(244, 226, 255, 0.72) 0, rgba(249, 237, 255, 0.34) 40%, transparent 75%), #fff",
          }
          : undefined
      }
    >
      {!showEditorEmptyState && (
        <div className="flex items-center justify-between px-4 pt-8">
          <div className="flex items-center gap-2">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-[#101828]">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M19.1407 9.46542C16.5537 9.21616 14.5067 7.17009 14.2577 4.58528L13.8376 0.220703L13.4175 4.58528C13.1685 7.17053 11.1215 9.2166 8.53451 9.46542L4.1731 9.88521L8.53451 10.305C11.1215 10.5543 13.1685 12.6003 13.4175 15.1852L13.8376 19.5497L14.2577 15.1852C14.5067 12.5999 16.5537 10.5538 19.1407 10.305L23.5021 9.88521L19.1407 9.46542Z"
                  fill="#7A5AF8"
                />
                <path
                  d="M9.07681 16.8431C7.62808 16.7035 6.48175 15.5577 6.34232 14.1102L6.10707 11.666L5.87183 14.1102C5.7324 15.5579 4.58606 16.7037 3.13734 16.8431L0.694946 17.0781L3.13734 17.3132C4.58606 17.4528 5.7324 18.5986 5.87183 20.0461L6.10707 22.4903L6.34232 20.0461C6.48175 18.5984 7.62808 17.4526 9.07681 17.3132L11.5192 17.0781L9.07681 16.8431Z"
                  fill="#7A5AF8"
                />
              </svg>
              AI Assistant
            </h4>
            {isSending && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#F4F3FF] px-2 py-0.5 text-[10px] font-medium text-[#6941C6]">
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                Live
              </span>
            )}
          </div>
          {!isOutlineVariant && messages.length > 0 && (
            <button
              type="button"
              onClick={() => void resetChat()}
              disabled={isSending || isHistoryLoading}
              className="rounded-full p-1 text-[#8C8C8C] transition-colors hover:bg-[#F7F7F7] hover:text-[#191919] disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Reset chat"
              title="Reset chat"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      <div
        className={cn(
          "min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 pb-4 [scrollbar-color:#C7CBD6_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#C7CBD6] [&::-webkit-scrollbar-track]:bg-transparent",
          showEditorEmptyState ? "flex items-center justify-center" : "pt-9",
        )}
      >
        {isHistoryLoading && messages.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-sm text-[#99A1AF]">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading chat…
          </div>
        ) : showEditorEmptyState ? (
          <h3 className="-translate-y-7 text-center text-[clamp(20px,1.55vw,24px)] font-normal leading-[1.08] tracking-[-0.72px] text-[#4A4A4A]">
            What can I do
            <br />
            for your deck today?
          </h3>
        ) : messages.length === 0 ? (
          <>
            {isOutlineVariant ? (
              <div>
                <h4 className="mb-2 text-[10px] font-normal leading-[15px] tracking-[0.367px] text-[#99A1AF]">
                  QUICK PROMPTS
                </h4>
                <div className="flex flex-wrap gap-2">
                  {outlineQuickPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => applyPrompt(prompt)}
                      className="cursor-pointer rounded-[10px] border border-[#F4F4F4] px-2.5 py-1 text-left transition-colors hover:bg-[#FAFAFA]"
                    >
                      <span className="text-[11px] font-normal leading-[15px] tracking-[0.367px] text-[#364153]">
                        {prompt}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : isTemplateV2Variant ? (
              <div>
                <h4 className="mb-2 text-[10px] font-normal leading-[15px] tracking-[0.367px] text-[#99A1AF]">
                  QUICK PROMPTS
                </h4>
                <div className="flex flex-wrap gap-2">
                  {templateV2QuickPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => applyPrompt(prompt)}
                      className="cursor-pointer rounded-[10px] border border-[#F4F4F4] px-2.5 py-1 text-left transition-colors hover:bg-[#FAFAFA]"
                    >
                      <span className="text-[11px] font-normal leading-[15px] tracking-[0.367px] text-[#364153]">
                        {prompt}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div>
                  <h4 className="mb-2 text-[10px] font-normal leading-[15px] tracking-[0.367px] text-[#99A1AF]">
                    SUGGESTIONS
                  </h4>
                  <div className="flex flex-col gap-1.5">
                    {suggestions.map((suggestion) => (
                      <button
                        key={suggestion.id}
                        type="button"
                        onClick={() => applyPrompt(suggestion.suggestion)}
                        className="group flex min-h-[34px] cursor-pointer items-center justify-between gap-3 rounded-[10px] border border-[#F4F4F4] px-3 py-2 text-left transition-colors hover:bg-[#FAFAFA]"
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <span className="shrink-0">{suggestion.icon}</span>
                          <span className="text-xs font-normal leading-[15px] tracking-[0.367px] text-[#364153]">
                            {suggestion.suggestion}
                          </span>
                        </span>
                        <ChevronRight className="h-3 w-3 shrink-0 text-[#D6D9E0] transition-colors group-hover:text-[#99A1AF]" />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-10">
                  <h4 className="mb-2 text-[10px] font-normal leading-[15px] tracking-[0.367px] text-[#99A1AF]">
                    QUICK PROMPTS
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {presentationQuickPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => applyPrompt(prompt)}
                        className="cursor-pointer rounded-[10px] border border-[#F4F4F4] px-2.5 py-1 transition-colors hover:bg-[#FAFAFA]"
                      >
                        <span className="text-xs font-normal leading-[15px] tracking-[0.367px] text-[#364153]">
                          {prompt}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        ) : (
          <div className="flex flex-col gap-7">
            {messages.map((message) =>
              message.role === "user" ? (
                <div
                  key={message.id}
                  className="flex items-start justify-end gap-2.5"
                >
                  <div
                    className={cn(
                      "flex min-w-0 max-w-[80%] flex-col items-end gap-2",
                      message.layoutPreview && "w-[220px]",
                    )}
                  >
                    {message.layoutPreview && (
                      <div className="w-full overflow-hidden rounded-[12px] border border-[#EDE7FF] bg-white p-1.5 shadow-sm">
                        <TemplateV2HtmlSlidePreview
                          slide={createChatLayoutPreviewSlide(
                            message.layoutPreview,
                          )}
                          className="rounded-[8px]"
                        />
                        <p className="px-1 pb-0.5 pt-1.5 text-[10px] font-medium text-[#667085]">
                          Selected layout
                        </p>
                      </div>
                    )}
                    <div className="w-fit max-w-full rounded-[18px] bg-[#7C3AED] px-4 py-3 text-[13px] font-medium leading-5 text-white shadow-sm [overflow-wrap:anywhere] [word-break:break-word]">
                      <p className="whitespace-pre-wrap">
                        {stripBackendContextFromUserMessage(message.content)}
                      </p>
                    </div>
                  </div>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FF8617] text-white">
                    <UserRound className="h-4 w-4" aria-hidden="true" />
                  </div>
                </div>
              ) : (
                <div
                  key={message.id}
                  className="min-w-0 max-w-[92%] [overflow-wrap:anywhere] [word-break:break-word]"
                >
                  <AssistantMarker />
                  {message.content ? (
                    message.role === "error" ? (
                      <div className="whitespace-pre-wrap rounded-[12px] bg-red-50 px-3 py-2 text-[13px] font-normal leading-5 text-red-700 [overflow-wrap:anywhere] [word-break:break-word]">
                        {message.content}
                      </div>
                    ) : (
                      <div className="chat-markdown mb-0 text-[13px] font-normal leading-6 text-[#3F4652]">
                        <MarkdownRenderer
                          content={message.content}
                          className="chat-markdown mb-0 text-[13px] font-normal leading-6 text-[#3F4652]"
                        />
                        {isSending &&
                          message.id === activeAssistantMessageId && (
                            <span
                              aria-hidden="true"
                              className="ml-1 inline-block h-4 w-0.5 animate-pulse rounded-full bg-[#98A2B3] align-middle"
                            />
                          )}
                      </div>
                    )
                  ) : (
                    <div className="text-[13px] font-normal leading-6 text-[#667085]">
                      {isSending && message.role === "assistant"
                        ? message.activity?.[message.activity.length - 1]
                          ?.label || "Working on it..."
                        : ""}
                    </div>
                  )}
                  {message.activity && message.activity.length > 0 && (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => toggleActivityExpanded(message.id)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-[#F8FAFC] px-2.5 py-1 text-left text-[11px] font-medium text-[#667085] transition-colors hover:bg-[#F1F5F9] hover:text-[#475467]"
                      >
                        {expandedActivityByMessage[message.id] ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )}
                        <span>Thinking</span>
                        {message.activity.some(
                          (item) => item.state === "running"
                        ) && (
                            <Loader2 className="h-3 w-3 animate-spin text-[#98A2B3]" />
                          )}
                      </button>

                      {expandedActivityByMessage[message.id] && (
                        <div className="mt-2 space-y-1 rounded-[12px] bg-[#F8FAFC] px-3 py-2">
                          {message.activity.map((activityItem) => (
                            <div
                              key={activityItem.id}
                              className="flex items-start gap-2 text-[12px] leading-5 text-[#667085]"
                            >
                              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#CBD5E1]" />
                              <span>{activityItem.label}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        onDragEnterCapture={handleDragOver}
        onDragOverCapture={handleDragOver}
        onDragLeave={handleDragLeave}
        onDropCapture={handleDrop}
        className={cn(
          "overflow-x-hidden rounded-[8px] border bg-white px-2.5 py-3 transition-colors",
          showEditorEmptyState ? "ml-[18px] mr-1" : "mx-4",
          showEditorEmptyState ? "mb-2" : "mb-4",
          isDraggingAttachment
            ? "border-[#7A5AF8] bg-[#F7F5FF]"
            : "border-[#F4F4F4]"
        )}
        style={{
          boxShadow: "0 4px 14px 0 rgba(0, 0, 0, 0.04)",
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          disabled={chatInputDisabled}
          accept="image/*,.pdf,.txt,.doc,.docx,.docm,.odt,.rtf,.ppt,.pptx,.pptm,.odp,.xls,.xlsx,.xlsm,.ods,.csv,.tsv,.tif,.tiff"
          className="hidden"
          onChange={handleAttachmentInputChange}
          aria-hidden="true"
          tabIndex={-1}
        />
        {(chatSlideReference || chatTargetReference) && (
          <div
            className="mb-2 flex max-w-full items-center gap-1.5 overflow-hidden"
            aria-label="Current editor selection"
          >
            {chatSlideReference && (
              <span
                className="inline-flex h-7 max-w-[86px] shrink-0 items-center gap-1 rounded-full border border-[#E8E3FF] bg-[#F8F6FF] pl-2.5 pr-1 font-manrope text-[11px] font-semibold text-[#6941C6] shadow-[0_1px_2px_rgba(105,65,198,0.06)]"
                title={chatSlideReference}
              >
                <span className="truncate">{chatSlideReference}</span>
                {onClearChatSlideReference && (
                  <button
                    type="button"
                    onClick={onClearChatSlideReference}
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[#8069C5] transition-colors hover:bg-[#E4DFFF] hover:text-[#5235A8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7A5AF8]/40"
                    aria-label={`Remove ${chatSlideReference} from context`}
                    title={`Remove ${chatSlideReference} from context`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            )}
            {chatTargetReference && (
              <span
                className="inline-flex h-7 min-w-0 max-w-[138px] items-center gap-1 rounded-full border border-[#DDD6FE] bg-[#F5F3FF] pl-2.5 pr-1 font-manrope text-[11px] font-semibold text-[#6941C6] shadow-[0_1px_2px_rgba(105,65,198,0.08)]"
                title={chatTargetReference}
              >
                <span className="truncate">{chatTargetReference}</span>
                {onClearChatTargetReference && (
                  <button
                    type="button"
                    onClick={onClearChatTargetReference}
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[#8069C5] transition-colors hover:bg-[#E4DFFF] hover:text-[#5235A8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7A5AF8]/40"
                    aria-label="Remove selected element from context"
                    title="Remove selected element from context"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            )}
          </div>
        )}
        {(pastedImages.length > 0 ||
          attachedDocuments.length > 0 ||
          chatLinks.length > 0 ||
          isUploadingPastedImage) && (
            <div className="mb-2 flex max-w-full flex-wrap items-center gap-1.5">
              {chatLinks.map((link) => (
                <span
                  key={link.id}
                  className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-[8px] border border-[#DBEAFE] bg-[#EFF6FF] px-2 py-1 text-xs font-medium text-[#1D4ED8]"
                >
                  <LinkIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
                  <span className="truncate">{link.url}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setChatLinks((previous) =>
                        previous.filter((item) => item.id !== link.id)
                      )
                    }
                    className="rounded-full p-0.5 text-[#2563EB] transition-colors hover:bg-[#DBEAFE]"
                    aria-label="Remove link"
                    title="Remove link"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {pastedImages.map((image) => (
                <span
                  key={image.id}
                  className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-[8px] border border-[#EDEEEF] bg-[#F9FAFB] px-2 py-1 text-xs font-medium text-[#344054]"
                >
                  <ImageIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
                  <span className="truncate">{image.name}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setPastedImages((previous) =>
                        previous.filter((item) => item.id !== image.id)
                      )
                    }
                    className="rounded-full p-0.5 text-[#667085] transition-colors hover:bg-[#E4E7EC]"
                    aria-label="Remove pasted image"
                    title="Remove pasted image"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {attachedDocuments.map((document) => (
                <span
                  key={document.id}
                  className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-[8px] border border-[#EDEEEF] bg-[#F9FAFB] px-2 py-1 text-xs font-medium text-[#344054]"
                >
                  <FileText className="h-3 w-3 shrink-0" aria-hidden="true" />
                  <span className="truncate">{document.name}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setAttachedDocuments((previous) =>
                        previous.filter((item) => item.id !== document.id)
                      )
                    }
                    className="rounded-full p-0.5 text-[#667085] transition-colors hover:bg-[#E4E7EC]"
                    aria-label="Remove attached document"
                    title="Remove attached document"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {isUploadingPastedImage && (
                <span className="inline-flex items-center gap-1.5 rounded-[8px] border border-[#EDEEEF] bg-[#F9FAFB] px-2 py-1 text-xs font-medium text-[#667085]">
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                  Processing attachment
                </span>
              )}
            </div>
          )}
        <textarea
          ref={inputRef}
          name="chat-input"
          id="chat-input"
          className={cn(
            "w-full resize-none overflow-x-hidden bg-transparent text-sm text-[#101828] placeholder:text-[#99A1AF] focus:outline-none focus:ring-0 [overflow-wrap:anywhere] [word-break:break-word]",
            showEditorEmptyState ? "min-h-[57px]" : "min-h-[92px]",
          )}
          rows={3}
          wrap="soft"
          value={input}
          disabled={chatInputDisabled}
          onChange={handleInputChange}
          onPaste={handlePaste}
          onDragEnterCapture={handleDragOver}
          onDragOverCapture={handleDragOver}
          onDropCapture={handleDrop}
          onKeyDown={handleKeyDown}
          placeholder={
            isOutlineVariant
              ? "Regenerate this outline"
              : showEditorEmptyState
                ? "Ask anything.\nType / to get Quick prompts."
                : isTemplateV2Variant
                  ? "Change slide 2 title"
                  : "Improve slide design"
          }
          aria-invalid={Boolean(errorMessage)}
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-[64px] border border-[#EDEEEF] bg-white px-3 py-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={!isTemplateV2Variant || chatInputDisabled}
                className="inline-flex h-[28px] items-center rounded-[64px] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Attach files"
                title={
                  isTemplateV2Variant
                    ? "Attach files"
                    : "Attachments are available in Template V2 chat"
                }
              >
                <Plus className="h-3 w-3 text-black" />
              </button>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="2"
                height="17"
                viewBox="0 0 2 17"
                fill="none"
              >
                <path d="M1 0V16.5" stroke="#EDECEC" strokeWidth="2" />
              </svg>
              <ToolTip
                content={
                  isFollowAgentEnabled
                    ? "Disable follow AI mode"
                    : "Enable follow AI mode"
                }
              >
                <button
                  type="button"
                  onClick={() =>
                    setIsFollowAgentEnabled((previous) => !previous)
                  }
                  disabled={isHistoryLoading || isSending}
                  className="inline-flex h-[28px] items-center gap-1 rounded-[64px] text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={
                    isFollowAgentEnabled
                      ? "Disable follow AI mode"
                      : "Enable follow AI mode"
                  }
                  title={
                    isFollowAgentEnabled
                      ? "Follow AI is on: auto-jump to active slide"
                      : "Follow AI is off"
                  }
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    viewBox="0 0 11 11"
                    fill="none"
                  >
                    <g clipPath="url(#clip0_6216_326)">
                      <path
                        d="M5.50008 10.0837C8.03139 10.0837 10.0834 8.03163 10.0834 5.50033C10.0834 2.96902 8.03139 0.916992 5.50008 0.916992C2.96878 0.916992 0.916748 2.96902 0.916748 5.50033C0.916748 8.03163 2.96878 10.0837 5.50008 10.0837Z"
                        stroke={isFollowAgentEnabled ? "#7A5AF8" : "#000000"}
                        strokeWidth="0.938667"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M10.0833 5.5H8.25"
                        stroke={isFollowAgentEnabled ? "#7A5AF8" : "#000000"}
                        strokeWidth="0.938667"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M2.75008 5.5H0.916748"
                        stroke={isFollowAgentEnabled ? "#7A5AF8" : "#000000"}
                        strokeWidth="0.938667"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M5.5 2.75033V0.916992"
                        stroke={isFollowAgentEnabled ? "#7A5AF8" : "#000000"}
                        strokeWidth="0.938667"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M5.5 10.0833V8.25"
                        stroke={isFollowAgentEnabled ? "#7A5AF8" : "#000000"}
                        strokeWidth="0.938667"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </g>
                    <defs>
                      <clipPath id="clip0_6216_326">
                        <rect width="11" height="11" fill="white" />
                      </clipPath>
                    </defs>
                  </svg>

                </button>
              </ToolTip>
            </div>
            <button
              type="button"
              onClick={() => inputRef.current?.focus()}
              disabled={chatInputDisabled}
              className="inline-flex h-[30px] items-center gap-1.5 rounded-[64px] border border-[#EDEEEF] bg-white px-3 text-[12px] font-medium text-[#4A4A4A] transition-colors hover:bg-[#FAFAFA] disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Focus prompt input"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 13 13"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M6.5 1.25c.22 2.93 1.32 4.03 4.25 4.25-2.93.22-4.03 1.32-4.25 4.25-.22-2.93-1.32-4.03-4.25-4.25 2.93-.22 4.03-1.32 4.25-4.25Z"
                  fill="#7A5AF8"
                />
                <path
                  d="M10.5 9.25c.1 1.3.6 1.8 1.9 1.9-1.3.1-1.8.6-1.9 1.9-.1-1.3-.6-1.8-1.9-1.9 1.3-.1 1.8-.6 1.9-1.9Z"
                  fill="#7A5AF8"
                />
              </svg>
              Prompt
            </button>
          </div>
          <div className="ml-auto mr-2 flex items-center gap-2">
            {isSending ? (
              <button
                type="button"
                onClick={stopStreaming}
                className="flex items-center gap-1.5 whitespace-nowrap rounded-[34px] border border-[#E4E7EC] bg-white px-3 py-2 text-sm font-medium text-[#344054] transition-colors hover:bg-[#F9FAFB]"
                aria-label="Stop chat response"
              >
                <Loader2
                  className="h-3 w-3 animate-spin text-[#667085]"
                  aria-hidden="true"
                />
                <Square className="h-3 w-3 fill-current" aria-hidden="true" />
                Stop
              </button>
            ) : (
              <button
                type="submit"
                disabled={
                  (!input.trim() &&
                    pastedImages.length === 0 &&
                    attachedDocuments.length === 0 &&
                    chatLinks.length === 0) ||
                  chatInputDisabled ||
                  isUploadingPastedImage
                }
                className="flex h-[34px] w-[34px] items-center justify-center rounded-full text-[#191919] transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  background:
                    "linear-gradient(270deg, #D5CAFC 2.4%, #E3D2EB 27.88%, #F4DCD3 69.23%, #FDE4C2 100%)",
                }}
                aria-label="Send prompt"
              >
                <ArrowUp className="h-4 w-4 text-[#191919]" />
              </button>
            )}
          </div>
        </div>
      </form>
      {showEditorEmptyState && (
        <div className="mb-[109px] ml-[18px] mr-1 flex shrink-0 gap-2 overflow-x-auto hide-scrollbar">
          {editorQuickPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => applyPrompt(prompt)}
              className="shrink-0 rounded-[64px] border border-[#EDEEEF] bg-white px-3 py-1.5 text-[11px] font-normal leading-4 text-[#686868] transition-colors hover:border-[#DCD8EA] hover:bg-[#FBFAFF]"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default Chat;
