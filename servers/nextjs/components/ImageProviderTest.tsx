"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LLMConfig } from "@/types/llm_config";
import { ImagesApi } from "@/app/(presentation-generator)/services/api/images";
import { IMAGE_PROVIDERS } from "@/utils/providerConstants";

export const IMAGE_TEST_FIELDS = [
  "IMAGE_PROVIDER", "OPENAI_API_KEY", "GOOGLE_API_KEY", "PEXELS_API_KEY",
  "PIXABAY_API_KEY", "COMFYUI_URL", "COMFYUI_WORKFLOW", "OPEN_WEBUI_IMAGE_URL",
  "OPEN_WEBUI_IMAGE_API_KEY", "OPENAI_COMPAT_IMAGE_BASE_URL",
  "OPENAI_COMPAT_IMAGE_API_KEY", "OPENAI_COMPAT_IMAGE_MODEL",
  "GPT_IMAGE_2_QUALITY", "GPT_IMAGE_2_5_QUALITY",
] as const;

export default function ImageProviderTest({ config }: { config: LLMConfig }) {
  const [result, setResult] = useState<{ imageUrl?: string; error?: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const testConfig = JSON.stringify(Object.fromEntries(
    IMAGE_TEST_FIELDS.filter((field) => config[field] !== undefined)
      .map((field) => [field, config[field]]),
  ));

  useEffect(() => {
    setResult(null);
    setIsTesting(false);
    return () => controller.current?.abort();
  }, [testConfig, config.DISABLE_IMAGE_GENERATION]);

  if (config.DISABLE_IMAGE_GENERATION || !IMAGE_PROVIDERS[config.IMAGE_PROVIDER || ""]) {
    return null;
  }

  const isStock = config.IMAGE_PROVIDER === "pexels" || config.IMAGE_PROVIDER === "pixabay";

  const testProvider = async () => {
    const request = new AbortController();
    controller.current?.abort();
    controller.current = request;
    setIsTesting(true);
    setResult(null);
    try {
      const { image_url } = await ImagesApi.testProvider(JSON.parse(testConfig), request.signal);
      if (!request.signal.aborted) setResult({ imageUrl: image_url });
    } catch (error) {
      if (!request.signal.aborted) {
        setResult({ error: error instanceof Error ? error.message : "The image test failed. Check your provider settings and try again." });
      }
    } finally {
      if (!request.signal.aborted) setIsTesting(false);
    }
  };

  return (
    <div className="mt-6 space-y-3 border-t border-gray-200 pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-sm text-gray-600">
          {isStock
            ? "Search for a test image to verify your configuration."
            : "Generate a test image to verify your configuration."}
        </p>
        <Button type="button" variant="outline" disabled={isTesting} onClick={testProvider}>
          {isTesting && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
          {isTesting ? "Testing…" : isStock ? "Test image search" : "Test image generation"}
        </Button>
      </div>
      <div role="status" aria-live="polite" aria-atomic="true">
        {isTesting && <p className="text-sm text-gray-600">{isStock ? "Searching for a sample image…" : "Generating a sample image. This may take a few minutes…"}</p>}
        {result?.error && (
          <p className="flex items-start gap-2 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {result.error}
          </p>
        )}
        {result?.imageUrl && (
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              {isStock ? "Image search is working." : "Image generation is working."}
            </p>
            {/* Provider previews can be temporary data URLs or remote stock images. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={result.imageUrl} alt="Sample mountain lake from your image provider" className="max-h-64 max-w-full rounded-lg object-contain" onError={() => setResult({ error: "The provider returned an image, but its preview could not load. Check your provider and try again." })} />
          </div>
        )}
      </div>
    </div>
  );
}
