export const TAILWIND_BROWSER_VERSION = "4.3.3";
export const TAILWIND_BROWSER_SCRIPT_URL =
  `/vendor/tailwindcss-browser-${TAILWIND_BROWSER_VERSION}.js`;

const TAILWIND_BROWSER_SCRIPT_ATTRIBUTE = "data-presenton-tailwind-browser";

export function ensureTailwindBrowserScript() {
  if (typeof document === "undefined") return null;

  const existingScript = document.querySelector<HTMLScriptElement>(
    `script[${TAILWIND_BROWSER_SCRIPT_ATTRIBUTE}="true"], script[src$="${TAILWIND_BROWSER_SCRIPT_URL}"]`,
  );
  if (existingScript) return existingScript;

  const script = document.createElement("script");
  script.src = TAILWIND_BROWSER_SCRIPT_URL;
  script.async = true;
  script.setAttribute(TAILWIND_BROWSER_SCRIPT_ATTRIBUTE, "true");
  document.head.appendChild(script);
  return script;
}
