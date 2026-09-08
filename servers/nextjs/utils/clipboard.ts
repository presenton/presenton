export async function copyTextToClipboard(text: string): Promise<void> {
  if (
    typeof navigator !== "undefined" &&
    typeof navigator.clipboard?.writeText === "function"
  ) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Clipboard API access can be denied outside a secure context. Fall back
      // to the synchronous browser copy command when it is available.
    }
  }

  if (
    typeof document === "undefined" ||
    typeof document.execCommand !== "function"
  ) {
    throw new Error("Clipboard access is not available in this browser.");
  }

  const textArea = document.createElement("textarea");
  const previouslyFocusedElement = document.activeElement as HTMLElement | null;
  textArea.value = text;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.inset = "0 auto auto -9999px";
  textArea.style.opacity = "0";
  textArea.style.pointerEvents = "none";
  document.body.appendChild(textArea);

  let copied = false;
  try {
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, text.length);
    copied = document.execCommand("copy");
  } finally {
    textArea.remove();
    previouslyFocusedElement?.focus?.();
  }

  if (!copied) {
    throw new Error("Clipboard access is not available in this browser.");
  }
}
