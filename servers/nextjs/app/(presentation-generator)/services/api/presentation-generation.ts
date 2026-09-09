import { getHeader, getHeaderForFormData } from "./header";
import { IconSearch, ImageGenerate, PreviousGeneratedImagesResponse } from "./params";
import { ApiResponseHandler } from "./api-error-handler";
import { getApiUrl, resolveBackendAssetUrl } from "@/utils/api";
import {
  limitOutlines,
  MAX_NUMBER_OF_SLIDES,
} from "@/utils/presentationLimits";
import type { PresentationVersion } from "./dashboard";
import type { Slide } from "../../types/slide";

export type BlankPresentationResponse = {
  id: string;
  version: PresentationVersion;
  type: "standard";
  title: string | null;
  n_slides: number;
  language: string;
  fonts?: Record<string, string> | null;
  slides: Array<Record<string, unknown>>;
};

export class PresentationGenerationApi {
  static async uploadDoc(documents: File[]) {
    const formData = new FormData();

    documents.forEach((document) => {
      formData.append("files", document);
    });

    try {
      const response = await fetch(
        getApiUrl(`/api/v1/ppt/files/upload`),
        {
          method: "POST",
          headers: getHeaderForFormData(),
          body: formData,
          cache: "no-cache",
        }
      );

      return await ApiResponseHandler.handleResponse(response, "Failed to upload documents");
    } catch (error) {
      console.error("Upload error:", error);
      throw error;
    }
  }

  static async decomposeDocuments(
    documentKeys: string[],
    language?: string | null
  ) {
    try {
      const response = await fetch(
        getApiUrl(`/api/v1/ppt/files/decompose`),
        {
          method: "POST",
          headers: getHeader(),
          body: JSON.stringify({
            file_paths: documentKeys,
            language: language ?? null,
          }),
          cache: "no-cache",
        }
      );

      return await ApiResponseHandler.handleResponse(response, "Failed to decompose documents");
    } catch (error) {
      console.error("Error in Decompose Files", error);
      throw error;
    }
  }

  static async createPresentation({
    content,
    version = "v2-standard",
    n_slides,
    file_paths,
    language,
    tone,
    verbosity,
    instructions,
    include_table_of_contents,
    include_title_slide,
    web_search,
    generation_mode = "standard",
  }: {
    content: string;
    version?: PresentationVersion;
    n_slides: number | null;
    file_paths?: string[];
    language: string | null;
    tone?: string | null;
    verbosity?: string | null;
    instructions?: string | null;
    include_table_of_contents?: boolean;
    include_title_slide?: boolean;
    web_search?: boolean;
    generation_mode?: "standard" | "smart";
  }) {
    try {
      const limitedSlideCount =
        typeof n_slides === "number"
          ? Math.min(Math.max(n_slides, 1), MAX_NUMBER_OF_SLIDES)
          : null;
      const response = await fetch(
        getApiUrl(`/api/v1/ppt/presentation/create`),
        {
          method: "POST",
          headers: getHeader(),
          body: JSON.stringify({
            content,
            version,
            n_slides: limitedSlideCount,
            file_paths,
            language,
            tone,
            verbosity,
            instructions,
            include_table_of_contents,
            include_title_slide,
            web_search,
            generation_mode,
          }),
          cache: "no-cache",
        }
      );

      const result = await ApiResponseHandler.handleResponse(
        response,
        "Failed to create presentation"
      );
      return {
        ...result,
        type: generation_mode,
      };
    } catch (error) {
      console.error("error in presentation creation", error);
      throw error;
    }
  }

  static async createBlankPresentation(): Promise<BlankPresentationResponse> {
    try {
      const response = await fetch(
        getApiUrl(`/api/v1/ppt/presentation/create/blank`),
        {
          method: "POST",
          headers: getHeader(),
          cache: "no-cache",
        }
      );
      const presentation = (await ApiResponseHandler.handleResponse(
        response,
        "Failed to create blank presentation"
      )) as BlankPresentationResponse;

      if (!presentation || typeof presentation.id !== "string") {
        throw new Error("Blank presentation response did not include an id");
      }

      return presentation;
    } catch (error) {
      console.error("error in blank presentation creation", error);
      throw error;
    }
  }

