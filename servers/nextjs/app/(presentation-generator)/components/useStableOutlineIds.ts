import { useId, useMemo } from "react";

const hashOutlineContent = (content: string) => {
  let hash = 0;

  for (let index = 0; index < content.length; index += 1) {
    hash = (hash * 31 + content.charCodeAt(index)) | 0;
  }

  return Math.abs(hash).toString(36);
};

export const useStableOutlineIds = <T>(
  outlines: T[] | null,
  getContent: (item: T) => string
) => {
  const scopeId = useId().replace(/:/g, "");

  return useMemo(() => {
    const contentOccurrences = new Map<string, number>();

    return (outlines ?? []).map((outline) => {
      const contentHash = hashOutlineContent(getContent(outline));
      const occurrence = contentOccurrences.get(contentHash) ?? 0;
      contentOccurrences.set(contentHash, occurrence + 1);

      return `${scopeId}-outline-${contentHash}-${occurrence}`;
    });
  }, [getContent, outlines, scopeId]);
};
