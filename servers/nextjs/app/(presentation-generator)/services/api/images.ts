import { getHeaderForFormData } from "./header";
import { ApiResponseHandler } from "./api-error-handler";
import { ImageAssetResponse } from "./types";
import { getApiUrl } from "@/utils/api";

interface StockSearchOptions {
  provider?: string;
  apiKey?: string;
  strictApiKey?: boolean;
}


export class ImagesApi {
 
 static async uploadImage(file: File): Promise<ImageAssetResponse> {
    try {
          const formData = new FormData();
      formData.append("file", file);
    const response = await fetch(getApiUrl(`/api/v1/ppt/images/upload`), {
      method: "POST",
      headers: getHeaderForFormData(),
      body: formData,
    });
    return await ApiResponseHandler.handleResponse(response, "Failed to upload image") as ImageAssetResponse;
  } catch (error:any) {
    console.log("Upload error:", error.message);
    throw error;
  }
  }

  static async getUploadedImages(): Promise<ImageAssetResponse[]> {
    try {
    const response = await fetch(getApiUrl(`/api/v1/ppt/images/uploaded`));
   return await ApiResponseHandler.handleResponse(response, "Failed to get uploaded images") as ImageAssetResponse[];
  } catch (error:any) {
    console.log("Get uploaded images error:", error);
    throw error;
  }
  }

  static async deleteImage(image_id: string): Promise<{success: boolean, message?: string}> {
    try {
      const response = await fetch(getApiUrl(`/api/v1/ppt/images/${image_id}`), {
        method: "DELETE"
      });
      return await ApiResponseHandler.handleResponse(response, "Failed to delete image") as {success: boolean, message?: string};
    } catch (error:any) {
      console.log("Delete image error:", error);
      throw error;
    }
  }

  static async searchStockImages(
    query: string,
    limit: number = 12,
    options: StockSearchOptions = {}
  ): Promise<string[]> {
    try {
      const params = new URLSearchParams({
        query,
        limit: String(limit),
      });
      const normalizedProvider = (options.provider || "").trim().toLowerCase();
      if (normalizedProvider) {
        params.set("provider", normalizedProvider);
      }
      if (options.strictApiKey) {
        params.set("strict_api_key", "true");
      }

      const headers: Record<string, string> = {};
      const trimmedApiKey = (options.apiKey || "").trim();
      if (trimmedApiKey) {
        headers["X-Provider-Api-Key"] = trimmedApiKey;
      }

      const response = await fetch(getApiUrl(`/api/v1/ppt/images/search?${params.toString()}`), {
        method: "GET",
        headers,
      });
      return await ApiResponseHandler.handleResponse(response, "Failed to search stock images") as string[];
    } catch (error:any) {
      console.log("Stock image search error:", error);
      throw error;
    }
  }
}


