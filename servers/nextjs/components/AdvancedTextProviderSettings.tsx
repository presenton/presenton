"use client";

import { useEffect, useId, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  RotateCcw,
  Trash2,
} from "lucide-react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { notify } from "@/components/ui/sonner";
import { LLMConfig } from "@/types/llm_config";
import { getApiErrorMessage, getApiUrl } from "@/utils/api";

type ConfigValue = string | boolean | number | string[];

interface ProviderOption {
  value: string;
  label: string;
  available: boolean;
  context_length?: number | null;
  max_completion_tokens?: number | null;
}

interface Props {
  config: LLMConfig;
  onChange: (value: ConfigValue, field: string) => void;
}

interface SelectOption {
  value: string;
  label: string;
}

const REASONING_EFFORT_OPTIONS: SelectOption[] = [
  { value: "model_default", label: "Model default" },
  { value: "minimal", label: "Minimal" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "xhigh", label: "Extra high" },
  { value: "max", label: "Maximum" },
];

const REASONING_MODE_OPTIONS: SelectOption[] = [
  { value: "model_default", label: "Model default" },
  { value: "enabled", label: "On" },
  { value: "disabled", label: "Off" },
];

const FALLBACK_DEFAULT_MAX_OUTPUT_TOKENS = 8_192;
const FALLBACK_MODEL_MAX_OUTPUT_TOKENS = 32_768;

const MODEL_FIELDS: Partial<Record<string, keyof LLMConfig>> = {
  anthropic: "ANTHROPIC_MODEL",
  azure: "AZURE_OPENAI_MODEL",
  bedrock: "BEDROCK_MODEL",
  cerebras: "CEREBRAS_MODEL",
  codex: "CODEX_MODEL",
  custom: "CUSTOM_MODEL",
  deepseek: "DEEPSEEK_MODEL",
  fireworks: "FIREWORKS_MODEL",
  google: "GOOGLE_MODEL",
  litellm: "LITELLM_MODEL",
  lmstudio: "LMSTUDIO_MODEL",
  ollama: "OLLAMA_MODEL",
  openai: "OPENAI_MODEL",
  openrouter: "OPENROUTER_MODEL",
  together: "TOGETHER_MODEL",
  vertex: "VERTEX_MODEL",
};

const inputClass =
  "flex h-12 w-full items-center justify-between gap-3 rounded-lg border border-[#D9DCE3] bg-white px-4 text-left text-sm text-[#191919] outline-none transition-colors hover:border-[#C8CBD3] focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15";

const numberInputClass =
  "h-12 w-full rounded-lg border border-[#D9DCE3] bg-white px-4 text-sm text-[#191919] outline-none transition-colors placeholder:text-[#A4A7AE] focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 disabled:cursor-not-allowed disabled:bg-[#F7F7F8] disabled:text-[#A4A7AE]";

