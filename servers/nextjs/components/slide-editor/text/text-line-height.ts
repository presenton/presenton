const TEXT_AVERAGE_CHAR_EM = 0.52;

export function shouldApplyLineHeight({
  text,
  width,
  fontSize,
  wrap,
}: {
  text: string;
  width: number;
  fontSize: number;
  wrap?: string | null;
}) {
  const lines = text.split(/\r?\n/);
  if (lines.length > 1) return true;
  if (wrap === "none") return false;
  if (!Number.isFinite(width) || width <= 0) return false;
  if (!Number.isFinite(fontSize) || fontSize <= 0) return false;

  const averageCharWidth = Math.max(1, fontSize * TEXT_AVERAGE_CHAR_EM);
  return lines.some((line) => line.length * averageCharWidth > width);
}

export function effectiveLineHeight({
  text,
  width,
  fontSize,
  lineHeight,
  fallback,
  wrap,
}: {
  text: string;
  width: number;
  fontSize: number;
  lineHeight: number | null | undefined;
  fallback: number;
  wrap?: string | null;
}) {
  return shouldApplyLineHeight({ text, width, fontSize, wrap })
    ? lineHeight ?? fallback
    : fallback;
}
