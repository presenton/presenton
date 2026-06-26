from fastapi import HTTPException
from openai import APIError as OpenAIAPIError
from google.genai.errors import APIError as GoogleAPIError
import traceback

from llmai.shared.errors import BaseError as LLMAIBaseError
from utils.image_generation_error import openai_error_detail


def handle_llm_client_exceptions(e: Exception) -> HTTPException:
    traceback.print_exc()
    if isinstance(e, HTTPException):
        return e
    if isinstance(e, LLMAIBaseError):
        return HTTPException(status_code=e.status_code, detail=e.message)
    if isinstance(e, OpenAIAPIError):
        return HTTPException(
            status_code=getattr(e, "status_code", None) or 500,
            detail=openai_error_detail(e, operation="API request"),
        )
    if isinstance(e, GoogleAPIError):
        return HTTPException(status_code=500, detail=f"Google API error: {e.message}")
    return HTTPException(status_code=500, detail=f"LLM API error: {e}")
