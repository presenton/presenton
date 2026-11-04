export const LOCALE_COOKIE = "NEXT_LOCALE";

export const SUPPORTED_LOCALES = [
  { code: "en", label: "English", dir: "ltr" },
  { code: "ar", label: "العربية", dir: "rtl" },
] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number]["code"];

export const DEFAULT_LOCALE: AppLocale = "en";

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return SUPPORTED_LOCALES.some((locale) => locale.code === value);
}

export function getLocaleDir(locale: string): "ltr" | "rtl" {
  return SUPPORTED_LOCALES.find((entry) => entry.code === locale)?.dir ?? "ltr";
}

/**
 * Resolution order: explicit cookie preference, then Accept-Language, then English.
 * Accept-Language is matched on the base tag so "ar-EG" resolves to "ar".
 */
export function resolveLocale(
  cookieLocale: string | null | undefined,
  acceptLanguage: string | null | undefined,
): AppLocale {
  if (isAppLocale(cookieLocale)) {
    return cookieLocale;
  }

  const ranked = (acceptLanguage ?? "")
    .split(",")
    .map((part) => {
      const [tag, quality] = part.trim().split(";q=");
      return { tag: tag.trim().toLowerCase(), quality: quality ? Number(quality) : 1 };
    })
    .filter((entry) => entry.tag.length > 0)
    .sort((a, b) => b.quality - a.quality);

  for (const { tag } of ranked) {
    const base = tag.split("-")[0];
    if (isAppLocale(base)) {
      return base;
    }
  }

  return DEFAULT_LOCALE;
}
