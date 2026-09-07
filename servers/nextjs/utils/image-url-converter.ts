import { resolveBackendAssetUrl } from "./api";

/**
 * Normalizes DOM image URLs through the shared backend asset resolver.
 * This keeps Docker/web deployments on same-origin proxy paths.
 */
export function convertImageUrlsForEnvironment() {
  if (typeof document === "undefined") return;

  const images = document.querySelectorAll("img[src]");

  images.forEach((img) => {
    const htmlImg = img as HTMLImageElement;
    if (!htmlImg.src) return;
    htmlImg.src = resolveBackendAssetUrl(htmlImg.src);
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
