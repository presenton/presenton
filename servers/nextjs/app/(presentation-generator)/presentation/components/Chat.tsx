"use client";

import {
  ChevronDown,
  ChevronRight,
  Loader2,
  LocateFixed,
  MessageCircleMore,
  Plus,
  RefreshCw,
  Send,
  Square,
  UserRound,
} from "lucide-react";
import React, {
  FormEvent,
  KeyboardEvent,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { notify } from "@/components/ui/sonner";
import MarkdownRenderer from "@/components/MarkDownRender";
import { PresentationChatApi } from "../../services/api/chat";
import type { ChatStreamTrace } from "../../services/api/chat";
import { is } from "@babel/types";
import ToolTip from "@/components/ToolTip";
import { cn } from "@/lib/utils";

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

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "error";
  content: string;
  toolCalls?: string[];
  activity?: AssistantActivity[];
};

type ChatProps = {
  presentationId: string;
  variant?: "presentation" | "outline";
  currentSlide?: number;
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

type AssistantActivity = {
  id: string;
  label: string;
  kind?: string;
  round?: number;
  tool?: string;
  state: "running" | "success" | "error" | "info";
};

const createMessageId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const conversationStorageKey = (presentationId: string) =>
  `presenton:chat:conversationId:${presentationId}`;

const AssistantMarker = () => (
  <div className="mb-3 flex items-center gap-1.5 text-[#A4A7AE]">
    <MessageCircleMore className="h-4 w-4" />
    <ChevronRight className="h-3 w-3" />
  </div>
);

const TOOL_LABELS: Record<string, string> = {
  getPresentationOutline: "Outline reader",
  getOutlineDraft: "Outline draft reader",
  addOutline: "Outline adder",
  updateOutline: "Outline editor",
  deleteOutline: "Outline remover",
  moveOutline: "Outline reorderer",
  searchSlides: "Slide search",
  getSlideAtIndex: "Slide reader",
  getPresentationThemeCatalog: "Theme catalog",
  getAvailableLayouts: "Layout finder",
  getContentSchemaFromLayoutId: "Schema checker",
  generateAssets: "Asset generator",
  saveSlide: "Slide saver",
  deleteSlide: "Slide remover",
  setPresentationTheme: "Theme applier",
};

const MUTATING_TOOLS = new Set([
  "addOutline",
  "updateOutline",
  "deleteOutline",
  "moveOutline",
  "saveSlide",
  "deleteSlide",
  "setPresentationTheme",
]);
// Only focus slides when the agent is actively mutating them.
// Read/open traces (e.g. getSlideAtIndex) can happen ahead of edits and feel jumpy.
const SLIDE_FOCUS_TOOLS = new Set(["saveSlide", "deleteSlide"]);
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
  if (lower.startsWith("using tools:")) {
    const toolNames = trimmed
      .slice("using tools:".length)
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => getToolLabel(entry));
    if (toolNames.length === 0) {
      return "Planning tool steps.";
    }
    return `Planning tools: ${toolNames.join(", ")}.`;
  }
  if (lower.includes("found requested data")) {
    if (tool === "getSlideAtIndex") {
      return "Found the requested slide details.";
    }
    if (tool === "getPresentationOutline") {
      return "Found the requested outline details.";
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
      label: `Running ${getToolLabel(trace.tool)}...`,
      kind: trace.kind,
      round: trace.round,
      tool: trace.tool,
      state: "running",
    };
  }

  if (trace.tool && trace.status === "success") {
    return {
      label: `${getToolLabel(trace.tool)} completed.`,
      kind: trace.kind,
      round: trace.round,
      tool: trace.tool,
      state: "success",
    };
  }

  if (trace.tool && trace.status === "error") {
    return {
      label: `${getToolLabel(trace.tool)} failed.`,
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
      label: `Planning tools: ${trace.tools
        .map((tool) => getToolLabel(tool))
        .join(", ")}.`,
      kind: trace.kind,
      round: trace.round,
      state: "info",
    };
  }

  return null;
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
  variant = "presentation",
  currentSlide,
  onBeforeSend,
  onPresentationChanged,
  onChatMutationStateChange,
  onAgentSlideFocus,
  onChatSendingStateChange,
  onFollowModeChange,
}: ChatProps) => {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isFollowAgentEnabled, setIsFollowAgentEnabled] = useState(true);
  const [activeMutationToolCount, setActiveMutationToolCount] = useState(0);
  const [activeAssistantMessageId, setActiveAssistantMessageId] = useState<
    string | null
  >(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expandedActivityByMessage, setExpandedActivityByMessage] = useState<
    Record<string, boolean>
  >({});

  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastFollowedTraceRef = useRef<string | null>(null);
  const focusEventSequenceRef = useRef(0);
  const activeFocusedSlideRef = useRef<number | null>(null);
  const pendingFocusTraceRef = useRef<ChatStreamTrace | null>(null);
  const lastFocusDispatchAtRef = useRef<number>(0);
  const focusDispatchTimerRef = useRef<number | null>(null);
  const refreshInFlightRef = useRef(false);
  const refreshQueuedRef = useRef(false);
  const didIncrementalRefreshRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setMessages([]);
    setInput("");
    setConversationId(null);
    setIsSending(false);
    setActiveMutationToolCount(0);
    setActiveAssistantMessageId(null);
    setErrorMessage(null);
    setExpandedActivityByMessage({});

    if (!presentationId) {
      return;
    }

    setIsHistoryLoading(true);
    const run = async () => {
      try {
        if (typeof sessionStorage === "undefined") {
          return;
        }
        const sKey = conversationStorageKey(presentationId);
        let activeId = sessionStorage.getItem(sKey) ?? null;
        if (!activeId) {
          const list = await PresentationChatApi.listConversations(
            presentationId
          );
          if (Array.isArray(list) && list.length > 0) {
            activeId = list[0]!.conversation_id;
            sessionStorage.setItem(sKey, activeId);
          }
        }
        if (!activeId) {
          return;
        }
        const data = await PresentationChatApi.getHistory(
          presentationId,
          activeId
        );
        if (cancelled) {
          return;
        }
        setConversationId(activeId);
        const rows = Array.isArray(data?.messages) ? data.messages : [];
        setMessages(
          rows.map((m) => ({
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
  }, [presentationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages, isSending]);

  useEffect(() => {
    onChatMutationStateChange?.(activeMutationToolCount > 0);
  }, [activeMutationToolCount, onChatMutationStateChange]);

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

  const updateMutationToolActivity = (
    tool: string | undefined,
    isActive: boolean
  ) => {
    if (!tool || !MUTATING_TOOLS.has(tool)) {
      return;
    }
    setActiveMutationToolCount((previous) =>
      Math.max(0, previous + (isActive ? 1 : -1))
    );
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

      const traceSignature = `${trace.round ?? "?"}:${trace.tool}:${
        trace.status
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

  const buildBackendMessage = (message: string) => {
    const contextLines: string[] = [];

    if (variant === "outline") {
      contextLines.push(
        "UI context: the user is editing the outline draft before template/layout selection. Use outline draft tools for outline add/edit/delete/reorder requests; do not use layout or finished-slide tools for outline-only edits."
      );
    }

    if (typeof currentSlide === "number") {
      contextLines.push(
        `UI context: the currently selected slide is slide ${
          currentSlide + 1
        } (zero-based index ${currentSlide}).`
      );
    }

    if (contextLines.length === 0) {
      return message;
    }

    return [...contextLines, `User message: ${message}`].join("\n");
  };

  const resetChat = () => {
    setMessages([]);
    setInput("");
    setConversationId(null);
    setActiveMutationToolCount(0);
    setErrorMessage(null);
    setExpandedActivityByMessage({});
    if (presentationId && typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem(conversationStorageKey(presentationId));
    }

    inputRef.current?.focus();
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

  const submitMessage = async (rawMessage: string) => {
    const trimmedMessage = rawMessage.trim();

    if (!trimmedMessage || isSending || isHistoryLoading) {
      return;
    }

    if (!presentationId) {
      notify.error(
        "Presentation not ready",
        "The presentation is not ready yet."
      );
      return;
    }

    const userMessage: ChatMessage = {
      id: createMessageId(),
      role: "user",
      content: trimmedMessage,
    };

    const assistantMessageId = createMessageId();
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
    setIsSending(true);
    setActiveAssistantMessageId(assistantMessageId);
    didIncrementalRefreshRef.current = false;
    refreshQueuedRef.current = false;
    refreshInFlightRef.current = false;
    const streamAbortController = new AbortController();
    abortControllerRef.current = streamAbortController;

    try {
      await onBeforeSend?.();
      const response = await PresentationChatApi.streamMessage(
        {
          presentation_id: presentationId,
          message: buildBackendMessage(trimmedMessage),
          conversation_id: conversationId ?? undefined,
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
            maybeFollowAgentSlide(trace);
            if (
              trace.status === "success" &&
              trace.tool &&
              MUTATING_TOOLS.has(trace.tool)
            ) {
              void refreshPresentationIncrementally();
            }
            if (trace.status === "start") {
              updateMutationToolActivity(trace.tool, true);
            } else if (trace.status === "success" || trace.status === "error") {
              updateMutationToolActivity(trace.tool, false);
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
      setConversationId((previous) => {
        const next =
          typeof response.conversation_id === "string"
            ? response.conversation_id
            : previous;
        if (next && presentationId && typeof sessionStorage !== "undefined") {
          sessionStorage.setItem(conversationStorageKey(presentationId), next);
        }
        return next;
      });

      await refreshPresentationIfNeeded(
        Array.isArray(response.tool_calls) ? response.tool_calls : []
      );
    } catch (error) {
      if (isAbortError(error)) {
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
      setActiveMutationToolCount(0);
      if (abortControllerRef.current === streamAbortController) {
        abortControllerRef.current = null;
      }
      setActiveAssistantMessageId((current) =>
        current === assistantMessageId ? null : current
      );
      setIsSending(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submitMessage(input);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitMessage(input);
    }
  };

  const applyPrompt = (prompt: string) => {
    setInput(prompt);
    setErrorMessage(null);
    inputRef.current?.focus();
  };

  const isOutlineVariant = variant === "outline";

  return (
    <div className={cn("flex h-full w-full flex-col bg-white", "")}>
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
        {!isOutlineVariant && (
          <button
            type="button"
            onClick={resetChat}
            disabled={isSending || isHistoryLoading}
            className="rounded-full p-1 text-[#8C8C8C] transition-colors hover:bg-[#F7F7F7] hover:text-[#191919] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Reset chat"
            title="Reset chat"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-9 [scrollbar-color:#C7CBD6_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#C7CBD6] [&::-webkit-scrollbar-track]:bg-transparent">
        {isHistoryLoading && messages.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-sm text-[#99A1AF]">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading chat…
          </div>
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
            ) : (
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
                      className="flex cursor-pointer items-center gap-3 rounded-[10px] border border-[#F4F4F4] px-3 py-2 text-left transition-colors hover:bg-[#FAFAFA]"
                    >
                      {suggestion.icon}
                      <span className="text-xs font-normal leading-[15px] tracking-[0.367px] text-[#364153]">
                        {suggestion.suggestion}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col gap-9">
            {messages.map((message) =>
              message.role === "user" ? (
                <div
                  key={message.id}
                  className="flex items-start justify-end gap-2"
                >
                  <div className="max-w-[78%] rounded-[20px] bg-[#A100FF] px-4 py-3 text-sm font-medium leading-5 text-white">
                    <p className="whitespace-pre-wrap">
                      {stripBackendContextFromUserMessage(message.content)}
                    </p>
                  </div>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FF8617] text-white">
                    <UserRound className="h-4 w-4" aria-hidden="true" />
                  </div>
                </div>
              ) : (
                <div key={message.id} className="max-w-[92%]">
                  <AssistantMarker />
                  {message.content ? (
                    message.role === "error" ? (
                      <div className="whitespace-pre-wrap text-sm font-normal leading-5 text-red-600">
                        {message.content}
                      </div>
                    ) : (
                      <div className="chat-markdown mb-0 text-sm font-normal leading-5 text-[#535862]">
                        <MarkdownRenderer
                          content={message.content}
                          className="chat-markdown mb-0 text-sm font-normal leading-5 text-[#535862]"
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
                    <div className="text-sm font-normal leading-5 text-[#535862]">
                      {isSending && message.role === "assistant"
                        ? message.activity?.[message.activity.length - 1]
                            ?.label || "Working on it..."
                        : ""}
                    </div>
                  )}
                  {message.activity && message.activity.length > 0 && (
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() => toggleActivityExpanded(message.id)}
                        className="inline-flex items-center gap-1 text-left text-xs font-medium text-[#667085] hover:text-[#475467]"
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
                        <div className="mt-2 space-y-1.5 pl-4">
                          {message.activity.map((activityItem) => (
                            <div
                              key={activityItem.id}
                              className="text-xs leading-4 text-[#667085]"
                            >
                              {activityItem.tool && (
                                <span className="mr-1 text-[#475467]">
                                  {getToolLabel(activityItem.tool)}:
                                </span>
                              )}
                              <span>{activityItem.label}</span>
                            </div>
                          ))}
                          {message.toolCalls &&
                            message.toolCalls.length > 0 && (
                              <div className="pt-0.5 text-[11px] text-[#98A2B3]">
                                Tools called: {message.toolCalls.join(", ")}
                              </div>
                            )}
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
        className="mx-4 mb-4 rounded-[8px] border border-[#F4F4F4] bg-white px-2.5 py-3"
        style={{
          boxShadow: "0 4px 14px 0 rgba(0, 0, 0, 0.04)",
        }}
      >
        <textarea
          ref={inputRef}
          name="chat-input"
          id="chat-input"
          className="min-h-[92px] w-full resize-none bg-transparent text-sm text-[#101828] placeholder:text-[#99A1AF] focus:outline-none focus:ring-0"
          rows={3}
          value={input}
          disabled={isSending || isHistoryLoading}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isOutlineVariant
              ? "Regenerate this outline"
              : "Improve your slides..."
          }
          aria-invalid={Boolean(errorMessage)}
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 border border-[#EDEEEF] bg-white px-3 py-1 rounded-[64px]">
            <button
              type="button"
              disabled
              className="inline-flex h-[28px] items-center rounded-[64px] disabled:opacity-50"
              aria-label="Attach files"
              title="Attachments are not supported yet"
            >
              <Plus className="h-3 w-3 text-black" />
            </button>
            <svg
              className="mx-[8px]"
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
                onClick={() => setIsFollowAgentEnabled((previous) => !previous)}
                disabled={isHistoryLoading || isSending}
                className={`inline-flex h-[28px] items-center gap-1 rounded-[64px]  text-[11px] font-medium transition-colors  disabled:cursor-not-allowed disabled:opacity-50`}
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

                {/* <span>{isFollowAgentEnabled ? "Following" : "Follow AI"}</span> */}
              </button>
            </ToolTip>
          </div>
          <div className="ml-auto flex items-center gap-2">
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
                disabled={!input.trim() || isHistoryLoading}
                className="flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-sm font-medium text-[#191919] disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  background:
                    "linear-gradient(270deg, #D5CAFC 2.4%, #E3D2EB 27.88%, #F4DCD3 69.23%, #FDE4C2 100%)",
                  borderRadius: "34px",
                }}
              >
                <Send className="h-3 w-3 text-[#191919]" />
                Send
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};

export default Chat;
