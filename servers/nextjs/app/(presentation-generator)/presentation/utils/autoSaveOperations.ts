import type { PresentationData } from "@/store/slices/presentationGeneration";
import {
  type AutoSaveSnapshot,
  fingerprintValue,
  getAutoSaveChanges,
} from "./autoSaveDiff";

export const MUTABLE_SLIDE_FIELDS = [
  "layout_group",
  "layout",
  "content",
  "html_content",
  "speaker_note",
  "properties",
  "ui",
] as const;

export type EditorOperation = {
  scope: "document" | "slide";
  targetIds: string[];
  operationType:
    | "UpdateMetadata"
    | "UpdateSlide"
    | "InsertSlide"
    | "DeleteSlide"
    | "MoveSlide";
  payload: Record<string, unknown>;
};

const slideId = (slide: { id?: unknown }): string | null =>
  typeof slide?.id === "string" && slide.id.length > 0 ? slide.id : null;

const mutablePayload = (slide: Record<string, unknown>) => {
  const payload: Record<string, unknown> = {};
  for (const key of MUTABLE_SLIDE_FIELDS) {
    if (key in slide) payload[key] = slide[key];
  }
  return payload;
};

export const buildAutoSaveOperations = (
  acknowledged: AutoSaveSnapshot,
  data: PresentationData
): EditorOperation[] => {
  const slides = Array.isArray(data.slides) ? data.slides : [];
  const newIds = slides
    .map(slideId)
    .filter((id): id is string => id !== null);
  const operations: EditorOperation[] = [];
  const changes = getAutoSaveChanges(acknowledged, data);

  if (changes.metadataChanged) {
    operations.push({
      scope: "document",
      targetIds: [],
      operationType: "UpdateMetadata",
      payload: { title: data.title, theme: data.theme },
    });
  }

  if (!changes.structuralChange) {
    for (const slide of changes.changedSlides) {
      const id = slideId(slide);
      if (!id) continue;
      operations.push({
        scope: "slide",
        targetIds: [id],
        operationType: "UpdateSlide",
        payload: mutablePayload(slide),
      });
    }
    return operations;
  }

  const oldIds = acknowledged.slideOrder;
  const newIdSet = new Set(newIds);
  for (const id of oldIds) {
    if (!newIdSet.has(id)) {
      operations.push({
        scope: "slide",
        targetIds: [id],
        operationType: "DeleteSlide",
        payload: {},
      });
    }
  }

  const oldIdSet = new Set(oldIds);
  const working = oldIds.filter((id) => newIdSet.has(id));
  slides.forEach((slide: Record<string, unknown>, index: number) => {
    const id = slideId(slide);
    if (!id || oldIdSet.has(id)) return;
    operations.push({
      scope: "document",
      targetIds: [],
      operationType: "InsertSlide",
      payload: {
        id,
        index,
        ...mutablePayload(slide),
      },
    });
    working.splice(Math.min(index, working.length), 0, id);
  });

  newIds.forEach((id, targetIndex) => {
    const currentIndex = working.indexOf(id);
    if (currentIndex === targetIndex) return;
    working.splice(currentIndex, 1);
    working.splice(targetIndex, 0, id);
    operations.push({
      scope: "slide",
      targetIds: [id],
      operationType: "MoveSlide",
      payload: { index: targetIndex },
    });
  });

  slides.forEach((slide: Record<string, unknown>) => {
    const id = slideId(slide);
    if (!id || !oldIdSet.has(id)) return;
    if (acknowledged.slideFingerprints[id] === fingerprintValue(slide)) return;
    operations.push({
      scope: "slide",
      targetIds: [id],
      operationType: "UpdateSlide",
      payload: mutablePayload(slide),
    });
  });

  return operations;
};
