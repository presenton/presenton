import { ApiResponseHandler } from "./api-error-handler"
import { getHeader, getHeaderForFormData } from "./header"
import { Theme, ThemeParams } from "./types"
import { getApiUrl } from "@/utils/api"



class ThemeApi {

  static async getThemes(): Promise<Theme[]> {
    try {
      const response = await fetch(getApiUrl(`/api/v1/ppt/themes/all`), {
        method: "GET",
        headers: getHeader(),
        cache: "no-store",
      })
      return await ApiResponseHandler.handleResponse(response, "Failed to get themes")
    } catch (error) {
      console.error("Error getting themes:", error)
      throw error
    }
  }
  static async createTheme(theme: ThemeParams) {
    try {

      const response = await fetch(getApiUrl(`/api/v1/ppt/themes/create`), {
        method: "POST",
        headers: getHeader(),
        body: JSON.stringify(theme),
        cache: "no-store",
      })
      return await ApiResponseHandler.handleResponse(response, "Failed to create theme")
    }
    catch (error) {
      console.error("Error creating theme:", error)
      throw error
    }
  }
  static async updateTheme(theme: ThemeParams) {
    try {
      const response = await fetch(getApiUrl(`/api/v1/ppt/themes/update/${theme.id}`), {
        method: "PATCH",
        headers: getHeader(),
        body: JSON.stringify(theme),
        cache: "no-store",
      })
      return await ApiResponseHandler.handleResponse(response, "Failed to update theme")
    }
    catch (error) {
      console.error("Error updating theme:", error)
      throw error
    }
  }
  static async deleteTheme(themeId: string) {
    try {
      const response = await fetch(getApiUrl(`/api/v1/ppt/themes/delete/${themeId}`), {
        method: "DELETE",
        headers: getHeader(),
        cache: "no-store",
      })
      return await ApiResponseHandler.handleResponse(response, "Failed to delete theme")
    }
    catch (error) {
      console.error("Error deleting theme:", error)
      throw error
    }
  }
  static async generateTheme({ primary, background }: { primary?: string, background?: string }) {
    try {
      let body = {}
      if (primary || background) {
        body = {
          primary: primary ?? undefined,
          background: background ?? undefined,
        }
      }
      const response = await fetch(getApiUrl(`/api/v1/ppt/theme/generate`), {
        method: "POST",
        headers: getHeader(),
        body: JSON.stringify(body),
      })
      return await ApiResponseHandler.handleResponse(response, "Failed to generate theme")
    }

    catch (error) {
      console.error("Error generating theme:", error)
      throw error
    }
  }
  static async uploadFont(font: File) {
    try {
      const formData = new FormData();
      formData.append("font_file", font);
      const response: any = await fetch(getApiUrl(`/api/v1/ppt/fonts/upload`), {
        method: "POST",
        headers: getHeaderForFormData(),
        body: formData,
      })
      return await ApiResponseHandler.handleResponse(response, "Failed to upload font")
    }
    catch (error) {
      console.error("Error uploading font:", error)
      throw error
    }
  }
  static async getUserFonts() {
    try {
      const response = await fetch(getApiUrl(`/api/v1/ppt/fonts/uploaded`), {
        method: "GET",
        headers: getHeader(),
      })
      return await ApiResponseHandler.handleResponse(response, "Failed to get user fonts")
    }
    catch (error) {
      console.error("Error getting user fonts:", error)
      throw error
    }
  }
}

export default ThemeApi