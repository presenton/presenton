export type LocalFontOption = {
  family: string;
  sourceUrl: string;
  italicSourceUrl?: string;
  faces?: LocalFontFace[];
  aliases?: string[];
};

type LocalFontFace = {
  sourceUrl: string;
  style: "italic" | "normal";
  weight: number | string;
};

export type TemplateFontOption = LocalFontOption;

const font = (
  family: string,
  category: string,
  directory: string,
  file: string,
  italicFile?: string,
): LocalFontOption => ({
  family,
  sourceUrl: `/vendor/fonts/${category}/${directory}/${file}`,
  ...(italicFile
    ? {
        italicSourceUrl: `/vendor/fonts/${category}/${directory}/${italicFile}`,
      }
    : {}),
});

const staticFont = (
  family: string,
  category: string,
  directory: string,
  files: string[],
): LocalFontOption => {
  const faces = files.map((fileName) => ({
    sourceUrl: `/vendor/fonts/${category}/${directory}/${fileName}`,
    style: /italic/i.test(fileName) ? "italic" as const : "normal" as const,
    weight: fontWeightFromFileName(fileName),
  }));
  const normalFace = faces.find(
    (face) => face.style === "normal" && face.weight === 400,
  ) ?? faces.find((face) => face.style === "normal") ?? faces[0];
  const italicFace = faces.find(
    (face) => face.style === "italic" && face.weight === 400,
  );
  return {
    family,
    sourceUrl: normalFace.sourceUrl,
    ...(italicFace ? { italicSourceUrl: italicFace.sourceUrl } : {}),
    faces,
  };
};

function fontWeightFromFileName(fileName: string) {
  if (/black/i.test(fileName)) return 900;
  if (/extra[-_ ]?bold/i.test(fileName)) return 800;
  if (/semi[-_ ]?bold/i.test(fileName)) return 600;
  if (/bold/i.test(fileName)) return 700;
  if (/medium/i.test(fileName)) return 500;
  if (/extra[-_ ]?light/i.test(fileName)) return 200;
  if (/light/i.test(fileName)) return 300;
  if (/thin/i.test(fileName)) return 100;
  return 400;
}

