export type GenerationMode = "standard" | "smart";
export type PresentationGenerationMode = GenerationMode | "both";

export const DEFAULT_PRESENTATION_GENERATION_MODE: PresentationGenerationMode =
  "both";

export function normalizePresentationGenerationMode(
  value?: string | null,
): PresentationGenerationMode {
  const normalized = value?.trim().toLowerCase();

  if (
    normalized === "standard" ||
    normalized === "smart" ||
    normalized === "both"
  ) {
    return normalized;
  }

  return DEFAULT_PRESENTATION_GENERATION_MODE;
}

export function isGenerationModeAvailable(
  configuredMode: PresentationGenerationMode,
  requestedMode: GenerationMode,
): boolean {
  return configuredMode === "both" || configuredMode === requestedMode;
}

export function getInitialGenerationMode(
  configuredMode: PresentationGenerationMode,
): GenerationMode {
  return configuredMode === "smart" ? "smart" : "standard";
}
