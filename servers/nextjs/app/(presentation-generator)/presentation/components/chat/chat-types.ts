import type { TemplateV2SurfaceSelectedDetail } from "@/components/slide-editor/events/events";
import type { TemplateV2Layout } from "@/components/slide-editor/importing/template-v2-import";
import type {
  ChatAttachment,
  ChatConversationSummary,
  ChatHistoryMessage,
  ChatMessageResponse,
  ChatStreamHandlers,
} from "../../../services/api/chat";

export type AssistantActivity = {
  id: string;
  label: string;
  kind?: string;
  round?: number;
  tool?: string;
  state: "running" | "success" | "error" | "info";
};

export type ChatEditPreview = {
  originalSlides: unknown[];
  modifiedSlides?: unknown[];
  slideIndices: number[];
  changeCount: number;
};

export type ChatLayoutPreview = {
  layout: TemplateV2Layout;
  layoutId?: string | null;
  slideIndex?: number | null;
};

export type ChatContextTag = {
  id: string;
  label: string;
  title?: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "error";
  content: string;
  toolCalls?: string[];
  activity?: AssistantActivity[];
  layoutPreview?: ChatLayoutPreview;
  editPreview?: ChatEditPreview;
  /** Ephemeral UI-only context captured when the prompt is submitted. */
  contextTags?: ChatContextTag[];
};

export type SubmitMessageOptions = {
  backendContext?: string;
  layoutPreview?: ChatLayoutPreview;
};

export type PastedChatImage = {
  id: string;
  name: string;
  url: string;
  file?: File;
  extractedText?: string;
};

export type ChatLink = {
  id: string;
  url: string;
};

export type ChatDocumentAttachment = {
  id: string;
  name: string;
  filePath: string;
  mimeType?: string;
};

export type ChatApiAdapter = {
  listConversations: (
    resourceId: string,
    presentationType?: "standard" | "smart",
  ) => Promise<ChatConversationSummary[]>;
  getHistory: (
    resourceId: string,
    conversationId: string,
    presentationType?: "standard" | "smart",
  ) => Promise<{ messages: ChatHistoryMessage[] }>;
  deleteConversation: (
    resourceId: string,
    conversationId: string,
    presentationType?: "standard" | "smart",
  ) => Promise<void>;
  streamMessage: (
    payload: {
      resourceId: string;
      presentationType?: "standard" | "smart";
      message: string;
      conversation_id?: string;
      attachments?: ChatAttachment[];
    },
    handlers?: ChatStreamHandlers,
    options?: { signal?: AbortSignal },
  ) => Promise<ChatMessageResponse>;
};

export type ChatProps = {
  presentationId: string;
  presentationType?: "standard" | "smart";
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

export type AssistantPromptMetrics = {
  startedAt: number;
  attachmentImageCount: number;
  attachmentDocumentCount: number;
  linkCount: number;
  mutatingToolCount: number;
  readToolCount: number;
  uniqueTools: Set<string>;
  mutatedSlides: Set<number>;
};