export const LOCAL_FONT_OPTIONS: LocalFontOption[] = [
  font("Abril Fatface", "display", "abrilfatface", "AbrilFatface-Regular.ttf"),
  font("Anton", "display", "anton", "Anton-Regular.ttf"),
  font("Archivo Black", "display", "archivoblack", "ArchivoBlack-Regular.ttf"),
  font("Bebas Neue", "display", "bebasneue", "BebasNeue-Regular.ttf"),
  font("Black Ops One", "display", "blackopsone", "BlackOpsOne-Regular.ttf"),
  font("Bungee", "display", "bungee", "Bungee-Regular.ttf"),
  font("Cinzel", "display", "cinzel", "Cinzel[wght].ttf"),
  font("Fugaz One", "display", "fugazone", "FugazOne-Regular.ttf"),
  font("League Spartan", "display", "leaguespartan", "LeagueSpartan[wght].ttf"),
  font("Lilita One", "display", "lilitaone", "LilitaOne-Regular.ttf"),
  font("Oswald", "display", "oswald", "Oswald[wght].ttf"),
  font("Righteous", "display", "righteous", "Righteous-Regular.ttf"),
  font("Russo One", "display", "russoone", "RussoOne-Regular.ttf"),
  font("Staatliches", "display", "staatliches", "Staatliches-Regular.ttf"),
  font("Unbounded", "display", "unbounded", "Unbounded[wght].ttf"),

  font("Architects Daughter", "handwritten", "architectsdaughter", "ArchitectsDaughter-Regular.ttf"),
  font("Caveat", "handwritten", "caveat", "Caveat[wght].ttf"),
  font("Coming Soon", "handwritten", "comingsoon", "ComingSoon-Regular.ttf"),
  font("Gloria Hallelujah", "handwritten", "gloriahallelujah", "GloriaHallelujah.ttf"),
  font("Indie Flower", "handwritten", "indieflower", "IndieFlower-Regular.ttf"),
  staticFont("Kalam", "handwritten", "kalam", ["Kalam-Light.ttf", "Kalam-Regular.ttf", "Kalam-Bold.ttf"]),
  font("Nanum Pen Script", "handwritten", "nanumpenscript", "NanumPenScript-Regular.ttf"),
  font("Patrick Hand", "handwritten", "patrickhand", "PatrickHand-Regular.ttf"),
  font("Schoolbell", "handwritten", "schoolbell", "Schoolbell-Regular.ttf"),
  font("Shadows Into Light", "handwritten", "shadowsintolight", "ShadowsIntoLight.ttf"),

  staticFont("Anonymous Pro", "monospace", "anonymouspro", ["AnonymousPro-Regular.ttf", "AnonymousPro-Italic.ttf", "AnonymousPro-Bold.ttf", "AnonymousPro-BoldItalic.ttf"]),
  font("Cutive Mono", "monospace", "cutivemono", "CutiveMono-Regular.ttf"),
  staticFont("DM Mono", "monospace", "dmmono", ["DMMono-Light.ttf", "DMMono-LightItalic.ttf", "DMMono-Regular.ttf", "DMMono-Italic.ttf", "DMMono-Medium.ttf", "DMMono-MediumItalic.ttf"]),
  font("Fira Code", "monospace", "firacode", "FiraCode[wght].ttf"),
  staticFont("Fira Mono", "monospace", "firamono", ["FiraMono-Regular.ttf", "FiraMono-Medium.ttf", "FiraMono-Bold.ttf"]),
  staticFont("IBM Plex Mono", "monospace", "ibmplexmono", ["IBMPlexMono-Thin.ttf", "IBMPlexMono-ThinItalic.ttf", "IBMPlexMono-ExtraLight.ttf", "IBMPlexMono-ExtraLightItalic.ttf", "IBMPlexMono-Light.ttf", "IBMPlexMono-LightItalic.ttf", "IBMPlexMono-Regular.ttf", "IBMPlexMono-Italic.ttf", "IBMPlexMono-Medium.ttf", "IBMPlexMono-MediumItalic.ttf", "IBMPlexMono-SemiBold.ttf", "IBMPlexMono-SemiBoldItalic.ttf", "IBMPlexMono-Bold.ttf", "IBMPlexMono-BoldItalic.ttf"]),
  font("Inconsolata", "monospace", "inconsolata", "Inconsolata[wdth,wght].ttf"),
  font("JetBrains Mono", "monospace", "jetbrainsmono", "JetBrainsMono[wght].ttf", "JetBrainsMono-Italic[wght].ttf"),
  font("Noto Sans Mono", "monospace", "notosansmono", "NotoSansMono[wdth,wght].ttf"),
  font("PT Mono", "monospace", "ptmono", "PTM55FT.ttf"),
  font("Red Hat Mono", "monospace", "redhatmono", "RedHatMono[wght].ttf", "RedHatMono-Italic[wght].ttf"),
  font("Roboto Mono", "monospace", "robotomono", "RobotoMono[wght].ttf", "RobotoMono-Italic[wght].ttf"),
  font("Source Code Pro", "monospace", "sourcecodepro", "SourceCodePro[wght].ttf", "SourceCodePro-Italic[wght].ttf"),
  staticFont("Space Mono", "monospace", "spacemono", ["SpaceMono-Regular.ttf", "SpaceMono-Italic.ttf", "SpaceMono-Bold.ttf", "SpaceMono-BoldItalic.ttf"]),
  staticFont("Ubuntu Mono", "monospace", "ubuntumono", ["UbuntuMono-Regular.ttf", "UbuntuMono-Italic.ttf", "UbuntuMono-Bold.ttf", "UbuntuMono-BoldItalic.ttf"]),

  font("DM Sans", "sans_serif", "dmsans", "DMSans[opsz,wght].ttf", "DMSans-Italic[opsz,wght].ttf"),
  font("Inter", "sans_serif", "inter", "Inter[opsz,wght].ttf", "Inter-Italic[opsz,wght].ttf"),
  staticFont("Lato", "sans_serif", "lato", ["Lato-Thin.ttf", "Lato-ThinItalic.ttf", "Lato-ExtraLight.ttf", "Lato-ExtraLightItalic.ttf", "Lato-Light.ttf", "Lato-LightItalic.ttf", "Lato-Regular.ttf", "Lato-Italic.ttf", "Lato-Medium.ttf", "Lato-MediumItalic.ttf", "Lato-SemiBold.ttf", "Lato-SemiBoldItalic.ttf", "Lato-Bold.ttf", "Lato-BoldItalic.ttf", "Lato-ExtraBold.ttf", "Lato-ExtraBoldItalic.ttf", "Lato-Black.ttf", "Lato-BlackItalic.ttf"]),
  font("Manrope", "sans_serif", "manrope", "Manrope[wght].ttf"),
  font("Montserrat", "sans_serif", "montserrat", "Montserrat[wght].ttf", "Montserrat-Italic[wght].ttf"),
  font("Mulish", "sans_serif", "mulish", "Mulish[wght].ttf", "Mulish-Italic[wght].ttf"),
  font("Nunito Sans", "sans_serif", "nunitosans", "NunitoSans[YTLC,opsz,wdth,wght].ttf", "NunitoSans-Italic[YTLC,opsz,wdth,wght].ttf"),
  font("Open Sans", "sans_serif", "opensans", "OpenSans[wdth,wght].ttf", "OpenSans-Italic[wdth,wght].ttf"),
  font("Outfit", "sans_serif", "outfit", "Outfit[wght].ttf"),
  font("Plus Jakarta Sans", "sans_serif", "plusjakartasans", "PlusJakartaSans[wght].ttf", "PlusJakartaSans-Italic[wght].ttf"),
  staticFont("Poppins", "sans_serif", "poppins", ["Poppins-Thin.ttf", "Poppins-ThinItalic.ttf", "Poppins-ExtraLight.ttf", "Poppins-ExtraLightItalic.ttf", "Poppins-Light.ttf", "Poppins-LightItalic.ttf", "Poppins-Regular.ttf", "Poppins-Italic.ttf", "Poppins-Medium.ttf", "Poppins-MediumItalic.ttf", "Poppins-SemiBold.ttf", "Poppins-SemiBoldItalic.ttf", "Poppins-Bold.ttf", "Poppins-BoldItalic.ttf", "Poppins-ExtraBold.ttf", "Poppins-ExtraBoldItalic.ttf", "Poppins-Black.ttf", "Poppins-BlackItalic.ttf"]),
  font("Roboto", "sans_serif", "roboto", "Roboto[wdth,wght].ttf", "Roboto-Italic[wdth,wght].ttf"),
  font("Rubik", "sans_serif", "rubik", "Rubik[wght].ttf", "Rubik-Italic[wght].ttf"),
  font("Source Sans 3", "sans_serif", "sourcesans3", "SourceSans3[wght].ttf", "SourceSans3-Italic[wght].ttf"),
  font("Work Sans", "sans_serif", "worksans", "WorkSans[wght].ttf", "WorkSans-Italic[wght].ttf"),

  font("Alex Brush", "script", "alexbrush", "AlexBrush-Regular.ttf"),
  font("Allura", "script", "allura", "Allura-Regular.ttf"),
  font("Dancing Script", "script", "dancingscript", "DancingScript[wght].ttf"),
  font("Great Vibes", "script", "greatvibes", "GreatVibes-Regular.ttf"),
  font("Italianno", "script", "italianno", "Italianno-Regular.ttf"),
  font("Parisienne", "script", "parisienne", "Parisienne-Regular.ttf"),
  font("Pinyon Script", "script", "pinyonscript", "PinyonScript-Regular.ttf"),
  font("Sacramento", "script", "sacramento", "Sacramento-Regular.ttf"),
  staticFont("Tangerine", "script", "tangerine", ["Tangerine-Regular.ttf", "Tangerine-Bold.ttf"]),
  font("Yellowtail", "script", "yellowtail", "Yellowtail-Regular.ttf"),

  staticFont("Cardo", "serif", "cardo", ["Cardo-Regular.ttf", "Cardo-Italic.ttf", "Cardo-Bold.ttf"]),
  font("Cormorant Garamond", "serif", "cormorantgaramond", "CormorantGaramond[wght].ttf", "CormorantGaramond-Italic[wght].ttf"),
  font("Crimson Pro", "serif", "crimsonpro", "CrimsonPro[wght].ttf", "CrimsonPro-Italic[wght].ttf"),
  staticFont("DM Serif Display", "serif", "dmserifdisplay", ["DMSerifDisplay-Regular.ttf", "DMSerifDisplay-Italic.ttf"]),
  font("EB Garamond", "serif", "ebgaramond", "EBGaramond[wght].ttf", "EBGaramond-Italic[wght].ttf"),
  font("Fraunces", "serif", "fraunces", "Fraunces[SOFT,WONK,opsz,wght].ttf", "Fraunces-Italic[SOFT,WONK,opsz,wght].ttf"),
  font("Libre Baskerville", "serif", "librebaskerville", "LibreBaskerville[wght].ttf", "LibreBaskerville-Italic[wght].ttf"),
  font("Lora", "serif", "lora", "Lora[wght].ttf", "Lora-Italic[wght].ttf"),
  font("Merriweather", "serif", "merriweather", "Merriweather[opsz,wdth,wght].ttf", "Merriweather-Italic[opsz,wdth,wght].ttf"),
  font("Newsreader", "serif", "newsreader", "Newsreader[opsz,wght].ttf", "Newsreader-Italic[opsz,wght].ttf"),
  font("Noto Serif", "serif", "notoserif", "NotoSerif[wdth,wght].ttf", "NotoSerif-Italic[wdth,wght].ttf"),
  font("Playfair Display", "serif", "playfairdisplay", "PlayfairDisplay[wght].ttf", "PlayfairDisplay-Italic[wght].ttf"),
  font("Source Serif 4", "serif", "sourceserif4", "SourceSerif4[opsz,wght].ttf", "SourceSerif4-Italic[opsz,wght].ttf"),
  staticFont("Spectral", "serif", "spectral", ["Spectral-ExtraLight.ttf", "Spectral-ExtraLightItalic.ttf", "Spectral-Light.ttf", "Spectral-LightItalic.ttf", "Spectral-Regular.ttf", "Spectral-Italic.ttf", "Spectral-Medium.ttf", "Spectral-MediumItalic.ttf", "Spectral-SemiBold.ttf", "Spectral-SemiBoldItalic.ttf", "Spectral-Bold.ttf", "Spectral-BoldItalic.ttf", "Spectral-ExtraBold.ttf", "Spectral-ExtraBoldItalic.ttf"]),
  font("Vollkorn", "serif", "vollkorn", "Vollkorn[wght].ttf", "Vollkorn-Italic[wght].ttf"),

  font("Aleo", "slab_serif", "aleo", "Aleo[wght].ttf", "Aleo-Italic[wght].ttf"),
  font("Alfa Slab One", "slab_serif", "alfaslabone", "AlfaSlabOne-Regular.ttf"),
  staticFont("Arvo", "slab_serif", "arvo", ["Arvo-Regular.ttf", "Arvo-Italic.ttf", "Arvo-Bold.ttf", "Arvo-BoldItalic.ttf"]),
  font("Bevan", "slab_serif", "bevan", "Bevan-Regular.ttf", "Bevan-Italic.ttf"),
  font("BioRhyme", "slab_serif", "biorhyme", "BioRhyme[wdth,wght].ttf"),
  font("Bitter", "slab_serif", "bitter", "Bitter[wght].ttf", "Bitter-Italic[wght].ttf"),
  font("Bree Serif", "slab_serif", "breeserif", "BreeSerif-Regular.ttf"),
  font("Crete Round", "slab_serif", "creteround", "CreteRound-Regular.ttf", "CreteRound-Italic.ttf"),
  font("Patua One", "slab_serif", "patuaone", "PatuaOne-Regular.ttf"),
  font("Roboto Slab", "slab_serif", "robotoslab", "RobotoSlab[wght].ttf"),
  font("Rokkitt", "slab_serif", "rokkitt", "Rokkitt[wght].ttf", "Rokkitt-Italic[wght].ttf"),
  font("Slabo 27px", "slab_serif", "slabo27px", "Slabo27px-Regular.ttf"),
  font("Suez One", "slab_serif", "suezone", "SuezOne-Regular.ttf"),
  font("Ultra", "slab_serif", "ultra", "Ultra-Regular.ttf"),
  staticFont("Zilla Slab", "slab_serif", "zillaslab", ["ZillaSlab-Light.ttf", "ZillaSlab-LightItalic.ttf", "ZillaSlab-Regular.ttf", "ZillaSlab-Italic.ttf", "ZillaSlab-Medium.ttf", "ZillaSlab-MediumItalic.ttf", "ZillaSlab-SemiBold.ttf", "ZillaSlab-SemiBoldItalic.ttf", "ZillaSlab-Bold.ttf", "ZillaSlab-BoldItalic.ttf"]),
];