  static async editSlide(
    slide_id: string,
    prompt: string
  ) {
    try {
      const response = await fetch(
        getApiUrl(`/api/v1/ppt/slide/edit`),
        {
          method: "POST",
          headers: getHeader(),
          body: JSON.stringify({
            id: slide_id,
            prompt,
          }),
          cache: "no-cache",
        }
      );

      return await ApiResponseHandler.handleResponse(response, "Failed to update slide");
    } catch (error) {
      console.error("error in slide update", error);
      throw error;
    }
  }

  static async getDocumentSnapshot(documentId: string) {
    const response = await fetch(
      getApiUrl(`/api/v1/ppt/editor/v1/documents/${documentId}/snapshot`),
      { method: "GET", headers: getHeader(), cache: "no-store" }
    );
    return await ApiResponseHandler.handleResponse(
      response,
      "Failed to load document revision"
    );
  }

  static async submitDocumentOperations(
    documentId: string,
    body: {
      operationId: string;
      baseRevision: number;
      operations: Array<{
        scope: string;
        targetIds: string[];
        operationType: string;
        payload: Record<string, unknown>;
      }>;
    }
  ) {
    const response = await fetch(
      getApiUrl(`/api/v1/ppt/editor/v1/documents/${documentId}/operations`),
      {
        method: "POST",
        headers: getHeader(),
        body: JSON.stringify(body),
        cache: "no-cache",
      }
    );
    return await ApiResponseHandler.handleResponse(
      response,
      "Failed to save presentation"
    );
  }

  static async exportEditablePptx(documentId: string) {
    const response = await fetch(
      getApiUrl(`/api/v1/ppt/presentation/${documentId}/export?editable=true`),
      {
        method: "POST",
        headers: getHeader(),
        body: JSON.stringify({ export_as: "pptx" }),
        cache: "no-cache",
      },
    );
    return await ApiResponseHandler.handleResponse(response, "Failed to export editable PPTX");
  }

  static async listAssets() {
    const response = await fetch(getApiUrl(`/api/v1/ppt/r1/assets`), {
      method: "GET",
      headers: getHeader(),
      cache: "no-store",
    });
    return await ApiResponseHandler.handleResponse(response, "Failed to load assets");
  }

  static async fixQualityIssues(documentId: string, codes: string[] = ["empty_image"]) {
    const response = await fetch(getApiUrl(`/api/v1/ppt/r1/quality/${documentId}/fix`), {
      method: "POST",
      headers: getHeader(),
      body: JSON.stringify({ codes }),
      cache: "no-cache",
    });
    return await ApiResponseHandler.handleResponse(response, "Failed to fix quality issues");
  }

  static async getQualityReport(documentId: string) {
    const response = await fetch(getApiUrl(`/api/v1/ppt/r1/quality/${documentId}`), {
      method: "GET",
      headers: getHeader(),
      cache: "no-store",
    });
    return await ApiResponseHandler.handleResponse(response, "Failed to load quality report");
  }

  static async listBrandPacks() {
    const response = await fetch(getApiUrl(`/api/v1/ppt/brand-packs`), {
      method: "GET",
      headers: getHeader(),
      cache: "no-store",
    });
    return await ApiResponseHandler.handleResponse(response, "Failed to load brand packs");
  }

  static async pullNielsen(documentId: string, marketPanel = "Total National Urban") {
    const response = await fetch(getApiUrl(`/api/v1/ppt/r1/integrations/nielsen`), {
      method: "POST",
      headers: getHeader(),
      body: JSON.stringify({ document_id: documentId, market_panel: marketPanel }),
      cache: "no-cache",
    });
    return await ApiResponseHandler.handleResponse(response, "Failed to pull Nielsen");
  }

  static async nielsenUnits() {
    const response = await fetch(getApiUrl(`/api/v1/ppt/r1/integrations/units`), {
      method: "GET",
      headers: getHeader(),
      cache: "no-store",
    });
    return await ApiResponseHandler.handleResponse(response, "Failed to load units");
  }

