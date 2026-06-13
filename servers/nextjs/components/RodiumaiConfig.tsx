"use client";

import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { cn } from "@/lib/utils";
import { notify } from "@/components/ui/sonner";
import { getApiUrl } from "@/utils/api";
import { LLM_PROVIDERS } from "@/utils/providerConstants";

const RODIUMAI_API_URL =
  LLM_PROVIDERS.rodiumai.url ?? "https://api.rodiumai.io/v1";

interface RodiumaiConfigProps {
  rodiumaiApiKey: string;
  rodiumaiModel: string;
  onInputChange: (value: string | boolean, field: string) => void;
}

export default function RodiumaiConfig({
  rodiumaiApiKey,
  rodiumaiModel,
  onInputChange,
}: RodiumaiConfigProps) {
  const [models, setModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsChecked, setModelsChecked] = useState(false);
  const [openModelSelect, setOpenModelSelect] = useState(false);
  const [apiKey, setApiKey] = useState(rodiumaiApiKey);

  useEffect(() => {
    setModels([]);
    setModelsChecked(false);
    onInputChange("", "rodiumai_model");
  }, [apiKey]);

  const onApiKeyChange = (value: string) => {
    setApiKey(value);
    onInputChange(value, "rodiumai_api_key");
  };

  const fetchModels = async () => {
    if (!apiKey.trim()) return;

    try {
      setModelsLoading(true);
      const response = await fetch(
        getApiUrl("/api/v1/ppt/openai/models/available"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: RODIUMAI_API_URL,
            api_key: apiKey,
          }),
        },
      );

      if (response.ok) {
        const data = await response.json();
        setModels(Array.isArray(data) ? data : []);
        setModelsChecked(true);
      } else {
        setModels([]);
        setModelsChecked(true);
        notify.error(
          "Could not load models",
          "Check your RodiumAi API key, then try again.",
        );
      }
    } catch {
      setModels([]);
      setModelsChecked(true);
      notify.error(
        "Could not load models",
        "Check your RodiumAi API key, then try again.",
      );
    } finally {
      setModelsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600">
        Use your RodiumAi API key from the{" "}
        <a
          href={LLM_PROVIDERS.rodiumai.getApiKeyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline inline-flex items-center gap-1"
        >
          dashboard
          <ExternalLink className="w-3 h-3" />
        </a>
        . Keys start with <code className="text-xs">rd_sk_</code>.
      </p>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          RodiumAi API Key
        </label>
        <input
          type="password"
          required
          placeholder="rd_sk_..."
          className="w-full px-4 py-2.5 outline-none border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
          value={rodiumaiApiKey}
          onChange={(e) => onApiKeyChange(e.target.value)}
        />
      </div>

      {(!modelsChecked || (modelsChecked && models.length === 0)) && (
        <button
          type="button"
          onClick={fetchModels}
          disabled={modelsLoading || !apiKey.trim()}
          className={`w-full py-2.5 px-4 rounded-lg transition-all duration-200 border-2 ${
            modelsLoading || !apiKey.trim()
              ? "bg-gray-100 border-gray-300 cursor-not-allowed text-gray-500"
              : "bg-white border-blue-600 text-blue-600 hover:bg-blue-50 focus:ring-2 focus:ring-blue-500/20"
          }`}
        >
          {modelsLoading ? (
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Checking for models...
            </div>
          ) : (
            "Check for available models"
          )}
        </button>
      )}

      {modelsChecked && models.length === 0 && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            No models found. Verify your API key.
          </p>
        </div>
      )}

      {modelsChecked && models.length > 0 && (
        <div>
          <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800">
              <strong>Important:</strong> Only models with structured JSON
              schema output support will work reliably.
            </p>
          </div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Model
          </label>
          <Popover open={openModelSelect} onOpenChange={setOpenModelSelect}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={openModelSelect}
                className="w-full h-12 px-4 py-4 outline-none border border-gray-300 rounded-lg justify-between"
              >
                <span className="text-sm font-medium text-gray-900">
                  {rodiumaiModel || "Select a model"}
                </span>
                <ChevronsUpDown className="w-4 h-4 text-gray-500" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="p-0"
              align="start"
              style={{ width: "var(--radix-popover-trigger-width)" }}
            >
              <Command>
                <CommandInput placeholder="Search model..." />
                <CommandList>
                  <CommandEmpty>No model found.</CommandEmpty>
                  <CommandGroup>
                    {models.map((model) => (
                      <CommandItem
                        key={model}
                        value={model}
                        onSelect={(value) => {
                          onInputChange(value, "rodiumai_model");
                          setOpenModelSelect(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            rodiumaiModel === model
                              ? "opacity-100"
                              : "opacity-0",
                          )}
                        />
                        <span className="text-sm font-medium text-gray-900">
                          {model}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  );
}