const APPLICATION_FONT_OPTIONS: LocalFontOption[] = [
  {
    family: "Syne",
    sourceUrl: "/vendor/fonts/sans_serif/syne/Syne[wght].ttf",
  },
];

const SYSTEM_FONT_FAMILY_KEYS = new Set(
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

const LOCAL_FONT_BY_FAMILY = new Map(
  [...LOCAL_FONT_OPTIONS, ...APPLICATION_FONT_OPTIONS].map((option) => [
    fontFamilyKey(option.family),
    option,
  ]),
);
LOCAL_FONT_BY_FAMILY.set("inter variable", LOCAL_FONT_BY_FAMILY.get("inter")!);

const pendingFontDescriptorLoads = new Map<string, Promise<void>>();

export function localFontOptionForFamily(family: string) {
  return LOCAL_FONT_BY_FAMILY.get(fontFamilyKey(family)) ?? null;
}

export function isLocalFontFamily(family: string) {
  return localFontOptionForFamily(family) != null;
}

export function ensureLocalFontLoaded(family: string) {
  const option = localFontOptionForFamily(family);
  return option ? ensureFontOptionLoaded(option) : null;
}

export function ensureLocalFontsForDescriptors(
  descriptors: Iterable<string>,
  excludedFamilies: Iterable<string> = [],
) {
  const excludedFamilyKeys = new Set(
    Array.from(excludedFamilies).map(fontFamilyKey),
  );
  const loads: Promise<void>[] = [];

  Array.from(descriptors).forEach((descriptor) => {
    const family = fontFamilyFromFontDescriptor(descriptor);
    if (!family || excludedFamilyKeys.has(fontFamilyKey(family))) return;
    if (SYSTEM_FONT_FAMILY_KEYS.has(fontFamilyKey(family))) return;
    const load = ensureLocalFontLoaded(family);
    if (load) loads.push(load);
  });

  return loads;
}

export function templateFontOptionsFromMap(fonts: unknown): TemplateFontOption[] {
  return localFontOptionsFromUnknown(fonts);
}

export function localFontOptionsFromUnknown(value: unknown): LocalFontOption[] {
  const fontOptions = new Map<string, LocalFontOption>();

  const addFontOption = (option: LocalFontOption, preferSource = false) => {
    const key = fontFamilyKey(option.family);
    if (!key || (!preferSource && fontOptions.has(key))) return;
    fontOptions.set(key, option);
  };

  const addSourceFont = (
    family: unknown,
    sourceUrl: unknown,
    weight?: unknown,
    style?: unknown,
  ) => {
    if (typeof family !== "string" || typeof sourceUrl !== "string") return;
    const normalizedFamily = normalizeFontFamily(family);
    const normalizedSourceUrl = sourceUrl.trim();
    if (!normalizedFamily || !isFontAssetUrl(normalizedSourceUrl)) return;

    const catalogOption = localFontOptionForFamily(normalizedFamily);
    if (catalogOption && normalizedSourceUrl.startsWith("/vendor/fonts/")) {
      addFontOption(catalogOption, true);
      return;
    }

    const inferredWeight =
      readFontWeight(weight) ??
      fontWeightFromSource(normalizedFamily, normalizedSourceUrl);
    const inferredStyle =
      readFontStyle(style) ??
      (/italic/i.test(`${normalizedFamily} ${normalizedSourceUrl}`)
        ? "italic"
        : "normal");

    addFontOption(
      {
        family: normalizedFamily,
        sourceUrl: normalizedSourceUrl,
        faces: [
          {
            sourceUrl: normalizedSourceUrl,
            style: inferredStyle,
            weight: inferredWeight,
          },
        ],
        aliases: fontFamilyAliases(normalizedFamily),
      },
      true,
    );
  };

  const addFamily = (family: unknown) => {
    if (typeof family !== "string") return;
    family.split(",").forEach((candidate) => {
      const normalizedCandidate = candidate
        .trim()
        .replace(/\s*!important\s*$/i, "")
        .replace(/^(['"])(.*)\1$/, "$2")
        .trim();
      if (!normalizedCandidate) return;
      const option = localFontOptionForFamily(normalizedCandidate);
      if (option) addFontOption(option);
    });
  };

  const visit = (entry: unknown, fallbackFamily?: string) => {
    if (typeof entry === "string") {
      if (fallbackFamily && addableFontMapKey(fallbackFamily)) {
        addSourceFont(fallbackFamily, entry);
      }
      if (isFontFamilyField(fallbackFamily)) addFamily(entry);
      else addFamily(fallbackFamily);
      for (const match of entry.matchAll(
        /font-family\s*:\s*([^;{}]+)/gi,
      )) {
        addFamily(match[1]?.trim());
      }
      return;
    }
    if (Array.isArray(entry)) {
      entry.forEach((item) => visit(item, fallbackFamily));
      return;
    }
    if (!entry || typeof entry !== "object") return;

    const record = entry as Record<string, unknown>;
    const declaredFamily =
      record.family ??
      record.name ??
      record.font_name ??
      record.fontFamily ??
      record.font_family ??
      record["font-family"];
    const declaredSource =
      record.url ?? record.src ?? record.href ?? record.source ?? record.data;
    addSourceFont(
      declaredFamily ??
        (addableFontMapKey(fallbackFamily) ? fallbackFamily : undefined),
      declaredSource,
      record.weight ?? record.fontWeight ?? record.font_weight,
      record.style ?? record.fontStyle ?? record.font_style,
    );
    addFamily(declaredFamily);
    Object.entries(record).forEach(([key, nested]) => {
      if (
        [
          "family",
          "name",
          "font_name",
          "fontFamily",
          "font_family",
          "font-family",
        ].includes(key)
      ) {
        return;
      }
      if (!["css", "font_css", "fonts", "url", "src", "href", "source"].includes(key)) {
        addFamily(key);
      }
      visit(nested, key);
    });
  };

  visit(value);
  return Array.from(fontOptions.values());
}

function addableFontMapKey(field: string | undefined) {
  if (!field) return false;
  return ![
    "css",
    "font_css",
    "fonts",
    "url",
    "src",
    "href",
    "source",
    "data",
  ].includes(field.toLowerCase());
}

function isFontAssetUrl(value: string) {
  return (
    /^data:font\//i.test(value) ||
    /\.(?:eot|otf|ttf|woff2?)(?:[?#].*)?$/i.test(value)
  );
}

function normalizeFontFamily(value: string) {
  return value
    .trim()
    .replace(/\s*!important\s*$/i, "")
    .replace(/^(['"])(.*)\1$/, "$2")
    .trim();
}

function fontWeightFromSource(family: string, sourceUrl: string) {
  if (/\[[^\]]*wght[^\]]*\]/i.test(sourceUrl)) return "100 900";
  return fontWeightFromFileName(`${family} ${sourceUrl}`);
}

function readFontWeight(value: unknown): number | string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.min(1000, Math.max(1, Math.round(value)));
  }
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (/^\d{1,4}(?:\s+\d{1,4})?$/.test(normalized)) return normalized;
  return null;
}

function readFontStyle(value: unknown): "italic" | "normal" | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized === "italic" || normalized === "oblique"
    ? "italic"
    : normalized === "normal"
      ? "normal"
      : null;
}

function fontFamilyAliases(family: string) {
  const alias = family
    .replace(
      /\s+(?:thin|extra[-_ ]?light|light|regular|medium|semi[-_ ]?bold|bold|extra[-_ ]?bold|black)(?:\s+italic)?$/i,
      "",
    )
    .replace(/\s+italic$/i, "")
    .trim();
  return alias && fontFamilyKey(alias) !== fontFamilyKey(family) ? [alias] : [];
}

function isFontFamilyField(field: string | undefined) {
  if (!field) return false;
  return ["family", "fontfamily", "fontname"].includes(
    field.replace(/[-_\s]/g, "").toLowerCase(),
  );
}

export function ensureTemplateFontLoaded(fontOption: TemplateFontOption) {
  return ensureFontOptionLoaded(fontOption);
}

export function ensureTemplateFontsForDescriptors(
  descriptors: Iterable<string>,
  templateFonts: TemplateFontOption[],
) {
  const templateFontsByFamily = new Map<string, TemplateFontOption[]>();
  templateFonts.forEach((fontOption) => {
    [fontOption.family, ...(fontOption.aliases ?? [])].forEach((family) => {
      const key = fontFamilyKey(family);
      const options = templateFontsByFamily.get(key) ?? [];
      if (!options.includes(fontOption)) options.push(fontOption);
      templateFontsByFamily.set(key, options);
    });
  });
  const loads: Promise<void>[] = [];

  Array.from(descriptors).forEach((descriptor) => {
    const family = fontFamilyFromFontDescriptor(descriptor);
    const fontOptions = family
      ? templateFontsByFamily.get(fontFamilyKey(family)) ?? []
      : [];
    fontOptions.forEach((fontOption) => {
      const load = ensureFontOptionLoaded(fontOption);
      if (load) loads.push(load);
    });
  });

  return loads;
}

export function renderLocalFontFaceCss(fontOption: LocalFontOption) {
  const families = Array.from(
    new Set([fontOption.family, ...(fontOption.aliases ?? [])]),
  );
  if (fontOption.faces?.length) {
    return families
      .flatMap((family) =>
        fontOption.faces!.map(
          (face) =>
            `@font-face{font-family:"${escapeCssString(family)}";src:${fontSource(face.sourceUrl)};font-style:${face.style};font-weight:${face.weight};font-display:swap}`,
        ),
      )
      .join("");
  }
  return families
    .map((family) => {
      const escapedFamily = escapeCssString(family);
      const normalFace = `@font-face{font-family:"${escapedFamily}";src:${fontSource(fontOption.sourceUrl)};font-style:normal;font-weight:100 900;font-display:swap}`;
      const italicFace = fontOption.italicSourceUrl
        ? `@font-face{font-family:"${escapedFamily}";src:${fontSource(fontOption.italicSourceUrl)};font-style:italic;font-weight:100 900;font-display:swap}`
        : "";
      return `${normalFace}${italicFace}`;
    })
    .join("");
}

function fontSource(sourceUrl: string) {
  const assetPath = sourceUrl.split(/[?#]/, 1)[0]?.toLowerCase() ?? "";
  const format = assetPath.endsWith(".woff2")
    ? "woff2"
    : assetPath.endsWith(".woff")
      ? "woff"
      : assetPath.endsWith(".otf")
        ? "opentype"
        : assetPath.endsWith(".eot")
          ? "embedded-opentype"
          : "truetype";
  return `url("${escapeCssString(sourceUrl)}") format("${format}")`;
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
    3000,
  ).finally(() => {
    pendingFontDescriptorLoads.delete(cacheKey);
  });

  pendingFontDescriptorLoads.set(cacheKey, loadPromise);
  return loadPromise;
}

function ensureFontOptionLoaded(fontOption: LocalFontOption) {
  if (typeof document === "undefined") return null;

  const selector = `style[data-local-font-family="${escapeSelectorAttribute(fontOption.family)}"]`;
  const css = renderLocalFontFaceCss(fontOption);
  const catalogOption = localFontOptionForFamily(fontOption.family);
  const sourceKind = catalogOption === fontOption ? "vendor" : "template";
  let style = document.querySelector<HTMLStyleElement>(selector);
  if (!style) {
    style = document.createElement("style");
    style.setAttribute("data-local-font-family", fontOption.family);
    style.setAttribute("data-font-source", sourceKind);
    style.textContent = css;
    document.head.appendChild(style);
  } else if (
    style.textContent !== css &&
    (sourceKind === "template" || style.dataset.fontSource !== "template")
  ) {
    pendingFontDescriptorLoads.clear();
    style.setAttribute("data-font-source", sourceKind);
    style.textContent = css;
  }

  return waitForFontDescriptorsLoaded(fontFamilyLoadDescriptors(fontOption.family));
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
      if (timeoutId != null) window.clearTimeout(timeoutId);
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
  return match ? match[1].replace(/\\(["\\])/g, "$1") : null;
}

function fontFamilyKey(family: string) {
  return family.trim().toLowerCase();
}

function escapeCssString(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function escapeSelectorAttribute(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
