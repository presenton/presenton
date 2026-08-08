export type GoogleFontOption = {
  family: string;
  cssUrl: string;
};

export type TemplateFontOption = {
  family: string;
  sourceUrl: string;
};

type GoogleFontCatalogRecord = {
  font_name?: unknown;
  font_url?: unknown;
};

export const GOOGLE_FONT_OPTIONS: GoogleFontOption[] = [
  {
    family: "Inter",
    cssUrl:
      "https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap",
  },
  {
    family: "Syne",
    cssUrl:
      "https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&display=swap",
  },
  {
    family: "Unbounded",
    cssUrl:
      "https://fonts.googleapis.com/css2?family=Unbounded:wght@400;500;600;700;800&display=swap",
  },
  {
    family: "Public Sans",
    cssUrl:
      "https://fonts.googleapis.com/css2?family=Public+Sans:ital,wght@0,100..900;1,100..900&display=swap",
  },
  {
    family: "Albert Sans",
    cssUrl:
      "https://fonts.googleapis.com/css2?family=Albert+Sans:wght@400;500;600;700&display=swap",
  },
  {
    family: "DM Sans",
    cssUrl:
      "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap",
  },
  {
    family: "DM Serif Display",
    cssUrl:
      "https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&display=swap",
  },
  {
    family: "Overpass",
    cssUrl:
      "https://fonts.googleapis.com/css2?family=Overpass:wght@100..900&display=swap",
  },
  {
    family: "Barlow",
    cssUrl:
      "https://fonts.googleapis.com/css2?family=Barlow:wght@100..900&display=swap",
  },
  {
    family: "Nunito",
    cssUrl:
      "https://fonts.googleapis.com/css2?family=Nunito:wght@200..1000&display=swap",
  },
  {
    family: "Nunito Sans",
    cssUrl:
      "https://fonts.googleapis.com/css2?family=Nunito+Sans:ital,opsz,wght@0,6..12,200..1000;1,6..12,200..1000&display=swap",
  },
  {
    family: "Lora",
    cssUrl:
      "https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600;700&display=swap",
  },
  {
    family: "Instrument Sans",
    cssUrl:
      "https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wght@0,400..700;1,400..700&display=swap",
  },
  {
    family: "Roboto",
    cssUrl:
      "https://fonts.googleapis.com/css2?family=Roboto:wght@100..900&display=swap",
  },
  {
    family: "Roboto Slab",
    cssUrl:
      "https://fonts.googleapis.com/css2?family=Roboto+Slab:wght@100..900&display=swap",
  },
  {
    family: "Open Sans",
    cssUrl:
      "https://fonts.googleapis.com/css2?family=Open+Sans:wght@300..800&display=swap",
  },
  {
    family: "Lato",
    cssUrl:
      "https://fonts.googleapis.com/css2?family=Lato:wght@100..900&display=swap",
  },
  {
    family: "Source Sans 3",
    cssUrl:
      "https://fonts.googleapis.com/css2?family=Source+Sans+3:ital,wght@0,200..900;1,200..900&display=swap",
  },
  {
    family: "Source Sans Pro",
    cssUrl:
      "https://fonts.googleapis.com/css2?family=Source+Sans+Pro:wght@200..900&display=swap",
  },
  {
    family: "Source Serif 4",
    cssUrl:
      "https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,200..900;1,8..60,200..900&display=swap",
  },
  {
    family: "Montserrat",
    cssUrl:
      "https://fonts.googleapis.com/css2?family=Montserrat:wght@100..900&display=swap",
  },
  {
    family: "Poppins",
    cssUrl:
      "https://fonts.googleapis.com/css2?family=Poppins:wght@100..900&display=swap",
  },
  {
    family: "Playfair Display",
    cssUrl:
      "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400..900&display=swap",
  },
  {
    family: "Libre Baskerville",
    cssUrl:
      "https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;700&display=swap",
  },
  {
    family: "Prompt",
    cssUrl:
      "https://fonts.googleapis.com/css2?family=Prompt:wght@100..900&display=swap",
  },
  {
    family: "Inconsolata",
    cssUrl:
      "https://fonts.googleapis.com/css2?family=Inconsolata:wght@200..900&display=swap",
  },
  {
    family: "Fraunces",
    cssUrl:
      "https://fonts.googleapis.com/css2?family=Fraunces:wght@300..900&display=swap",
  },
  {
    family: "Gelasio",
    cssUrl:
      "https://fonts.googleapis.com/css2?family=Gelasio:wght@300..700&display=swap",
  },
  {
    family: "Raleway",
    cssUrl:
      "https://fonts.googleapis.com/css2?family=Raleway:wght@100..900&display=swap",
  },
  {
    family: "Kanit",
    cssUrl:
      "https://fonts.googleapis.com/css2?family=Kanit:wght@100..900&display=swap",
  },
  {
    family: "Corben",
    cssUrl:
      "https://fonts.googleapis.com/css2?family=Corben:wght@400;700&display=swap",
  },
  {
    family: "Noto Sans",
    cssUrl:
      "https://fonts.googleapis.com/css2?family=Noto+Sans:wght@100..900&display=swap",
  },
  {
    family: "Noto Serif",
    cssUrl:
      "https://fonts.googleapis.com/css2?family=Noto+Serif:wght@100..900&display=swap",
  },
  {
    family: "Work Sans",
    cssUrl:
      "https://fonts.googleapis.com/css2?family=Work+Sans:wght@100..900&display=swap",
  },
  {
    family: "Manrope",
    cssUrl:
      "https://fonts.googleapis.com/css2?family=Manrope:wght@200..800&display=swap",
  },
  {
    family: "Rubik",
    cssUrl:
      "https://fonts.googleapis.com/css2?family=Rubik:wght@300..900&display=swap",
  },
  {
    family: "Oswald",
    cssUrl:
      "https://fonts.googleapis.com/css2?family=Oswald:wght@200..700&display=swap",
  },
  {
    family: "Merriweather",
    cssUrl:
      "https://fonts.googleapis.com/css2?family=Merriweather:wght@300;400;700;900&display=swap",
  },
  {
    family: "Bebas Neue",
    cssUrl:
      "https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap",
  },
  {
    family: "Anton",
    cssUrl: "https://fonts.googleapis.com/css2?family=Anton&display=swap",
  },
  {
    family: "Archivo Black",
    cssUrl:
      "https://fonts.googleapis.com/css2?family=Archivo+Black&display=swap",
  },
];

