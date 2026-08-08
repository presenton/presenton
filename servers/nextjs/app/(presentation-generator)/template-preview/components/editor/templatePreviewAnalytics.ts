"use client";

import { useEffect, useRef } from "react";
import { sanitizeAnalyticsError } from "@/utils/analytics";
import { track as trackMixpanel } from "@/utils/mixpanel";

export const ANALYTICS_EVENTS = {
  TEMPLATE_PREVIEW_PAGE_VIEWED: "Template Preview Page Viewed",
  TEMPLATE_PREVIEW_LOADED: "Template Preview Loaded",
  TEMPLATE_PREVIEW_LOAD_FAILED: "Template Preview Load Failed",
  TEMPLATE_PREVIEW_LAYOUT_SELECTED: "Template Preview Layout Selected",
  TEMPLATE_PREVIEW_LAYOUT_ID_COPIED: "Template Preview Layout ID Copied",
  TEMPLATE_PREVIEW_SCHEMA_CHANGED: "Template Preview Schema Changed",
  TEMPLATE_PREVIEW_HISTORY_ACTION: "Template Preview History Action",
  TEMPLATE_PREVIEW_LAYOUT_DUPLICATED: "Template Preview Layout Duplicated",
  TEMPLATE_PREVIEW_LAYOUT_MOVED: "Template Preview Layout Moved",
  TEMPLATE_PREVIEW_LAYOUT_DELETED: "Template Preview Layout Deleted",
  TEMPLATE_ID_COPIED: "Template Preview ID Copied",
  TEMPLATE_PREVIEW_LAYOUT_RECONSTRUCT_REQUESTED:
    "Template Preview Layout Reconstruct Requested",
  TEMPLATE_PREVIEW_LAYOUT_RECONSTRUCTED:
    "Template Preview Layout Reconstructed",
  TEMPLATE_PREVIEW_LAYOUT_RECONSTRUCT_FAILED:
    "Template Preview Layout Reconstruct Failed",
  TEMPLATE_PREVIEW_TEMPLATE_SAVE_REQUESTED:
    "Template Preview Template Save Requested",
  TEMPLATE_PREVIEW_TEMPLATE_SAVED: "Template Preview Template Saved",
  TEMPLATE_PREVIEW_TEMPLATE_SAVE_FAILED:
    "Template Preview Template Save Failed",
  TEMPLATE_PREVIEW_TEMPLATE_DELETE_REQUESTED:
    "Template Preview Template Delete Requested",
  TEMPLATE_PREVIEW_TEMPLATE_DELETED: "Template Preview Template Deleted",
  TEMPLATE_PREVIEW_TEMPLATE_DELETE_FAILED:
    "Template Preview Template Delete Failed",
  TEMPLATE_PREVIEW_PANEL_SELECTED: "Template Preview Panel Selected",
  TEMPLATE_PREVIEW_AI_PROMPT_CAPTURED:
    "Template Preview AI Prompt Captured",
  TEMPLATE_PREVIEW_USER_PROMPT_SENT: "Template Preview User Prompt Sent",
  EDITOR_PALETTE_ITEM_INSERTED: "Editor Palette Item Inserted",
  EDITOR_TEMPLATE_BLOCK_INSERTED: "Editor Template Block Inserted",
} as const;

export function track(
  event: (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS],
  properties?: Record<string, unknown>,
) {
  trackMixpanel(event, properties);
}

export function bucketTextLength(value: string) {
  const length = value.trim().length;
  if (length === 0) return "0";
  if (length <= 100) return "1-100";
  if (length <= 500) return "101-500";
  if (length <= 2000) return "501-2000";
  return "2000+";
}

export function countWords(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

export function getPresentationErrorProperties(error: unknown) {
  return {
    error_message: sanitizeAnalyticsError(error),
  };
}

export function getUserSendTimeProperties() {
  const sentAt = new Date();
  let userTimezone = "unknown";

  try {
    userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown";
  } catch {
    // Time-zone detection is optional analytics context.
  }

  return {
    sent_at: sentAt.toISOString(),
    user_timezone: userTimezone,
    user_local_hour: sentAt.getHours(),
    user_local_day_of_week: sentAt.toLocaleDateString("en-US", {
      weekday: "long",
    }),
  };
}

export function useAnalyticsPageView(trackPageView: () => void) {
  const callbackRef = useRef(trackPageView);
  const trackedRef = useRef(false);

  useEffect(() => {
    callbackRef.current = trackPageView;
  }, [trackPageView]);

  useEffect(() => {
    if (trackedRef.current) return;
    callbackRef.current();
    trackedRef.current = true;
  }, []);
}
