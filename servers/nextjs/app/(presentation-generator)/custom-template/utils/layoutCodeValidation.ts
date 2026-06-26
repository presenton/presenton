import { getApiUrl } from "@/utils/api";

export type ValidatedLayoutCodeResponse = {
  ok: true;
  layout_code: string;
  layoutId: string;
  layoutName: string;
  layoutDescription: string;
  schemaJSON: unknown;
};

type InvalidLayoutCodeResponse = {
  ok: false;
  error: string;
  line?: number;
  column?: number;
};

function formatValidationError(payload: InvalidLayoutCodeResponse): string {
  const location =
    payload.line === undefined
      ? ""
      : ` at ${payload.line}:${payload.column ?? 1}`;
  return `${payload.error}${location}`;
}

export async function validateLayoutCodeForClient(
  layoutCode: string
): Promise<ValidatedLayoutCodeResponse> {
  const response = await fetch(getApiUrl("/api/validate-layout-code"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ layout_code: layoutCode }),
  });

  const payload = (await response
    .json()
    .catch(() => null)) as
    | ValidatedLayoutCodeResponse
    | InvalidLayoutCodeResponse
    | null;

  if (response.ok && payload?.ok) {
    return payload;
  }

  if (payload && !payload.ok) {
    throw new Error(formatValidationError(payload));
  }

  throw new Error("Layout code validation failed");
}