const GOOGLE_FONT_STYLESHEET_TIMEOUT_MS = 2500;
const FONT_FACE_LOAD_TIMEOUT_MS = 3000;
const LOCAL_FONT_FAMILY_KEYS = new Set(
  [
    "arial",
    "helvetica",
    "times",
    "times new roman",
    "georgia",
    "courier",
    "courier new",
    "verdana",
    "tahoma",
    "trebuchet ms",
    "impact",
    "comic sans ms",
    "system-ui",
    "sans-serif",
    "serif",
    "monospace",
  ].map(fontFamilyKey),
);
const GOOGLE_FONT_URL_BY_FAMILY = new Map(
  GOOGLE_FONT_OPTIONS.map(({ family, cssUrl }) => [
    fontFamilyKey(family),
    cssUrl,
  ]),
);
let googleFontCatalogPromise: Promise<GoogleFontOption[]> | null = null;
let googleFontCatalogUrlByFamily: Map<string, string> | null = null;
const pendingStylesheetLoads = new Map<string, Promise<void>>();
const pendingFontDescriptorLoads = new Map<string, Promise<void>>();

export function isGoogleFontFamily(family: string) {
  return syncGoogleFontCssUrl(family) != null;
}

export function loadGoogleFontOptions() {
  if (!googleFontCatalogPromise) {
    googleFontCatalogPromise = import("../font.json")
      .then((module) => {
        const catalogOptions = googleFontOptionsFromCatalog(module.default);
        const options = mergeGoogleFontOptions(
          GOOGLE_FONT_OPTIONS,
          catalogOptions,
        );
        googleFontCatalogUrlByFamily = new Map(
          options.map(({ family, cssUrl }) => [fontFamilyKey(family), cssUrl]),
        );
        return options;
      })
      .catch((error) => {
        googleFontCatalogPromise = null;
        throw error;
      });
  }

  return googleFontCatalogPromise;
}

export function ensureGoogleFontLoaded(family: string) {
  if (typeof document === "undefined") return null;

  const normalizedFamily = family.trim();
  if (!normalizedFamily) return null;

  const cssUrl = syncGoogleFontCssUrl(normalizedFamily);
  if (cssUrl) {
    return ensureStylesheetLoaded(normalizedFamily, cssUrl);
  }

  return lazyGoogleFontCssUrl(normalizedFamily).then((lazyCssUrl) => {
    if (!lazyCssUrl || typeof document === "undefined") return;
    return ensureStylesheetLoaded(normalizedFamily, lazyCssUrl) ?? undefined;
  });
}

export function ensureGoogleFontsLoaded(families: Iterable<string>) {
  const loads: Promise<void>[] = [];

  Array.from(new Set(families)).forEach((family) => {
    const load = ensureGoogleFontLoaded(family);
    if (load) loads.push(load);
  });

  return loads;
}

