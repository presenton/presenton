/** Matches FastAPI `HTTPException(detail=...)` and JSON error bodies. */
export const UNAUTHORIZED_DETAIL = "Unauthorized";

export function formatFastApiDetail(detail: unknown): string {
  if (typeof detail === "string") {
    return detail;
  }
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (item && typeof item === "object" && "msg" in item) {
          return String((item as { msg?: string }).msg ?? item);
        }
        return String(item);
      })
      .join(" ");
  }
  if (detail && typeof detail === "object" && "message" in detail) {
    return String((detail as { message?: string }).message);
  }
  return UNAUTHORIZED_DETAIL;
}
