"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Check,
  ChevronsUpDown,
  Loader2,
  Download,
  X,
  HardDrive,
} from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { cn } from "@/lib/utils";
import { notify } from "@/components/ui/sonner";
import {
  getDefaultOllamaUrl,
  getReachableOllamaModels,
  getOllamaLibraryModels,
  pullOllamaModel,
  OllamaLibraryModel,
  OllamaPullProgressEvent,
} from "@/utils/providerUtils";

interface CombinedModel {
  name: string;
  parameters?: string;
  size?: string;
  description?: string;
  isPulled: boolean;
  tested?: boolean;
}

interface OllamaConfigProps {
  ollamaModel: string;
  ollamaUrl: string;
  onInputChange: (value: string | boolean, field: string) => void;
}

export default function OllamaConfig({
  ollamaModel,
  ollamaUrl,
  onInputChange,
}: OllamaConfigProps) {
  const [combinedModels, setCombinedModels] = useState<CombinedModel[]>([]);
  const [ollamaModelsLoading, setOllamaModelsLoading] = useState(false);
  const [modelsChecked, setModelsChecked] = useState(false);
  const [openModelSelect, setOpenModelSelect] = useState(false);

  const [pullDialogOpen, setPullDialogOpen] = useState(false);
  const [pullingModel, setPullingModel] = useState<string | null>(null);
  const [pullStatus, setPullStatus] = useState("");
  const [pullProgress, setPullProgress] = useState<number | null>(null);
  const [pullCompleted, setPullCompleted] = useState<number | null>(null);
  const [pullTotal, setPullTotal] = useState<number | null>(null);
  const [pullError, setPullError] = useState<string | null>(null);
  const [pullDone, setPullDone] = useState(false);
  const [pullCancelled, setPullCancelled] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const pullRequestIdRef = useRef(0);
  const isElectronRuntime =
    typeof window !== "undefined" && !!window.electron;

  useEffect(() => {
    if (!ollamaUrl.trim()) {
      onInputChange(getDefaultOllamaUrl(), "ollama_url");
    }
  }, [ollamaUrl, onInputChange]);

  const fetchOllamaModels = useCallback(async () => {
    setOllamaModelsLoading(true);
    try {
      const reachable = await getReachableOllamaModels(ollamaUrl);
      const [pulledModels, libraryModels] = await Promise.all([
        Promise.resolve(reachable.models),
        getOllamaLibraryModels(),
      ]);

      if (reachable.resolvedUrl !== ollamaUrl.trim()) {
        onInputChange(reachable.resolvedUrl, "ollama_url");
      }

      const pulledNames = new Set(pulledModels.map((m) => m.name));

      const libraryOnly: CombinedModel[] = libraryModels
        .filter((lm: OllamaLibraryModel) => !pulledNames.has(lm.name))
        .map((lm: OllamaLibraryModel) => ({
          name: lm.name,
          parameters: lm.parameters || undefined,
          size: lm.size,
          description: lm.description,
          isPulled: false,
          tested: true,
        }));

      const pulled: CombinedModel[] = pulledModels.map((model) => {
        const libraryMatch = libraryModels.find((lm: OllamaLibraryModel) => lm.name === model.name);

        return {
          name: model.name,
          parameters: model.parameters || libraryMatch?.parameters || undefined,
          size: libraryMatch?.size
            || (model.size ? `${(model.size / 1024 / 1024 / 1024).toFixed(1)} GB` : undefined),
          description: libraryMatch?.description,
          isPulled: true,
          tested: !!libraryMatch,
        };
      });

      const combined = [...pulled, ...libraryOnly];
      setCombinedModels(combined);
      setModelsChecked(true);

      const currentStillAvailable = pulledNames.has(ollamaModel);
      if (pulled.length > 0) {
        if (!currentStillAvailable) {
          onInputChange(pulled[0].name, "ollama_model");
        }
      } else {
        onInputChange("", "ollama_model");
      }

      notify.success(
        "Connected to Ollama",
        pulled.length > 0
          ? `Found ${pulled.length} downloaded model${pulled.length === 1 ? "" : "s"}. ${libraryOnly.length} more available in library.`
          : "Ollama is reachable. Browse the library to download models."
      );

      if (reachable.usedFallback) {
        notify.success(
          "Using in-container Ollama",
          "host.docker.internal did not respond, so Presenton switched Ollama URL to localhost."
        );
      }
      if (!reachable.usedFallback && reachable.resolvedUrl !== ollamaUrl.trim()) {
        notify.success(
          "Updated Ollama URL",
          `Using ${reachable.resolvedUrl} for Ollama checks.`
        );
      }
    } catch (error) {
      setCombinedModels([]);
      setModelsChecked(true);
      onInputChange("", "ollama_model");
      notify.error(
        "Could not connect to Ollama",
        error instanceof Error ? error.message : "Check the Ollama URL and try again."
      );
    } finally {
      setOllamaModelsLoading(false);
    }
  }, [ollamaUrl, ollamaModel, onInputChange]);

  const handlePullModel = useCallback(
    (modelName: string) => {
      const requestId = pullRequestIdRef.current + 1;
      pullRequestIdRef.current = requestId;
      setPullingModel(modelName);
      setPullStatus("Starting pull...");
      setPullProgress(null);
      setPullCompleted(null);
      setPullTotal(null);
      setPullError(null);
      setPullDone(false);
      setPullCancelled(false);
      setPullDialogOpen(true);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      pullOllamaModel(
        modelName,
        ollamaUrl,
        (event: OllamaPullProgressEvent) => {
          if (
            pullRequestIdRef.current !== requestId ||
            controller.signal.aborted
          ) {
            return;
          }

          switch (event.type) {
            case "status":
              setPullStatus(event.status || "Processing...");
              break;
            case "progress":
              setPullStatus(event.status || "Downloading...");
              setPullProgress(event.progress ?? null);
              setPullCompleted(event.completed ?? null);
              setPullTotal(event.total ?? null);
              break;
            case "complete":
              setPullStatus("Model downloaded successfully!");
              setPullProgress(100);
              setPullDone(true);
              setPullCancelled(false);
              abortControllerRef.current = null;
              setCombinedModels((prev) =>
                prev.map((m) =>
                  m.name === modelName ? { ...m, isPulled: true } : m
                )
              );
              onInputChange(modelName, "ollama_model");
              notify.success("Model downloaded", `${modelName} is ready to use.`);
              break;
            case "error":
              setPullError(event.detail || "Pull failed");
              setPullDone(true);
              setPullCancelled(false);
              abortControllerRef.current = null;
              notify.error("Pull failed", event.detail || "Unknown error");
              break;
          }
        },
        controller.signal
      ).catch(() => {
        if (
          controller.signal.aborted &&
          pullRequestIdRef.current === requestId
        ) {
          setPullStatus("Pull cancelled");
          setPullError(null);
          setPullDone(true);
          setPullCancelled(true);
          abortControllerRef.current = null;
        }
      });
    },
    [ollamaUrl, onInputChange]
  );

  const handleCancelPull = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setPullStatus("Cancelling...");
  }, []);

  const handleClosePullDialog = useCallback(() => {
    if (!pullDone) {
      handleCancelPull();
    }
    setPullDialogOpen(false);
  }, [pullDone, handleCancelPull]);

  const handleModelSelect = useCallback(
    (model: CombinedModel) => {
      if (model.isPulled) {
        onInputChange(model.name, "ollama_model");
        setOpenModelSelect(false);
      } else {
        setOpenModelSelect(false);
        handlePullModel(model.name);
      }
    },
    [onInputChange, handlePullModel]
  );

  const formatBytes = (bytes: number): string => {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
    }
    if (bytes >= 1024 * 1024) {
      return `${(bytes / 1024 / 1024).toFixed(0)} MB`;
    }
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  const pulledModels = combinedModels.filter((m) => m.isPulled);
  const libraryModels = combinedModels.filter((m) => !m.isPulled);
  const selectedModel = combinedModels.find((m) => m.name === ollamaModel);

  const compactSize = (value?: string) => (value || "Unknown").replace(/\s+/g, "");
  const normalizeParameters = (value?: string) =>
    (value || "").replace(/\s+/g, "").toUpperCase();
  const hasKnownParameters = (model: CombinedModel) => {
    const normalized = normalizeParameters(model.parameters);
    return normalized !== "" && normalized !== "UNKNOWN";
  };
  const modelParameterBadge = (model: CombinedModel) =>
    normalizeParameters(model.parameters);
  const modelSizeBadge = (model: CombinedModel) => compactSize(model.size);
  const modelSupportTitle = (model: CombinedModel) =>
    model.tested === false ? "Experimental" : "Recommended";
  const modelSupportBadgeClass = (model: CombinedModel) =>
    model.tested === false
      ? "border-[#FDE2B4] bg-[#FFF7E8] text-[#9A5B00]"
      : "border-[#CFEBD5] bg-[#ECFDF0] text-[#1C7A34]";

  const modelNameWithParameters = (model: CombinedModel) => {
    const rawName = model.name;
    const normalizedParams = normalizeParameters(model.parameters);

    if (!normalizedParams || normalizedParams === "UNKNOWN") {
      return rawName;
    }

    const suffixMatchesParams = new RegExp(
      `:${normalizedParams.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
      "i"
    ).test(rawName);

    if (suffixMatchesParams) {
      return `${rawName.replace(/:[^:]+$/, "")}:${normalizedParams}`;
    }

    if (rawName.includes(":")) {
      return `${rawName} (${normalizedParams})`;
    }

    return `${rawName}:${normalizedParams}`;
  };

  const modelInlineLabel = (model: CombinedModel) =>
    `${modelNameWithParameters(model)}  ${compactSize(model.size)}`;
  const renderModelBadges = (model: CombinedModel) => (
    <div className="mt-1 flex items-center gap-1.5">
      <span
        title={modelSupportTitle(model)}
        aria-label={modelSupportTitle(model)}
        className={cn(
          "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
          modelSupportBadgeClass(model)
        )}
      >
        <Check className="h-3 w-3" aria-hidden="true" />
      </span>
      {hasKnownParameters(model) && (
        <span className="rounded-full border border-[#E7E8EC] bg-[#F7F8FA] px-1.5 py-0.5 text-[10px] font-medium text-[#5F6062]">
          {modelParameterBadge(model)}
        </span>
      )}
      <span className="rounded-full border border-[#E7E8EC] bg-[#F7F8FA] px-1.5 py-0.5 text-[10px] font-medium text-[#5F6062]">
        {modelSizeBadge(model)}
      </span>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Ollama URL
        </label>
        <input
          type="text"
          required
          placeholder={
            isElectronRuntime
              ? "http://localhost:11434"
              : "http://host.docker.internal:11434"
          }
          className="w-full px-4 py-2.5 outline-none border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
          value={ollamaUrl}
          onChange={(event) => {
            onInputChange(event.target.value, "ollama_url");
            onInputChange("", "ollama_model");
            setCombinedModels([]);
            setModelsChecked(false);
          }}
        />
        <p className="mt-2 text-sm text-gray-500">
          {isElectronRuntime
            ? "Default: http://localhost:11434"
            : "Default: http://host.docker.internal:11434. If Ollama runs in the same container, Presenton will switch to localhost automatically."}
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-4"
          disabled={ollamaModelsLoading || !ollamaUrl.trim()}
          onClick={fetchOllamaModels}
        >
          {ollamaModelsLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Checking models...
            </>
          ) : (
            "Check models"
          )}
        </Button>
      </div>

      {modelsChecked && combinedModels.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Choose an Ollama model
          </label>
          <Popover open={openModelSelect} onOpenChange={setOpenModelSelect}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={openModelSelect}
                className="h-auto min-h-14 w-full justify-between rounded-xl border-[#E8E8E9] bg-white px-4 py-3 text-left hover:bg-[#FAFAFC]"
              >
                <div className="min-w-0">
                  <span
                    className="block truncate text-sm font-medium text-[#191919]"
                    title={selectedModel ? modelInlineLabel(selectedModel) : "Select a model"}
                  >
                    {selectedModel ? modelInlineLabel(selectedModel) : "Select a model"}
                  </span>
                  {selectedModel && renderModelBadges(selectedModel)}
                </div>
                <ChevronsUpDown className="w-4 h-4 text-gray-500" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="rounded-xl border border-[#EDEEEF] p-0 shadow-[0px_10px_30px_rgba(16,19,35,0.08)]"
              align="start"
              style={{ width: "var(--radix-popover-trigger-width)" }}
            >
              <Command>
                <CommandInput placeholder="Search model..." />
                <CommandList>
                  <CommandEmpty>No model found.</CommandEmpty>
                  {pulledModels.length > 0 && (
                    <CommandGroup heading="Downloaded">
                      {pulledModels.map((model) => (
                        <CommandItem
                          key={model.name}
                          value={model.name}
                          onSelect={() => handleModelSelect(model)}
                          className="cursor-pointer rounded-lg py-2.5 aria-selected:bg-[#F6F4FF]"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              ollamaModel === model.name
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          <div className="min-w-0 flex-1">
                            <span
                              className="block truncate text-sm font-medium text-[#191919]"
                              title={modelInlineLabel(model)}
                            >
                              {modelInlineLabel(model)}
                            </span>
                            {renderModelBadges(model)}
                          </div>
                          <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-[#CFEBD5] bg-[#ECFDF0] px-2 py-0.5 text-[10px] font-semibold text-[#1C7A34]">
                            <HardDrive className="w-3 h-3" />
                            Downloaded
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                  {libraryModels.length > 0 && (
                    <CommandGroup heading="Available in Library">
                      {libraryModels.map((model) => (
                        <CommandItem
                          key={model.name}
                          value={model.name}
                          onSelect={() => handleModelSelect(model)}
                          className="cursor-pointer rounded-lg py-2.5 aria-selected:bg-[#F5F8FF]"
                        >
                          <Download className="mr-2 h-4 w-4 text-blue-500" />
                          <div className="flex-1 min-w-0">
                            <span
                              className="block truncate text-sm font-medium text-[#191919]"
                              title={modelInlineLabel(model)}
                            >
                              {modelInlineLabel(model)}
                            </span>
                            {renderModelBadges(model)}
                            {model.description && (
                              <span className="mt-1 block truncate text-[11px] text-[#75777D]">
                                {model.description}
                              </span>
                            )}
                          </div>
                          <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-[#D8E5FF] bg-[#EEF4FF] px-2 py-0.5 text-[10px] font-semibold text-[#2456C3]">
                            <Download className="h-3 w-3" />
                            Download
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      )}

      {modelsChecked && combinedModels.length === 0 && (
        <p className="text-sm text-gray-500">
          Ollama is reachable, but no models are installed. Pull a model in
          Ollama, then check again.
        </p>
      )}

      <Dialog
        open={pullDialogOpen}
        onOpenChange={(open) => {
          if (!open) handleClosePullDialog();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="w-5 h-5" />
              {pullDone && pullCancelled
                ? "Download Cancelled"
                : pullDone && !pullError
                ? "Download Complete"
                : pullError
                  ? "Download Failed"
                  : `Downloading ${pullingModel}`}
            </DialogTitle>
            <DialogDescription>
              {pullDone && pullCancelled
                ? `${pullingModel} download was cancelled.`
                : pullDone && !pullError
                ? `${pullingModel} is ready to use.`
                : pullError
                  ? pullError
                  : pullStatus}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!pullDone && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                  <span className="truncate mr-2">{pullStatus}</span>
                  {pullProgress !== null && (
                    <span className="shrink-0 font-medium">
                      {pullProgress.toFixed(1)}%
                    </span>
                  )}
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-blue-500 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${pullProgress ?? 0}%` }}
                  />
                </div>
                {pullCompleted !== null && pullTotal !== null && (
                  <p className="text-xs text-gray-500">
                    {formatBytes(pullCompleted)} / {formatBytes(pullTotal)}
                  </p>
                )}
              </div>
            )}
            {pullDone && pullError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-700">{pullError}</p>
              </div>
            )}
            {pullDone && pullCancelled && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-700">
                  Download was cancelled before completion.
                </p>
              </div>
            )}
            {pullDone && !pullError && !pullCancelled && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm text-green-700">
                  {pullingModel} has been downloaded and selected as your active
                  model.
                </p>
              </div>
            )}
            <div className="flex justify-end">
              {!pullDone ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCancelPull}
                >
                  <X className="mr-1.5 h-3.5 w-3.5" />
                  Cancel
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPullDialogOpen(false)}
                >
                  Close
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
