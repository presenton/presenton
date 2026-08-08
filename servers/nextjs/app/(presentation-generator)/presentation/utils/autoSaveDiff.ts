import type { PresentationData } from "@/store/slices/presentationGeneration";

export interface AutoSaveSnapshot {
  presentationId: string;
  slideOrder: string[];
  slideFingerprints: Record<string, string>;
  metadataFingerprint: string;
}

export interface AutoSaveChanges {
  structuralChange: boolean;
  changedSlides: any[];
  metadataChanged: boolean;
}

export const fingerprintValue = (value: unknown): string =>
  JSON.stringify(value) ?? "";

const getSlideId = (slide: any): string | null =>
  typeof slide?.id === "string" && slide.id.length > 0 ? slide.id : null;

export const createAutoSaveSnapshot = (
  data: PresentationData
): AutoSaveSnapshot => {
  const slides = Array.isArray(data.slides) ? data.slides : [];
  const slideOrder: string[] = [];
  const slideFingerprints: Record<string, string> = {};

  for (const slide of slides) {
    const id = getSlideId(slide);
    if (!id) continue;
    slideOrder.push(id);
    slideFingerprints[id] = fingerprintValue(slide);
  }

  return {
    presentationId: data.id,
    slideOrder,
    slideFingerprints,
    metadataFingerprint: fingerprintValue({
      title: data.title,
      theme: data.theme,
    }),
  };
};

export const getAutoSaveChanges = (
  acknowledged: AutoSaveSnapshot,
  data: PresentationData
): AutoSaveChanges => {
  const slides = Array.isArray(data.slides) ? data.slides : [];
  const ids = slides.map(getSlideId);
  const validIds = ids.filter((id): id is string => id !== null);
  const hasInvalidOrDuplicateIds =
    validIds.length !== slides.length || new Set(validIds).size !== validIds.length;
  const orderChanged =
    validIds.length !== acknowledged.slideOrder.length ||
    validIds.some((id, index) => id !== acknowledged.slideOrder[index]);
  const indicesChanged = slides.some(
    (slide: any, index: number) => slide?.index !== index
  );
  const structuralChange =
    hasInvalidOrDuplicateIds || orderChanged || indicesChanged;

  const changedSlides = structuralChange
    ? []
    : slides.filter((slide: any) => {
        const id = getSlideId(slide);
        return (
          id !== null &&
          acknowledged.slideFingerprints[id] !== fingerprintValue(slide)
        );
      });

  return {
    structuralChange,
    changedSlides,
    metadataChanged:
      acknowledged.metadataFingerprint !==
      fingerprintValue({ title: data.title, theme: data.theme }),
  };
};
