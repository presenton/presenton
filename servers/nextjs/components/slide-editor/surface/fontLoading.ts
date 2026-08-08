"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ensureGoogleFontsForDescriptors,
  ensureTemplateFontsForDescriptors,
  waitForFontDescriptorsLoaded,
  type TemplateFontOption,
} from "@/components/slide-editor/text/google-fonts";
import {
  fontFromRecord,
  rawFont,
} from "@/components/slide-editor/text/template-v2-text";
import {
  asRecord,
  childArrayInfo,
  readArray,
  readString,
  type RawElement,
  type RawUi,
} from "@/components/slide-editor/model/model";

const EMPTY_TEMPLATE_FONTS: TemplateFontOption[] = [];

export function useFontLoadState(
  ui: RawUi,
  templateFonts: TemplateFontOption[] = EMPTY_TEMPLATE_FONTS,
  enabled = true,
) {
  const fontSignature = useMemo(
    () => (enabled ? fontLoadSignatureForUi(ui) : ""),
    [enabled, ui],
  );
  const [state, setState] = useState(() => ({
    revision: 0,
    ready: !fontSignature,
  }));

  useEffect(() => {
    if (
      typeof document === "undefined" ||
      !document.fonts ||
      !fontSignature
    ) {
      setState((current) =>
        current.ready ? current : { ...current, ready: true },
      );
      return;
    }

    let cancelled = false;
    let animationFrame: number | null = null;
    let readyFallbackTimeout: number | null = null;
    let headMutationObserver: MutationObserver | null = null;
    const markReady = () => {
      if (cancelled) return;
      setState((current) => ({
        revision: current.revision + 1,
        ready: true,
      }));
    };
    const scheduleReadyProbe = () => {
      if (cancelled) return;
      if (animationFrame != null) {
        window.cancelAnimationFrame(animationFrame);
      }
      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = null;
        if (areFontDescriptorsLoaded(fontSignature)) {
          markReady();
        }
      });
    };

    const fonts = document.fonts;
    const descriptors = fontSignature.split("\n").filter(Boolean);
    const templateFontFamilies = templateFonts.map(({ family }) => family);
    const stylesheetLoads = [
      ...ensureTemplateFontsForDescriptors(descriptors, templateFonts),
      ...ensureGoogleFontsForDescriptors(descriptors, templateFontFamilies),
    ];
    const fontsAlreadyReady =
      stylesheetLoads.length === 0 && areFontDescriptorsLoaded(fontSignature);
    setState((current) =>
      current.ready && fontsAlreadyReady
        ? current
        : { ...current, ready: false },
    );

    // Keep canvas hidden while we expect fonts, but never indefinitely.
    readyFallbackTimeout = window.setTimeout(markReady, 4000);
    void Promise.all(stylesheetLoads)
      .then(() => waitForFontDescriptorsLoaded(descriptors))
      .then(scheduleReadyProbe)
      .catch(scheduleReadyProbe);
    fonts.addEventListener?.("loadingdone", scheduleReadyProbe);
    fonts.addEventListener?.("loadingerror", scheduleReadyProbe);

    // Some font injections happen outside this hook; observe head changes and re-probe.
    if (typeof MutationObserver !== "undefined") {
      headMutationObserver = new MutationObserver((mutations) => {
        const changedFontNode = mutations.some((mutation) =>
          Array.from(mutation.addedNodes).some((node) => {
            if (!(node instanceof HTMLElement)) return false;
            if (node.tagName === "STYLE" || node.tagName === "LINK") return true;
            return false;
          }),
        );
        if (!changedFontNode) return;
        void fonts.ready.then(scheduleReadyProbe);
      });
      headMutationObserver.observe(document.head, {
        childList: true,
        subtree: true,
      });
    }

    return () => {
      cancelled = true;
      if (animationFrame != null) {
        window.cancelAnimationFrame(animationFrame);
      }
      if (readyFallbackTimeout != null) {
        window.clearTimeout(readyFallbackTimeout);
      }
      headMutationObserver?.disconnect();
      fonts.removeEventListener?.("loadingdone", scheduleReadyProbe);
      fonts.removeEventListener?.("loadingerror", scheduleReadyProbe);
    };
  }, [fontSignature, templateFonts]);

  return state;
}

