
import {
  ensureTemplateFontLoaded,
  localFontOptionsFromUnknown,
} from "@/components/slide-editor/text/local-fonts";

export const useFontLoader = (fonts: Record<string, string>) => {
  localFontOptionsFromUnknown(fonts).forEach((font) => {
    void ensureTemplateFontLoaded(font);
  });
};
