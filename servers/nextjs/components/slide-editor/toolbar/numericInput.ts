import type { KeyboardEvent } from "react";

type NumericInputOptions = {
  allowDecimal?: boolean;
  allowNegative?: boolean;
  min?: number;
};

const NAVIGATION_KEYS = new Set([
  "Backspace",
  "Delete",
  "End",
  "Enter",
  "Escape",
  "Home",
  "Tab",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
]);

function canUseNegative(options: NumericInputOptions) {
  if (options.allowNegative != null) return options.allowNegative;
  return typeof options.min === "number" ? options.min < 0 : true;
}

export function sanitizeNumericInput(
  value: string,
  options: NumericInputOptions = {},
) {
  const allowDecimal = options.allowDecimal ?? true;
  const allowNegative = canUseNegative(options);
  let nextValue = "";
  let hasDecimal = false;

  for (const character of value.trim()) {
    if (character >= "0" && character <= "9") {
      nextValue += character;
      continue;
    }

    if (allowDecimal && character === "." && !hasDecimal) {
      nextValue += character;
      hasDecimal = true;
      continue;
    }

    if (
      allowNegative &&
      (character === "-" || character === "−") &&
      nextValue.length === 0
    ) {
      nextValue = "-";
    }
  }

  return nextValue;
}

export function numericInputMode(options: NumericInputOptions = {}) {
  return options.allowDecimal ?? true ? "decimal" : "numeric";
}

export function preventInvalidNumberInput(
  event: KeyboardEvent<HTMLInputElement>,
  options: NumericInputOptions = {},
) {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey) return false;
  if (NAVIGATION_KEYS.has(event.key)) return false;
  if (/^\d$/.test(event.key)) return false;

  const allowDecimal = options.allowDecimal ?? true;
  const allowNegative = canUseNegative(options);
  const input = event.currentTarget;
  const value = input.value;
  const selectionStart = input.selectionStart ?? value.length;
  const selectionEnd = input.selectionEnd ?? selectionStart;
  const selectedText = value.slice(selectionStart, selectionEnd);

  if (allowDecimal && event.key === ".") {
    const replacesExistingDecimal = selectedText.includes(".");
    if (!value.includes(".") || replacesExistingDecimal) return false;
  }

  if (allowNegative && (event.key === "-" || event.key === "−")) {
    const replacesExistingNegative = selectedText.includes("-");
    if (
      selectionStart === 0 &&
      (!value.includes("-") || replacesExistingNegative)
    ) {
      return false;
    }
  }

  event.preventDefault();
  return true;
}
