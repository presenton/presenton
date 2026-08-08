import {
  isChatGptAuthRequiredResponse,
  normalizeChatGptAuthMessage,
  requestChatGptReauth,
} from "@/utils/chatgptAuth";
import {
  extractApiErrorMessage,
  type ApiErrorResponse,
} from "@/utils/apiErrorMessages";

// API Response Handler Utility
export class ApiResponseHandler {
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
      } catch {
        // If JSON parsing fails but response is ok, return empty object
        return {};
      }
    }

    // Handle error responses
    let errorMessage = defaultErrorMessage;
    
    try {
      const errorData: ApiErrorResponse = await response.json();
      errorMessage = extractApiErrorMessage(
        errorData,
        defaultErrorMessage,
        response.status
      );

      if (isChatGptAuthRequiredResponse(response, errorData, errorMessage)) {
        errorMessage = normalizeChatGptAuthMessage(errorMessage);
        requestChatGptReauth({
          message: errorMessage,
          source: "api-response",
        });
      }
    } catch {
      // If JSON parsing fails, use status-based messages
      errorMessage = this.getStatusBasedErrorMessage(response.status, defaultErrorMessage);
      if (isChatGptAuthRequiredResponse(response, null, errorMessage)) {
        errorMessage = normalizeChatGptAuthMessage(errorMessage);
        requestChatGptReauth({
          message: errorMessage,
          source: "api-response",
        });
      }
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
        errorMessage = extractApiErrorMessage(
          errorData,
          defaultErrorMessage,
          response.status
        );

        if (isChatGptAuthRequiredResponse(response, errorData, errorMessage)) {
          errorMessage = normalizeChatGptAuthMessage(errorMessage);
          requestChatGptReauth({
            message: errorMessage,
            source: "api-response-result",
          });
        }
      } catch {
        // If JSON parsing fails, use status-based messages
        errorMessage = this.getStatusBasedErrorMessage(response.status, defaultErrorMessage);
        if (isChatGptAuthRequiredResponse(response, null, errorMessage)) {
          errorMessage = normalizeChatGptAuthMessage(errorMessage);
          requestChatGptReauth({
            message: errorMessage,
            source: "api-response-result",
          });
        }
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