function SettingSelect({
  label,
  description,
  value,
  options,
  disabled = false,
  onValueChange,
}: {
  label: string;
  description: string;
  value: string;
  options: SelectOption[];
  disabled?: boolean;
  onValueChange: (value: string) => void;
}) {
  return (
    <div className="min-w-0">
      <label className="mb-2 block text-sm font-medium text-[#303036]">
        {label}
      </label>
      <Select
        value={value}
        disabled={disabled}
        onValueChange={onValueChange}
      >
        <SelectTrigger className="h-12 w-full rounded-lg border-[#D9DCE3] bg-white px-4 text-sm text-[#191919] focus:ring-[#2563EB]/20 disabled:bg-[#F7F7F8]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="z-[80] rounded-lg border-[#EDEEEF] bg-white">
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="mt-1.5 text-xs leading-5 text-[#6B6C70]">
        {description}
      </p>
    </div>
  );
}

const deduplicateProviders = (providers: ProviderOption[]) => {
  const seenValues = new Set<string>();
  const seenLabels = new Set<string>();

  return providers.filter((provider) => {
    const value = provider.value?.trim();
    const label = (provider.label || value).trim();
    const normalizedValue = value.toLowerCase();
    const normalizedLabel = label.toLowerCase();

    if (
      !value ||
      seenValues.has(normalizedValue) ||
      seenLabels.has(normalizedLabel)
    ) {
      return false;
    }

    seenValues.add(normalizedValue);
    seenLabels.add(normalizedLabel);
    return true;
  });
};

export default function AdvancedTextProviderSettings({ config, onChange }: Props) {
  const providerListId = useId();
  const modelMaximumId = useId();
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [providerToAdd, setProviderToAdd] = useState("");
  const [providerPickerOpen, setProviderPickerOpen] = useState(false);
  const [tokenDefaults, setTokenDefaults] = useState({
    defaultMaxOutputTokens: FALLBACK_DEFAULT_MAX_OUTPUT_TOKENS,
    modelMaxOutputTokens: FALLBACK_MODEL_MAX_OUTPUT_TOKENS,
  });
  const hasManualMaxOutputTokens =
    typeof config.LLM_MAX_OUTPUT_TOKENS === "number" &&
    config.LLM_MAX_OUTPUT_TOKENS > 0;
  const useModelMaximum =
    config.LLM_GENERATION_PROFILE === "model_max" &&
    !hasManualMaxOutputTokens;
  const reasoningMode =
    config.LLM_REASONING_MODE === "enabled" ||
    config.LLM_REASONING_MODE === "disabled"
      ? config.LLM_REASONING_MODE
      : "model_default";
  const reasoningAvailable = reasoningMode !== "disabled";
  const modelField = config.LLM ? MODEL_FIELDS[config.LLM] : undefined;
  const selectedModel = modelField ? String(config[modelField] || "") : "";
  const displayedMaxOutputTokens = useModelMaximum
    ? tokenDefaults.modelMaxOutputTokens
    : config.LLM_MAX_OUTPUT_TOKENS ?? tokenDefaults.defaultMaxOutputTokens;
  const order = useMemo(
    () => config.OPENROUTER_PROVIDER_ORDER || [],
    [config.OPENROUTER_PROVIDER_ORDER]
  );

  const providerMap = useMemo(
    () => new Map(providers.map((provider) => [provider.value, provider])),
    [providers]
  );
  const availableProviders = useMemo(
    () => providers.filter((provider) => !order.includes(provider.value)),
    [order, providers]
  );

  useEffect(() => {
    if (!config.LLM || config.LLM === "presenton") return;

    const controller = new AbortController();
    fetch(getApiUrl("/api/v1/ppt/generation/defaults"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: config.LLM, model: selectedModel }),
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (
          typeof payload?.default_max_output_tokens === "number" &&
          typeof payload?.model_max_output_tokens === "number"
        ) {
          setTokenDefaults({
            defaultMaxOutputTokens: payload.default_max_output_tokens,
            modelMaxOutputTokens: payload.model_max_output_tokens,
          });
        }
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
      });

    return () => controller.abort();
  }, [config.LLM, selectedModel]);

  const setReasoningMode = (value: string) => {
    onChange(value === "model_default" ? "" : value, "LLM_REASONING_MODE");
    if (value === "disabled") {
      onChange("", "LLM_REASONING_EFFORT");
      onChange("", "LLM_REASONING_BUDGET_TOKENS");
    } else if (config.LLM_REASONING_EFFORT === "none") {
      onChange("", "LLM_REASONING_EFFORT");
    }
  };

  const setReasoningEffort = (value: string) => {
    const nextValue = value === "model_default" ? "" : value;
    onChange(nextValue, "LLM_REASONING_EFFORT");
  };

  const loadProviders = async () => {
    if (!config.OPENROUTER_MODEL?.trim() || !config.OPENROUTER_API_KEY?.trim()) {
      notify.warning(
        "Model and API key required",
        "Enter an OpenRouter model and API key first."
      );
      return;
    }
    setProvidersLoading(true);
    try {
      const response = await fetch(
        getApiUrl("/api/v1/ppt/openrouter/providers/available"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: config.OPENROUTER_MODEL,
            api_key: config.OPENROUTER_API_KEY,
            base_url: config.OPENROUTER_BASE_URL || undefined,
          }),
        }
      );
      if (!response.ok) {
        throw new Error(
          await getApiErrorMessage(
            response,
            "Could not load OpenRouter providers."
          )
        );
      }
      const payload = await response.json();
      const nextProviders = deduplicateProviders(
        Array.isArray(payload) ? payload : []
      );
      setProviders(nextProviders);
      setProviderPickerOpen(
        nextProviders.some((provider) => !order.includes(provider.value))
      );
    } catch (error) {
      notify.error(
        "Could not load providers",
        error instanceof Error
          ? error.message
          : "OpenRouter provider discovery failed."
      );
    } finally {
      setProvidersLoading(false);
    }
  };

  const move = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= order.length) return;
    const next = [...order];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    onChange(next, "OPENROUTER_PROVIDER_ORDER");
  };

  const resetToDefaults = () => {
    onChange("", "LLM_GENERATION_PROFILE");
    onChange(
      tokenDefaults.defaultMaxOutputTokens,
      "LLM_MAX_OUTPUT_TOKENS"
    );
    onChange("", "LLM_REASONING_MODE");
    onChange("", "LLM_REASONING_EFFORT");
    onChange("", "LLM_REASONING_BUDGET_TOKENS");
    onChange("", "DISABLE_THINKING");
    onChange("", "EXTENDED_REASONING");
    onChange([], "OPENROUTER_PROVIDER_ORDER");
    onChange("", "OPENROUTER_ALLOW_FALLBACKS");
    onChange("", "OPENROUTER_REQUIRE_PARAMETERS");
    onChange("", "OPENROUTER_DATA_COLLECTION");
    onChange("", "OPENROUTER_ZDR");
    setProviderToAdd("");
    setProviderPickerOpen(false);
  };

  if (!config.LLM || config.LLM === "presenton") {
    return null;
  }

  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-[12px] border border-[#EDEEEF] bg-white px-6 py-5 select-none [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block text-sm font-semibold text-[#191919]">
            Advanced text-provider settings
            <span className="ml-1 font-normal text-[#777A82]">(optional)</span>
          </span>
          <span className="mt-1 block text-xs font-normal text-[#6B6C70]">
            Configure output limits and reasoning behavior when needed.
          </span>
        </span>
        <ChevronDown
          className="h-4 w-4 shrink-0 text-[#667085] transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>

      <div className="mt-4 space-y-4">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={resetToDefaults}
            className="inline-flex items-center gap-2 rounded-[48px] border border-[#EDEEEF] bg-white px-4 py-2.5 text-xs font-semibold text-[#1D4ED8] transition hover:bg-[#EFF6FF]"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Reset to defaults
          </button>
        </div>
        <section className="space-y-6 rounded-[12px] border border-[#EDEEEF] bg-white p-6">
          <div>
            <h4 className="text-sm font-semibold text-[#191919]">
              Generation controls
            </h4>
            <p className="mt-1 text-xs leading-5 text-[#6B6C70]">
              Set an output limit and control reasoning for supported models.
            </p>
          </div>

          <div className="space-y-5">
            <div className="min-w-0">
              <label className="mb-2 block text-sm font-medium text-[#303036]">
                Max output tokens
              </label>
              <input
                type="number"
                min={1}
                step={1}
                disabled={useModelMaximum}
                value={displayedMaxOutputTokens}
                onChange={(event) => {
                  onChange("", "LLM_GENERATION_PROFILE");
                  onChange(
                    event.target.value === ""
                      ? ""
                      : Number(event.target.value),
                    "LLM_MAX_OUTPUT_TOKENS"
                  );
                }}
                placeholder={
                  useModelMaximum ? "Model maximum" : "Enter a token limit"
                }
                className={numberInputClass}
              />
              <label
                htmlFor={modelMaximumId}
                className="mt-3 flex w-fit cursor-pointer items-center gap-2 text-sm font-medium text-[#303036]"
              >
                <input
                  id={modelMaximumId}
                  type="checkbox"
                  checked={useModelMaximum}
                  onChange={(event) => {
                    if (event.target.checked) {
                      onChange("model_max", "LLM_GENERATION_PROFILE");
                      onChange("", "LLM_MAX_OUTPUT_TOKENS");
                    } else {
                      onChange("", "LLM_GENERATION_PROFILE");
                      onChange("", "LLM_MAX_OUTPUT_TOKENS");
                    }
                  }}
                  className="h-4 w-4 rounded border-[#C8CBD3] accent-[#2563EB]"
                />
                Use the selected model&apos;s maximum output limit
              </label>
              <p className="mt-1.5 text-xs leading-5 text-[#6B6C70]">
                Leave blank to use the default, enter a manual limit, or select
                model maximum to use the selected model&apos;s advertised limit.
                The selected limit applies to every generation attempt,
                including retries.
                {!hasManualMaxOutputTokens && !useModelMaximum && (
                  <> The effective default is shown in the field.</>
                )}
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <SettingSelect
                label="Reasoning mode"
                description="Use the backend model default, force reasoning on, or turn it off for faster responses."
                value={reasoningMode}
                options={REASONING_MODE_OPTIONS}
                onValueChange={setReasoningMode}
              />

              {reasoningAvailable && (
                <SettingSelect
                  label="Reasoning effort"
                  description="Higher effort may improve difficult generations, but can increase latency and token usage."
                  value={
                    config.LLM_REASONING_EFFORT === "default" ||
                    config.LLM_REASONING_EFFORT === "none"
                      ? "model_default"
                      : config.LLM_REASONING_EFFORT || "model_default"
                  }
                  options={REASONING_EFFORT_OPTIONS}
                  onValueChange={setReasoningEffort}
                />
              )}
            </div>
          </div>
        </section>

        {config.LLM === "openrouter" && (
          <section className="space-y-6 rounded-[12px] border border-[#EDEEEF] bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-[#191919]">
                  OpenRouter routing
                </h4>
                <p className="mt-1 text-xs leading-5 text-[#6B6C70]">
                  Leave the order empty to let OpenRouter route automatically.
                </p>
              </div>
              <button
                type="button"
                onClick={loadProviders}
                disabled={providersLoading}
                className="inline-flex min-w-[112px] items-center justify-center rounded-[48px] border border-[#EDEEEF] bg-[#EFF6FF] px-4 py-2.5 text-xs font-semibold text-[#1D4ED8] transition hover:bg-[#ECEAFF] disabled:opacity-50"
              >
                {providersLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Load providers"
                )}
              </button>
            </div>

            <div className="flex gap-2">
              <Popover
                open={providerPickerOpen}
                onOpenChange={setProviderPickerOpen}
              >
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    role="combobox"
                    aria-controls={providerListId}
                    aria-expanded={providerPickerOpen}
                    className={inputClass}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {providerToAdd
                        ? providerMap.get(providerToAdd)?.label || providerToAdd
                        : "Default"}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-[#667085] transition-transform ${
                        providerPickerOpen ? "rotate-180" : ""
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  sideOffset={6}
                  style={{ width: "var(--radix-popover-trigger-width)" }}
                  className="z-[70] overflow-hidden rounded-lg border border-[#EDEEEF] bg-white p-0 shadow-[0_10px_30px_rgba(16,24,40,0.12)]"
                >
                  <Command>
                    <CommandInput placeholder="Search providers..." />
                    <CommandList id={providerListId} className="max-h-60 p-1">
                      <CommandEmpty>No providers found.</CommandEmpty>
                      <CommandGroup>
                        {availableProviders.map((provider) => (
                          <CommandItem
                            key={provider.value}
                            value={`${provider.label} ${provider.value}`}
                            onSelect={() => {
                              setProviderToAdd(provider.value);
                              setProviderPickerOpen(false);
                            }}
                            className="relative cursor-pointer rounded-md px-3 py-2.5 pr-9 text-sm text-[#191919]"
                          >
                            <span className="min-w-0 flex-1 truncate">
                              {provider.label}
                            </span>
                            {!provider.available && (
                              <span className="shrink-0 text-xs text-[#8A8B91]">
                                Unavailable
                              </span>
                            )}
                            {providerToAdd === provider.value && (
                              <Check
                                className="absolute right-3 h-4 w-4 text-[#2563EB]"
                                aria-hidden="true"
                              />
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <button
                type="button"
                className="rounded-lg bg-[#2563EB] px-5 text-sm font-medium text-white transition hover:bg-[#6941C6] disabled:cursor-not-allowed disabled:bg-[#D0D2D8]"
                disabled={!providerToAdd}
                onClick={() => {
                  if (providerToAdd) {
                    onChange(
                      [...order, providerToAdd],
                      "OPENROUTER_PROVIDER_ORDER"
                    );
                  }
                  setProviderToAdd("");
                }}
              >
                Add
              </button>
            </div>

            {order.length > 0 && (
              <div className="space-y-2">
                {order.map((value, index) => {
                  const provider = providerMap.get(value);
                  return (
                    <div
                      key={value}
                      className="flex items-center gap-2 rounded-lg border border-[#EDEEEF] bg-[#FAFAFB] px-3 py-2.5 text-sm"
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {provider?.label || value}
                        {provider ? "" : " (unverified)"}
                      </span>
                      <button
                        type="button"
                        aria-label="Move provider up"
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                        className="rounded p-1 text-[#667085] hover:bg-white disabled:opacity-30"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="Move provider down"
                        disabled={index === order.length - 1}
                        onClick={() => move(index, 1)}
                        className="rounded p-1 text-[#667085] hover:bg-white disabled:opacity-30"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="Remove provider"
                        onClick={() =>
                          onChange(
                            order.filter((item) => item !== value),
                            "OPENROUTER_PROVIDER_ORDER"
                          )
                        }
                        className="rounded p-1 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

          </section>
        )}
      </div>
    </details>
  );
}
