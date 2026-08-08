export function withHash(
  color: string | null | undefined,
  fallback = "#000000",
) {
  const value = typeof color === "string" ? color.trim() : "";
  if (!value) return fallback;
  return value.startsWith("#") ? value : `#${value}`;
}

export function withoutHash(color: string | null | undefined) {
  return typeof color === "string" ? color.replace("#", "").toUpperCase() : "";
}
