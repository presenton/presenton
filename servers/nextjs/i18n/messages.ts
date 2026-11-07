import en from "../messages/en.json";
import ar from "../messages/ar.json";

type Messages = Record<string, unknown>;

// Catalogs are imported statically so they are bundled into the server output.
// That removes any runtime file dependency, which is what makes `output:
// "standalone"` (and the Docker images built from it) work without extra copies.
const CATALOGS: Record<string, Messages> = { en, ar };

function isPlainObject(value: unknown): value is Messages {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepMerge(base: Messages, override: Messages): Messages {
  const merged: Messages = { ...base };

  for (const [key, value] of Object.entries(override)) {
    const current = merged[key];
    if (isPlainObject(value) && isPlainObject(current)) {
      merged[key] = deepMerge(current, value);
    } else if (value !== undefined) {
      merged[key] = value;
    }
  }

  return merged;
}

/**
 * Returns the catalog for `locale`, with English filling any missing keys.
 * Partial community translations therefore degrade to English instead of
 * rendering raw message keys.
 */
export function getMessages(locale: string): Messages {
  const fallback = CATALOGS.en ?? {};
  const catalog = CATALOGS[locale];

  if (!catalog || locale === "en") {
    return fallback;
  }

  return deepMerge(fallback, catalog);
}