function areFontDescriptorsLoaded(signature: string) {
  if (!signature || typeof document === "undefined" || !document.fonts) {
    return true;
  }
  return signature
    .split("\n")
    .filter(Boolean)
    .every((descriptor) => {
      try {
        return document.fonts.check(descriptor);
      } catch {
        return false;
      }
    });
}

function fontLoadSignatureForUi(ui: RawUi) {
  const descriptors = new Set<string>();
  const visitElement = (value: unknown) => {
    const element = asRecord(value);
    if (!element) return;
    collectElementFontDescriptors(element, descriptors);
    childArrayInfo(element)?.items.forEach(visitElement);
  };

  readArray(ui.elements).forEach(visitElement);
  readArray(ui.components).forEach((component) => {
    readArray(asRecord(component)?.elements).forEach(visitElement);
  });

  return Array.from(descriptors).sort().join("\n");
}

function collectElementFontDescriptors(
  element: RawElement,
  descriptors: Set<string>,
) {
  const type = readString(element.type);
  if (type !== "text" && type !== "text-list" && type !== "table") return;

  const baseFont = rawFont(element);
  addFontLoadDescriptor(baseFont, descriptors);
  collectRunFontDescriptors(element.runs, baseFont, descriptors);
  collectTextListFontDescriptors(element.items, baseFont, descriptors);
  collectTableFontDescriptors(element.columns, baseFont, descriptors);
  if (Array.isArray(element.rows)) {
    element.rows.forEach((row) =>
      collectTableFontDescriptors(row, baseFont, descriptors),
    );
  }
}

function collectRunFontDescriptors(
  value: unknown,
  fallback: ReturnType<typeof rawFont>,
  descriptors: Set<string>,
) {
  if (!Array.isArray(value)) return;
  value.forEach((run) => {
    const record = asRecord(run);
    if (record?.font) {
      addFontLoadDescriptor(
        fontFromRecord(asRecord(record.font), fallback),
        descriptors,
      );
    }
  });
}

function collectTextListFontDescriptors(
  value: unknown,
  fallback: ReturnType<typeof rawFont>,
  descriptors: Set<string>,
) {
  if (!Array.isArray(value)) return;
  value.forEach((item) => {
    if (Array.isArray(item)) {
      collectRunFontDescriptors(item, fallback, descriptors);
      return;
    }
    const record = asRecord(item);
    if (!record) return;
    if (record.font) {
      addFontLoadDescriptor(
        fontFromRecord(asRecord(record.font), fallback),
        descriptors,
      );
    }
    collectRunFontDescriptors(record.runs, fallback, descriptors);
  });
}

function collectTableFontDescriptors(
  value: unknown,
  fallback: ReturnType<typeof rawFont>,
  descriptors: Set<string>,
) {
  if (!Array.isArray(value)) return;
  value.forEach((cell) => {
    const record = asRecord(cell);
    if (!record) return;
    if (record.font) {
      addFontLoadDescriptor(
        fontFromRecord(asRecord(record.font), fallback),
        descriptors,
      );
    }
    collectRunFontDescriptors(record.runs, fallback, descriptors);

    const textRecord = asRecord(record.text);
    if (!textRecord) return;
    if (textRecord.font) {
      addFontLoadDescriptor(
        fontFromRecord(asRecord(textRecord.font), fallback),
        descriptors,
      );
    }
    collectRunFontDescriptors(textRecord.runs, fallback, descriptors);
  });
}

function addFontLoadDescriptor(
  font: ReturnType<typeof rawFont>,
  descriptors: Set<string>,
) {
  const family = font.family.trim();
  if (!family) return;
  const escapedFamily = family.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const style = font.italic ? "italic " : "";
  const weight = font.bold ? "700 " : "400 ";
  descriptors.add(`${style}${weight}16px "${escapedFamily}"`);
}
