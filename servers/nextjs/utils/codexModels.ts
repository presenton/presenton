export interface CodexModel {
  id: string;
  name: string;
  description?: string | null;
  context_window?: number | null;
  input_modalities?: string[] | null;
  supported_reasoning_levels: string[];
  default_reasoning_level?: string | null;
  parallel_tool_calls?: boolean | null;
  supports_reasoning_summary_parameter?: boolean | null;
}

export interface CodexModelCatalog {
  models: CodexModel[];
  client_version: string;
}

// These are transport values supported by the pinned llmai SDK, not a model list.
const SDK_REASONING_EFFORTS = new Set([
  "none", "minimal", "low", "medium", "high", "xhigh", "max",
]);

export function isCodexProvider(provider?: string): boolean {
  return provider === "codex" || provider === "chatgpt";
}

export function parseCodexModelCatalog(payload: unknown): CodexModelCatalog {
  const invalid = () => new Error("ChatGPT returned an invalid model catalog.");
  if (!payload || typeof payload !== "object") throw invalid();
  const catalog = payload as Partial<CodexModelCatalog>;
  if (!Array.isArray(catalog.models) || typeof catalog.client_version !== "string") {
    throw invalid();
  }
  const seen = new Set<string>();
  for (const model of catalog.models) {
    if (!model || typeof model !== "object" ||
      typeof model.id !== "string" || !model.id.trim() ||
      typeof model.name !== "string" || !model.name.trim() ||
      !Array.isArray(model.supported_reasoning_levels) ||
      !model.supported_reasoning_levels.every((effort) => typeof effort === "string") ||
      seen.has(model.id)) {
      throw invalid();
    }
    seen.add(model.id);
  }
  return catalog as CodexModelCatalog;
}

export function getCodexReasoningEfforts(model?: CodexModel): string[] {
  return [...new Set(model?.supported_reasoning_levels ?? [])]
    .filter((effort) => SDK_REASONING_EFFORTS.has(effort));
}
