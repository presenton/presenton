import { PresentationChatApi } from "../../../services/api/chat";
import type { ChatApiAdapter } from "./chat-types";

export const presentationChatAdapter: ChatApiAdapter = {
  listConversations: (resourceId, presentationType) =>
    PresentationChatApi.listConversations(resourceId, presentationType),
  getHistory: (resourceId, conversationId, presentationType) =>
    PresentationChatApi.getHistory(resourceId, conversationId, presentationType),
  deleteConversation: (resourceId, conversationId, presentationType) =>
    PresentationChatApi.deleteConversation(resourceId, conversationId, presentationType),
  streamMessage: (payload, handlers, options) =>
    PresentationChatApi.streamMessage(
      {
        presentation_id: payload.resourceId,
        presentation_type: payload.presentationType,
        message: payload.message,
        conversation_id: payload.conversation_id,
        attachments: payload.attachments,
      },
      handlers,
      options,
    ),
};