  static async proposeVariants(documentId: string, slideId: string) {
    const response = await fetch(getApiUrl(`/api/v1/ppt/r2/variants/propose`), {
      method: "POST",
      headers: getHeader(),
      body: JSON.stringify({ document_id: documentId, slide_id: slideId }),
      cache: "no-cache",
    });
    return await ApiResponseHandler.handleResponse(response, "Failed to propose variants");
  }

  static async applyVariant(documentId: string, slideId: string, compositionId: string) {
    const response = await fetch(getApiUrl(`/api/v1/ppt/r2/variants/apply`), {
      method: "POST",
      headers: getHeader(),
      body: JSON.stringify({ document_id: documentId, slide_id: slideId, composition_id: compositionId }),
      cache: "no-cache",
    });
    return await ApiResponseHandler.handleResponse(response, "Failed to apply variant");
  }

  static async refreshReport(documentId: string) {
    const response = await fetch(getApiUrl(`/api/v1/ppt/r2/reports/refresh`), {
      method: "POST",
      headers: getHeader(),
      body: JSON.stringify({ document_id: documentId }),
      cache: "no-cache",
    });
    return await ApiResponseHandler.handleResponse(response, "Failed to refresh report");
  }

  static async listDozerCatalog(packId = "m894-r1-pilot") {
    const response = await fetch(getApiUrl(`/api/v1/ppt/r1/packs/${packId}/components`), {
      method: "GET",
      headers: getHeader(),
      cache: "no-store",
    });
    return await ApiResponseHandler.handleResponse(response, "Failed to load pack catalog");
  }

  static async applyDozerPack(packId: string, documentId: string) {
    const response = await fetch(getApiUrl(`/api/v1/ppt/r1/packs/${packId}/apply`), {
      method: "POST",
      headers: getHeader(),
      body: JSON.stringify({ document_id: documentId }),
      cache: "no-cache",
    });
    return await ApiResponseHandler.handleResponse(response, "Failed to apply pack");
  }

  static async applyBrandPack(packId: string, documentId: string) {
    const response = await fetch(
      getApiUrl(`/api/v1/ppt/brand-packs/${packId}/apply/${documentId}`),
      { method: "POST", headers: getHeader(), cache: "no-cache" },
    );
    return await ApiResponseHandler.handleResponse(response, "Failed to apply brand pack");
  }

  static async listCompositions() {
    const response = await fetch(getApiUrl(`/api/v1/ppt/r1/compositions`), {
      method: "GET",
      headers: getHeader(),
      cache: "no-store",
    });
    return await ApiResponseHandler.handleResponse(response, "Failed to load layouts");
  }

  static async applyComposition(body: {
    document_id: string;
    slide_id: string;
    composition_id: string;
  }) {
    const response = await fetch(getApiUrl(`/api/v1/ppt/r1/compositions/apply`), {
      method: "POST",
      headers: getHeader(),
      body: JSON.stringify(body),
      cache: "no-cache",
    });
    return await ApiResponseHandler.handleResponse(response, "Failed to apply layout");
  }

  static async batchSlideOperations(body: {
    document_id: string;
    targetIds: string[];
    operationType: string;
    payload: Record<string, unknown>;
    scope?: string;
  }) {
    const response = await fetch(getApiUrl(`/api/v1/ppt/r1/batch`), {
      method: "POST",
      headers: getHeader(),
      body: JSON.stringify(body),
      cache: "no-cache",
    });
    return await ApiResponseHandler.handleResponse(response, "Failed to apply batch edit");
  }

  static async undoDocumentOperation(documentId: string, operationId: string) {
    const response = await fetch(
      getApiUrl(`/api/v1/ppt/editor/v1/documents/${documentId}/operations/${operationId}/undo`),
      { method: "POST", headers: getHeader(), cache: "no-cache" }
    );
    return await ApiResponseHandler.handleResponse(response, "Failed to undo");
  }

  static async updatePresentationContent(body: unknown) {
    try {
      const response = await fetch(
        getApiUrl(`/api/v1/ppt/presentation/update`),
        {
          method: "PATCH",
          headers: getHeader(),
          body: typeof body === "string" ? body : JSON.stringify(body),
          cache: "no-cache",
        }
      );

      return await ApiResponseHandler.handleResponse(response, "Failed to update presentation content");
    } catch (error) {
      console.error("error in presentation content update", error);
      throw error;
    }
  }

