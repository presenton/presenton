import { getFastAPIUrl } from "./api";

function normalizePathSeparators(value: string): string {
  return value.replace(/\\/g, "/");
}

function toServedPath(rawPath: string): string {
  const normalized = normalizePathSeparators(decodeURIComponent(rawPath));

  // Never rewrite Next.js bundled/static assets.
  // Example: /_next/static/media/*.svg should stay unchanged.
  if (normalized.startsWith("/_next/static/")) {
    return normalized;
  }

  // Prefer canonical FastAPI-mounted roots when present.
  const appDataIdx = normalized.indexOf("/app_data/");
  if (appDataIdx !== -1) {
    return normalized.slice(appDataIdx);
  }

  const staticIdx = normalized.indexOf("/static/");
  if (staticIdx !== -1) {
    return normalized.slice(staticIdx);
  }

  // Windows absolute path in URL form: /C:/Users/.../images/foo.png
  // Map anything under an images folder to FastAPI app_data mount.
  const imagesIdx = normalized.lastIndexOf("/images/");
  if (imagesIdx !== -1) {
    return `/app_data${normalized.slice(imagesIdx)}`;
  }

  return normalized;
}

function toFastApiStaticUrl(fileSrc: string): string {
  try {
    const baseUrl = getFastAPIUrl();
    const url = new URL(fileSrc);
    const servedPath = toServedPath(url.pathname);
    return `${baseUrl}${servedPath}`;
  } catch {
    // If URL parsing fails, leave as-is
    return fileSrc;
  }
}

function normalizeImageSrc(src: string): string {
  // If already an absolute HTTP(S) URL, prefer FastAPI origin for /app_data and /static
  if (/^https?:\/\//.test(src)) {
    try {
      const url = new URL(src);
      const servedPath = toServedPath(url.pathname);
      if (servedPath.startsWith("/app_data/") || servedPath.startsWith("/static/")) {
        return `${getFastAPIUrl()}${servedPath}`;
      }
      return src;
    } catch {
      return src;
    }
  }

  // If we have a file:// URL, map it to FastAPI static HTTP URL
  if (src.startsWith("file://")) {
    return toFastApiStaticUrl(src);
  }

  // Safe fallback for bare paths: treat as file URL, then map to FastAPI
  const trimmed = src.trim();
  const fileLike = trimmed.startsWith("/") ? `file://${trimmed}` : `file:///${trimmed}`;
  return toFastApiStaticUrl(fileLike);
}

/**
 * Normalizes image URLs so that non-protocol paths are treated as file URLs.
 * If the src is already http/https/file, it is left unchanged.
 */
export function convertImageUrlsForEnvironment() {
  if (typeof document === "undefined") return;

  const images = document.querySelectorAll("img[src]");

  images.forEach((img) => {
    const htmlImg = img as HTMLImageElement;
    if (!htmlImg.src) return;
    htmlImg.src = normalizeImageSrc(htmlImg.src);
  });
}

/**
 * Setup a MutationObserver to automatically convert any dynamically added images
 */
export function setupImageUrlConverter() {
  convertImageUrlsForEnvironment();
  
  // Watch for dynamically added images
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as Element;
          
          // Any new <img> or descendants with src should be normalized
          if (element.tagName === "IMG") {
            convertImageUrlsForEnvironment();
          }
          
          const imgs = element.querySelectorAll?.("img[src]");
          if (imgs && imgs.length > 0) {
            convertImageUrlsForEnvironment();
          }
        }
      });
    });
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
  
  return observer;
}
