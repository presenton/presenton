export interface CodexModel {
  id: string;
  name: string;
}

export const CODEX_MODELS: CodexModel[] = [
  { id: "gpt-5.5", name: "GPT-5.5" },
  { id: "gpt-5.4", name: "GPT-5.4" },
  { id: "gpt-5.4-mini", name: "GPT-5.4 mini" },
  { id: "gpt-5.3-codex-spark", name: "GPT-5.3 Codex Spark (Pro preview)" },
];

export const DEFAULT_CODEX_MODEL = "gpt-5.5";

const CODEX_MODEL_IDS = new Set(CODEX_MODELS.map((model) => model.id));

export function isSupportedCodexModel(model?: string): boolean {
  return Boolean(model && CODEX_MODEL_IDS.has(model));
}