  static async updatePresentationSlide(slide: Slide, baseSlide?: Slide) {
    try {
      const response = await fetch(
        getApiUrl(`/api/v1/ppt/presentation/slide_update`),
        {
          method: "PATCH",
          headers: getHeader(),
          body: JSON.stringify({ slide, base_slide: baseSlide }),
          cache: "no-cache",
        }
      );

      return await ApiResponseHandler.handleResponse(
        response,
        "Failed to update slide"
      );
    } catch (error) {
      console.error("error in presentation slide update", error);
      throw error;
    }
  }

  static async presentationPrepare(presentationData: any) {
    try {
      const body =
        Array.isArray(presentationData?.outlines)
          ? {
            ...presentationData,
            outlines: limitOutlines(presentationData.outlines),
          }
          : presentationData;
      const response = await fetch(
        getApiUrl(`/api/v1/ppt/presentation/prepare`),
        {
          method: "POST",
          headers: getHeader(),
          body: JSON.stringify(body),
          cache: "no-cache",
        }
      );

      return await ApiResponseHandler.handleResponse(response, "Failed to prepare presentation");
    } catch (error) {
      console.error("error in data generation", error);
      throw error;
    }
  }

  static async getOutlines(presentationId: string): Promise<{ slides: { content: string }[] }> {
    try {
      const response = await fetch(
        getApiUrl(`/api/v1/ppt/outlines/${presentationId}`),
        {
          method: "GET",
          headers: getHeader(),
          cache: "no-cache",
        }
      );

      return await ApiResponseHandler.handleResponse(response, "Failed to fetch outlines");
    } catch (error) {
      console.error("error in outline fetch", error);
      throw error;
    }
  }

  static async updateOutlines(
    presentationId: string,
    outlines: { content: string }[]
  ): Promise<{ slides: { content: string }[] }> {
    try {
      const response = await fetch(
        getApiUrl(`/api/v1/ppt/outlines/${presentationId}`),
        {
          method: "PUT",
          headers: getHeader(),
          body: JSON.stringify({ slides: limitOutlines(outlines) }),
          cache: "no-cache",
        }
      );

      return await ApiResponseHandler.handleResponse(response, "Failed to update outlines");
    } catch (error) {
      console.error("error in outline update", error);
      throw error;
    }
  }

  // IMAGE AND ICON SEARCH


  static async generateImage(imageGenerate: ImageGenerate) {
    try {
      const response = await fetch(
        getApiUrl(`/api/v1/ppt/images/generate?prompt=${imageGenerate.prompt}`),
        {
          method: "GET",
          headers: getHeader(),
          cache: "no-cache",
        }
      );

      return await ApiResponseHandler.handleResponse(response, "Failed to generate image");
    } catch (error) {
      console.error("error in image generation", error);
      throw error;
    }
  }

  static getPreviousGeneratedImages = async (): Promise<PreviousGeneratedImagesResponse[]> => {
    try {
      const response = await fetch(
        getApiUrl(`/api/v1/ppt/images/generated`),
        {
          method: "GET",
          headers: getHeader(),
        }
      );

      return await ApiResponseHandler.handleResponse(response, "Failed to get previous generated images");
    } catch (error) {
      console.error("error in getting previous generated images", error);
      throw error;
    }
  }

  static async searchIcons(iconSearch: IconSearch) {
    try {
      const params = new URLSearchParams({
        query: iconSearch.query,
        limit: String(iconSearch.limit),
      });
      if (iconSearch.icon_type) {
        params.set("icon_type", iconSearch.icon_type);
      }
      if (iconSearch.icon_weight) {
        params.set("icon_weight", iconSearch.icon_weight);
      }
      const response = await fetch(
        getApiUrl(`/api/v1/ppt/icons/search?${params.toString()}`),
        {
          method: "GET",
          headers: getHeader(),
          cache: "no-cache",
        }
      );

      const icons = await ApiResponseHandler.handleResponse(response, "Failed to search icons");
      return Array.isArray(icons)
        ? icons.map((icon) =>
          typeof icon === "string" ? resolveBackendAssetUrl(icon) : icon
        )
        : icons;
    } catch (error) {
      console.error("error in icon search", error);
      throw error;
    }
  }

}
