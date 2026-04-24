// API Error Response Interface
interface ApiErrorResponse {
  detail?: unknown;
  message?: string;
  error?: string;
}

// API Response Handler Utility
export class ApiResponseHandler {
  private static normalizeErrorDetail(detail: unknown): string | null {
    if (!detail) return null;

    if (typeof detail === "string") {
      return detail;
    }

    if (Array.isArray(detail)) {
      const parts = detail
        .map((item) => {
          if (typeof item === "string") return item;
          if (item && typeof item === "object") {
            const maybeMsg = (item as { msg?: unknown }).msg;
            const maybeLoc = (item as { loc?: unknown }).loc;
            const locPath = Array.isArray(maybeLoc)
              ? maybeLoc
                  .filter((v) => typeof v === "string" || typeof v === "number")
                  .join(".")
              : "";
            if (typeof maybeMsg === "string") {
              return locPath ? `${locPath}: ${maybeMsg}` : maybeMsg;
            }
          }
          return null;
        })
        .filter((v): v is string => Boolean(v));

      return parts.length ? parts.join("; ") : JSON.stringify(detail);
    }

    if (typeof detail === "object") {
      return JSON.stringify(detail);
    }

    return String(detail);
  }

 
  static async handleResponse(response: Response, defaultErrorMessage: string): Promise<any> {
    // Handle successful responses
    if (response.ok) {
      // Handle 204 No Content responses
      if (response.status === 204) {
        return true;
      }
      
      // Try to parse JSON response
      try {
        return await response.json();
      } catch (error) {
        // If JSON parsing fails but response is ok, return empty object
        return {};
      }
    }

    // Handle error responses
    let errorMessage = defaultErrorMessage;
    
    try {
      const errorData: ApiErrorResponse = await response.json();
      
      // Extract error message in order of preference
      const normalizedDetail = this.normalizeErrorDetail(errorData.detail);
      if (normalizedDetail) {
        errorMessage = normalizedDetail;
      } else if (errorData.message) {
        errorMessage = errorData.message;
      } else if (errorData.error) {
        errorMessage = errorData.error;
      }
    } catch (parseError) {
      // If JSON parsing fails, use status-based messages
      errorMessage = this.getStatusBasedErrorMessage(response.status, defaultErrorMessage);
    }

    // Throw error with appropriate message
    throw new Error(errorMessage);
  }


  static async handleResponseWithResult(response: Response, defaultErrorMessage: string): Promise<{success: boolean, message?: string}> {
    try {
      // Handle successful responses
      if (response.ok) {
        return { success: true };
      }

      // Handle error responses
      let errorMessage = defaultErrorMessage;
      
      try {
        const errorData: ApiErrorResponse = await response.json();
        
        // Extract error message in order of preference
        const normalizedDetail = this.normalizeErrorDetail(errorData.detail);
        if (normalizedDetail) {
          errorMessage = normalizedDetail;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch (parseError) {
        // If JSON parsing fails, use status-based messages
        errorMessage = this.getStatusBasedErrorMessage(response.status, defaultErrorMessage);
      }

      return {
        success: false,
        message: errorMessage,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : defaultErrorMessage,
      };
    }
  }


  private static getStatusBasedErrorMessage(status: number, defaultMessage: string): string {
    switch (status) {
      case 400:
        return "Bad request. Please check your input and try again.";
      case 401:
        return "Unauthorized. Please log in and try again.";
      case 403:
        return "Access forbidden. You don't have permission to perform this action.";
      case 404:
        return "Resource not found. The requested item may have been deleted or moved.";
      case 409:
        return "Conflict. The resource already exists or there's a conflict with the current state.";
      case 422:
        return "Validation error. Please check your input and try again.";
      case 429:
        return "Too many requests. Please wait a moment and try again.";
      case 500:
        return "Internal server error. Please try again later.";
      case 502:
        return "Bad gateway. The server is temporarily unavailable.";
      case 503:
        return "Service unavailable. Please try again later.";
      case 504:
        return "Gateway timeout. The request took too long to process.";
      default:
        return defaultMessage;
    }
  }
}

export type { ApiErrorResponse }; 