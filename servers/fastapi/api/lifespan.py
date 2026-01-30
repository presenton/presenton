from contextlib import asynccontextmanager
import os

from fastapi import FastAPI

from services.database import create_db_and_tables
from utils.get_env import get_app_data_directory_env
from utils.model_availability import (
    check_llm_and_image_provider_api_or_model_availability,
)


@asynccontextmanager
async def app_lifespan(_: FastAPI):
    """
    Lifespan context manager for FastAPI application.
    Initializes the application data directory and checks LLM model availability.

    """
    os.makedirs(get_app_data_directory_env(), exist_ok=True)
    try:
        await create_db_and_tables()
    except Exception as e:
        print(f"Error creating database tables: {e}")
        
    try:
        await check_llm_and_image_provider_api_or_model_availability()
    except Exception as e:
        print(f"Model availability check failed: {e}. The app will continue to start.")
    yield
