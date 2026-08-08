"use client";

import { useCallback, useEffect, useState } from "react";

type UseNearViewportOptions = {
  enabled?: boolean;
  forceActive?: boolean;
  rootMargin?: string;
  rootSelector?: string;
};

export function useNearViewport<T extends Element>({
  enabled = true,
  forceActive = false,
  rootMargin = "0px",
  rootSelector,
}: UseNearViewportOptions = {}) {
  const [element, setElement] = useState<T | null>(null);
  const [isNearViewport, setIsNearViewport] = useState(
    () => !enabled || forceActive,
  );
  const ref = useCallback((node: T | null) => setElement(node), []);

  useEffect(() => {
    if (!enabled || forceActive) {
      setIsNearViewport(true);
      return;
    }
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") {
      setIsNearViewport(true);
      return;
    }

    const candidateRoot = rootSelector
      ? element.closest(rootSelector)
      : null;
    const root = candidateRoot instanceof Element ? candidateRoot : null;
    const observer = new IntersectionObserver(
      ([entry]) => setIsNearViewport(entry?.isIntersecting === true),
      { root, rootMargin },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [element, enabled, forceActive, rootMargin, rootSelector]);

  return { isNearViewport, ref };
}
