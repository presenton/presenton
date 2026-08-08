import {
  getHeader,
} from "@/app/(presentation-generator)/services/api/header";
import { ApiResponseHandler } from "@/app/(presentation-generator)/services/api/api-error-handler";
import { getApiUrl } from "@/utils/api";

export type PresentationVersion = "v1-standard" | "v2-standard";

export interface PresentationResponse {
  id: string;
  version?: PresentationVersion;
  title: string;
  created_at: string;
  updated_at: string;
  data: any | null;
  file: string;
  n_slides: number;
  prompt: string;
  summary: string | null;
  theme: Record<string, any> | null;
  titles: string[];
  user_id: string;
  vector_store: any;

  thumbnail: string;
  layout?: any;
  structure?: any;
  components?: any;
  fonts?: any;
  slides: any[];
}

export class DashboardApi {

  static async getPresentations(
    version?: PresentationVersion,
    options?: { includeSlides?: boolean }
  ): Promise<PresentationResponse[]> {
    try {
      const params = new URLSearchParams();
      if (version) {
        params.set("version", version);
      }
      if (options?.includeSlides === false) {
        params.set("include_slides", "false");
      }
      const query = params.toString();
      const response = await fetch(
        getApiUrl(`/api/v1/ppt/presentation/all${query ? `?${query}` : ""}`),
        {
          method: "GET",
        }
      );

      // Handle the special case where 404 means "no presentations found"
      if (response.status === 404) {
        console.log("No presentations found");
        return [];
      }

      return await ApiResponseHandler.handleResponse(response, "Failed to fetch presentations");
    } catch (error) {
      console.error("Error fetching presentations:", error);
      throw error;
    }
  }

  static async getPresentation(id: string) {
    try {
      const response = await fetch(
        getApiUrl(`/api/v1/ppt/presentation/${id}`),
        {
          method: "GET",
          credentials: "include",
        }
      );

      return await ApiResponseHandler.handleResponse(response, "Presentation not found");
    } catch (error) {
      console.error("Error fetching presentation:", error);
      throw error;
    }
  }

  static async deletePresentation(presentation_id: string) {
    try {
      const response = await fetch(
        getApiUrl(`/api/v1/ppt/presentation/${presentation_id}`),
        {
          method: "DELETE",
          headers: getHeader(),
        }
      );

      return await ApiResponseHandler.handleResponseWithResult(response, "Failed to delete presentation");
    } catch (error) {
      console.error("Error deleting presentation:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Failed to delete presentation",
      };
    }
  }

  static async duplicatePresentation(presentation_id: string) {
    try {
      const response = await fetch(
        getApiUrl(`/api/v1/ppt/presentation/${presentation_id}/duplicate`),
        {
          method: "POST",
          headers: getHeader(),
        }
      );

      return await ApiResponseHandler.handleResponse(response, "Failed to duplicate presentation");
    } catch (error) {
      console.error("Error duplicating presentation:", error);
      throw error;
    }
  }
}