export function ensureGoogleFontsForDescriptors(
  descriptors: Iterable<string>,
  excludedFamilies: Iterable<string> = [],
) {
  const families = new Set<string>();
  const excludedFamilySet = new Set(
    Array.from(excludedFamilies)
      .map((family) => family.trim())
      .filter(Boolean),
  );

  Array.from(descriptors).forEach((descriptor) => {
    const family = fontFamilyFromFontDescriptor(descriptor);
    if (!family) return;
    if (excludedFamilySet.has(family)) return;
    if (isLocalFontFamily(family)) return;
    families.add(family);
  });

  return ensureGoogleFontsLoaded(families);
}

function lazyGoogleFontCssUrl(family: string) {
  return loadGoogleFontOptions().then(
    () => syncGoogleFontCssUrl(family),
    () => null,
  );
}

function syncGoogleFontCssUrl(family: string) {
  const normalizedFamily = family.trim();
  if (!normalizedFamily) return null;
  const familyKey = fontFamilyKey(normalizedFamily);
  return (
    googleFontCatalogUrlByFamily?.get(familyKey) ??
    GOOGLE_FONT_URL_BY_FAMILY.get(familyKey) ??
    null
  );
}

function googleFontOptionsFromCatalog(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map(googleFontOptionFromCatalogRecord)
    .filter((option): option is GoogleFontOption => option != null);
}

function googleFontOptionFromCatalogRecord(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const record = value as GoogleFontCatalogRecord;
  if (typeof record.font_name !== "string") return null;
  if (typeof record.font_url !== "string") return null;

  const family = record.font_name.trim();
  const cssUrl = record.font_url.trim();
  if (!family || !cssUrl) return null;
  return { family, cssUrl };
}

function mergeGoogleFontOptions(
  ...optionLists: GoogleFontOption[][]
): GoogleFontOption[] {
  const orderedFamilies: string[] = [];
  const optionByFamily = new Map<string, GoogleFontOption>();

  optionLists.forEach((options) => {
    options.forEach((option) => {
      const family = option.family.trim();
      const cssUrl = option.cssUrl.trim();
      if (!family || !cssUrl) return;
      if (!optionByFamily.has(family)) {
        orderedFamilies.push(family);
      }
      optionByFamily.set(family, { family, cssUrl });
    });
  });

  return orderedFamilies.flatMap((family) => {
    const option = optionByFamily.get(family);
    return option ? [option] : [];
  });
}

function isLocalFontFamily(family: string) {
  return LOCAL_FONT_FAMILY_KEYS.has(fontFamilyKey(family));
}

function fontFamilyKey(family: string) {
  return family.trim().toLowerCase();
}

export function templateFontOptionsFromMap(
  fonts: unknown,
): TemplateFontOption[] {
  if (!fonts || typeof fonts !== "object" || Array.isArray(fonts)) return [];

  return Object.entries(fonts)
    .filter(
      (entry): entry is [string, string] =>
        typeof entry[0] === "string" &&
        entry[0].trim().length > 0 &&
        typeof entry[1] === "string" &&
        entry[1].trim().length > 0,
    )
    .map(([family, sourceUrl]) => ({
      family: family.trim(),
      sourceUrl: sourceUrl.trim(),
    }));
}

export function ensureTemplateFontLoaded(font: TemplateFontOption) {
  if (typeof document === "undefined") return null;

  if (isFontStylesheetUrl(font.sourceUrl)) {
    return ensureStylesheetLoaded(font.family, font.sourceUrl);
  }

  return ensureFontFaceLoaded(font.family, font.sourceUrl);
}

export function ensureTemplateFontsForDescriptors(
  descriptors: Iterable<string>,
  templateFonts: TemplateFontOption[],
) {
  const templateFontByFamily = new Map(
    templateFonts.map((font) => [font.family, font]),
  );
  const loads: Promise<void>[] = [];

  Array.from(descriptors).forEach((descriptor) => {
    const family = fontFamilyFromFontDescriptor(descriptor);
    const templateFont = family ? templateFontByFamily.get(family) : null;
    if (!templateFont) return;

    const load = ensureTemplateFontLoaded(templateFont);
    if (load) loads.push(load);
  });

  return loads;
}

export function waitForFontDescriptorsLoaded(descriptors: Iterable<string>) {
  if (typeof document === "undefined" || !document.fonts) {
    return Promise.resolve();
  }

  const normalizedDescriptors = Array.from(
    new Set(
      Array.from(descriptors)
        .map((descriptor) => descriptor.trim())
        .filter(Boolean),
    ),
  ).sort();
  if (!normalizedDescriptors.length) return Promise.resolve();

  const cacheKey = normalizedDescriptors.join("\n");
  const pendingLoad = pendingFontDescriptorLoads.get(cacheKey);
  if (pendingLoad) return pendingLoad;

  const fonts = document.fonts;
  const loadPromise = withTimeout(
    Promise.all(
      normalizedDescriptors.map((descriptor) =>
        loadFontDescriptor(fonts, descriptor),
      ),
    )
      .then(() => fonts.ready)
      .then(() => undefined),
    FONT_FACE_LOAD_TIMEOUT_MS,
  ).finally(() => {
    pendingFontDescriptorLoads.delete(cacheKey);
  });

  pendingFontDescriptorLoads.set(cacheKey, loadPromise);
  return loadPromise;
}

