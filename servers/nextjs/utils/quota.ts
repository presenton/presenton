import { getApiUrl } from "@/utils/api";

/**
 * Форма ответа `GET /api/v1/quota` (P4). remaining === null — безлимит
 * (однопользовательский режим или limit <= 0).
 */
export type QuotaStatus = {
  limit: number;
  used: number;
  remaining: number | null;
  period_hours: number;
  resets_in_seconds: number | null;
};

export function normalizeQuotaStatus(data: unknown): QuotaStatus | null {
  if (typeof data !== "object" || data === null) {
    return null;
  }
  const candidate = data as Record<string, unknown>;
  const { limit, used, remaining, period_hours, resets_in_seconds } = candidate;
  if (typeof limit !== "number" || !Number.isFinite(limit)) return null;
  if (typeof used !== "number" || !Number.isFinite(used)) return null;
  if (remaining !== null && typeof remaining !== "number") return null;
  if (typeof period_hours !== "number" || !Number.isFinite(period_hours)) {
    return null;
  }
  if (resets_in_seconds !== null && typeof resets_in_seconds !== "number") {
    return null;
  }
  return { limit, used, remaining, period_hours, resets_in_seconds };
}

/** Не бросает: секция квоты не должна ломать настройки при сбое API. */
export async function fetchQuotaStatus(): Promise<QuotaStatus | null> {
  try {
    const response = await fetch(getApiUrl("/api/v1/quota"), {
      cache: "no-store",
      credentials: "include",
    });
    if (!response.ok) {
      return null;
    }
    return normalizeQuotaStatus(await response.json());
  } catch {
    return null;
  }
}

export function formatResetCountdown(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "0s";
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return `${Math.ceil(seconds)}s`;
}

export function formatQuotaSummary(status: QuotaStatus): string {
  if (status.remaining === null) {
    return "Unlimited generations";
  }
  const base = `${status.remaining} of ${status.limit} left`;
  if (status.remaining <= 0 && status.resets_in_seconds !== null) {
    return `${base} — next slot in ${formatResetCountdown(status.resets_in_seconds)}`;
  }
  return base;
}