function findStylesheetLink(cssUrl: string) {
  return Array.from(
    document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'),
  ).find(
    (link) =>
      link.href === cssUrl ||
      link.getAttribute("href") === cssUrl ||
      link.getAttribute("data-font-url") === cssUrl,
  );
}

function ensureStylesheetLoaded(family: string, cssUrl: string) {
  const existingLink = findStylesheetLink(cssUrl);
  if (existingLink?.sheet) {
    return null;
  }

  const pendingLoad = pendingStylesheetLoads.get(cssUrl);
  if (pendingLoad) return pendingLoad;

  const link = existingLink ?? document.createElement("link");
  if (!existingLink) {
    link.rel = "stylesheet";
    link.href = cssUrl;
    link.setAttribute("data-font-url", cssUrl);
    link.setAttribute("data-slide-editor-font", family);
  }

  const loadPromise = waitForStylesheet(link).finally(() => {
    pendingStylesheetLoads.delete(cssUrl);
  });
  pendingStylesheetLoads.set(cssUrl, loadPromise);

  if (!existingLink) {
    document.head.appendChild(link);
  }

  return loadPromise;
}

function ensureFontFaceLoaded(family: string, sourceUrl: string) {
  if (findFontFaceStyle(family, sourceUrl)) {
    return waitForFontDescriptorsLoaded(fontFamilyLoadDescriptors(family));
  }

  const style = document.createElement("style");
  style.setAttribute("data-font-url", sourceUrl);
  style.setAttribute("data-font-family", family);
  style.textContent = `@font-face {
  font-family: "${escapeCssString(family)}";
  src: url("${escapeCssString(sourceUrl)}");
  font-style: normal;
  font-display: swap;
}`;
  document.head.appendChild(style);

  return waitForFontDescriptorsLoaded(fontFamilyLoadDescriptors(family));
}

function findFontFaceStyle(family: string, sourceUrl: string) {
  return Array.from(document.querySelectorAll<HTMLStyleElement>("style")).find(
    (style) =>
      style.getAttribute("data-font-url") === sourceUrl &&
      style.getAttribute("data-font-family") === family,
  );
}

function isFontStylesheetUrl(sourceUrl: string) {
  return (
    /\.css(\?|$)/i.test(sourceUrl) ||
    /fonts\.googleapis\.com/.test(sourceUrl)
  );
}

function waitForStylesheet(link: HTMLLinkElement) {
  return new Promise<void>((resolve) => {
    let settled = false;
    let timeoutId: number | null = null;
    const finish = () => {
      if (settled) return;
      settled = true;
      if (timeoutId != null) {
        window.clearTimeout(timeoutId);
      }
      link.removeEventListener("load", finish);
      link.removeEventListener("error", finish);
      resolve();
    };

    timeoutId = window.setTimeout(finish, GOOGLE_FONT_STYLESHEET_TIMEOUT_MS);
    link.addEventListener("load", finish, { once: true });
    link.addEventListener("error", finish, { once: true });
  });
}

function loadFontDescriptor(fonts: FontFaceSet, descriptor: string) {
  try {
    return fonts.load(descriptor).then(
      () => undefined,
      () => undefined,
    );
  } catch {
    return Promise.resolve();
  }
}

function withTimeout(promise: Promise<void>, timeoutMs: number) {
  return new Promise<void>((resolve) => {
    let settled = false;
    let timeoutId: number | null = null;
    const finish = () => {
      if (settled) return;
      settled = true;
      if (timeoutId != null) {
        window.clearTimeout(timeoutId);
      }
      resolve();
    };
    timeoutId = window.setTimeout(finish, timeoutMs);
    promise.then(finish, finish);
  });
}

function fontFamilyLoadDescriptors(family: string) {
  const escapedFamily = escapeCssString(family);
  return [`400 16px "${escapedFamily}"`, `700 16px "${escapedFamily}"`];
}

function fontFamilyFromFontDescriptor(descriptor: string) {
  const match = descriptor.match(/"((?:\\.|[^"])*)"\s*$/);
  if (!match) return null;
  return match[1].replace(/\\(["\\])/g, "$1");
}

function escapeCssString(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
